const express = require("express");

// ============================================================
// OPENSTREETMAP HOSPITAL SEARCH (Overpass API, server-side only)
// ============================================================
// No API key, no billing. Queries the public Overpass API for
// hospitals / clinics / medical centres around a coordinate.
// City searches are geocoded first with Nominatim (also OSM).
// The endpoint is configurable via OVERPASS_API_URL in Backend/.env.
// Results are cached briefly so panning the map does not spam the
// public service.
// ============================================================

const router = express.Router();

// Public Overpass instances fail over: the first one that answers
// successfully is remembered and preferred. Set OVERPASS_API_URL to a
// comma-separated list to override the defaults (self-hosted endpoint,
// regional mirrors, etc).
const DEFAULT_OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const OVERPASS_ENDPOINTS = String(
  process.env.OVERPASS_API_URL || ""
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const OVERPASS_USER_AGENT = "Health-Saathi/1.0 (hospital search)";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "Health-Saathi/1.0 (hospital search)";

// Photon (komoot, OSM-based) geocodes full pasted addresses that
// Nominatim's free-text search fails on; used as a fallback only.
const PHOTON_ENDPOINT = "https://photon.komoot.io/api";

// Driving distances come from the public OSRM demo server (free, no
// key). Set OSRM_API_URL to point at another OSRM/Valhalla-compatible
// instance if needed.
const OSRM_ENDPOINT = (
  process.env.OSRM_API_URL || "https://router.project-osrm.org"
).replace(/\/+$/, "");

const OSRM_TIMEOUT_MS = 10000;

// The public OSRM table endpoint caps total coordinates (~100). Keep
// the hospital list well inside that limit.
const MAX_OSRM_DESTINATIONS = 60;

// The frontend aborts API requests after 20s, so keep the total
// Overpass budget (attempts x timeout) well below that. Overpass
// normally answers within ~2s when reachable.
const OVERPASS_TIMEOUT_MS = 5000;
const MAX_OVERPASS_ATTEMPTS = 2;
const NOMINATIM_TIMEOUT_MS = 10000;

// First endpoint that answered successfully; tried first next time.
let preferredOverpassEndpoint = null;

// Circuit breaker: after a full failure, skip Overpass for a while so
// users do not pay the failover timeout on every request.
const OVERPASS_COOLDOWN_MS = 10 * 60 * 1000;
let overpassDisabledUntil = 0;

// OSM tags treated as healthcare facilities.
const AMENITY_FILTER = '["amenity"~"^(hospital|clinic)$"]';
const HEALTHCARE_FILTER = '["healthcare"~"^(hospital|clinic)$"]';

// Short-lived cache: key -> { expires, hospitals }.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const responseCache = new Map();

function cacheGet(key) {
  const entry = responseCache.get(key);

  if (!entry) return null;

  if (entry.expires < Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.hospitals;
}

function cacheSet(key, hospitals) {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }

  responseCache.set(key, {
    expires: Date.now() + CACHE_TTL_MS,
    hospitals,
  });
}

// ==========================================
// OSM DATA HELPERS
// ==========================================

function facilityTypeFromTags(tags) {
  if (tags.healthcare === "hospital" || tags.amenity === "hospital") {
    return "Hospital";
  }

  if (tags.healthcare === "clinic" || tags.amenity === "clinic") {
    return "Clinic";
  }

  if (tags["medical"] === "yes" || tags.healthcare) {
    return "Medical centre";
  }

  return "Medical facility";
}

function composeAddress(tags) {
  if (tags["addr:full"]) {
    return tags["addr:full"];
  }

  const streetLine = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ");

  const parts = [
    streetLine,
    tags["addr:suburb"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);

  return parts.join(", ");
}

function phoneFromTags(tags) {
  return (
    tags.phone ||
    tags["contact:phone"] ||
    tags["addr:phone"] ||
    ""
  );
}

// Ways and relations carry a "center"; nodes carry lat/lon directly.
// Elements without coordinates are skipped safely.
function serializeElement(element) {
  const tags = element.tags || {};

  const latitude =
    typeof element.lat === "number"
      ? element.lat
      : element.center && typeof element.center.lat === "number"
      ? element.center.lat
      : null;

  const longitude =
    typeof element.lon === "number"
      ? element.lon
      : element.center && typeof element.center.lon === "number"
      ? element.center.lon
      : null;

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    id: `${element.type}/${element.id}`,
    name: tags.name || tags["name:en"] || "Unnamed medical facility",
    address: composeAddress(tags),
    facilityType: facilityTypeFromTags(tags),
    phone: phoneFromTags(tags),
    latitude,
    longitude,
  };
}

function serializeElements(elements) {
  const hospitals = elements
    .map(serializeElement)
    .filter((hospital) => hospital !== null);

  // The same facility can match both amenity and healthcare filters,
  // and nodes/ways can overlap: de-duplicate by OSM id.
  const seen = new Set();

  return hospitals.filter((hospital) => {
    if (seen.has(hospital.id)) return false;
    seen.add(hospital.id);
    return true;
  });
}

function buildNearbyQuery(latitude, longitude, radius) {
  const parts = [
    `node${AMENITY_FILTER}(around:${radius},${latitude},${longitude});`,
    `way${AMENITY_FILTER}(around:${radius},${latitude},${longitude});`,
    `node${HEALTHCARE_FILTER}(around:${radius},${latitude},${longitude});`,
    `way${HEALTHCARE_FILTER}(around:${radius},${latitude},${longitude});`,
  ];

  return `[out:json][timeout:15];(${parts.join("")});out center;`;
}

// ==========================================
// OVERPASS / NOMINATIM CALLS
// ==========================================

async function callOverpass(query) {
  if (Date.now() < overpassDisabledUntil) {
    return {
      ok: false,
      status: 503,
      message:
        "The hospital search service is busy right now. Please try again in a moment.",
    };
  }

  const endpoints =
    OVERPASS_ENDPOINTS.length > 0
      ? OVERPASS_ENDPOINTS
      : DEFAULT_OVERPASS_ENDPOINTS;

  // Try the known-good endpoint first, then the others.
  const ordered = preferredOverpassEndpoint
    ? [
        preferredOverpassEndpoint,
        ...endpoints.filter((url) => url !== preferredOverpassEndpoint),
      ]
    : endpoints;

  let lastError = {
    status: 502,
    message:
      "Could not load hospitals from OpenStreetMap. Please try again later.",
  };

  for (const endpoint of ordered.slice(0, MAX_OVERPASS_ATTEMPTS)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      // 429 (rate limited) and 504 (busy) mean this mirror cannot
      // serve the query right now; try the next one.
      if (response.status === 429 || response.status === 504) {
        console.error(`Overpass ${endpoint} busy (HTTP ${response.status})`);
        lastError = {
          status: 503,
          message:
            "The hospital search service is busy right now. Please try again in a moment.",
        };
        continue;
      }

      if (!response.ok) {
        console.error(`Overpass ${endpoint} failed (HTTP ${response.status})`);
        lastError = {
          status: 502,
          message:
            "Could not load hospitals from OpenStreetMap. Please try again later.",
        };
        continue;
      }

      const text = await response.text();

      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (!body || !Array.isArray(body.elements)) {
        console.error(`Overpass ${endpoint} returned an unexpected body`);
        lastError = {
          status: 502,
          message:
            "Could not load hospitals from OpenStreetMap. Please try again later.",
        };
        continue;
      }

      // Success: remember this endpoint and clear the breaker.
      preferredOverpassEndpoint = endpoint;
      overpassDisabledUntil = 0;

      return { ok: true, elements: body.elements };
    } catch (error) {
      if (error.name === "AbortError") {
        console.error(`Overpass ${endpoint} timed out`);
      } else {
        console.error(`Overpass ${endpoint} network error:`, error.message);
      }

      lastError = {
        status: 502,
        message:
          "Could not reach the OpenStreetMap hospital service. Please try again.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Every endpoint failed: trip the breaker so the next requests skip
  // straight to the Nominatim fallback instead of waiting for timeouts.
  overpassDisabledUntil = Date.now() + OVERPASS_COOLDOWN_MS;

  return { ok: false, ...lastError };
}

// ==========================================
// NOMINATIM (geocoding + fallback POI search)
// ==========================================
// Nominatim is used to resolve city searches to coordinates. It also
// doubles as a hospital data fallback: on some networks every Overpass
// mirror is unreachable, but Nominatim's POI search inside a bounded
// viewbox returns the same OSM data.

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function callNominatimJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Nominatim failed (HTTP ${response.status})`);
      return { ok: false };
    }

    const body = await response.json();

    return { ok: true, body };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Nominatim request timed out");
    } else {
      console.error("Nominatim network error:", error.message);
    }
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodePhoton(query) {
  const url =
    `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=1`;

  const result = await callNominatimJson(url);

  if (!result.ok || !result.body || !Array.isArray(result.body.features)) {
    return null;
  }

  const feature = result.body.features[0];

  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
    return null;
  }

  const [lon, lat] = feature.geometry.coordinates;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { latitude: lat, longitude: lon };
}

async function geocodePlace(query) {
  // 1. Nominatim free-text search.
  const nominatim =
    `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&limit=1`;

  const result = await callNominatimJson(nominatim);

  if (result.ok && Array.isArray(result.body) && result.body.length > 0) {
    const match = result.body[0];

    const lat = Number(match.lat);
    const lon = Number(match.lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }

  // 2. Photon fallback (handles full pasted addresses better).
  console.log("Nominatim found nothing - falling back to Photon geocoding");

  return geocodePhoton(query);
}

function nominatimFacilityType(item) {
  if (item.type === "hospital") return "Hospital";
  if (item.type === "clinic" || item.type === "doctors") return "Clinic";

  const healthcare = item.extratags && item.extratags.healthcare;

  if (healthcare === "hospital") return "Hospital";
  if (healthcare === "clinic" || healthcare === "doctors") return "Clinic";

  return "Medical facility";
}

// Keeps only real healthcare POIs (the free-text search can also match
// roads or suburbs whose name contains the keyword).
function isHealthcarePoi(item) {
  const healthcareTypes = [
    "hospital",
    "clinic",
    "doctors",
    "dentist",
    "nursing_home",
  ];

  if (item.category === "amenity" && healthcareTypes.includes(item.type)) {
    return true;
  }

  const healthcare = item.extratags && item.extratags.healthcare;

  return healthcare === "hospital" || healthcare === "clinic";
}

function composeNominatimAddress(item) {
  const address = item.address || {};

  if (Object.keys(address).length > 0) {
    const streetLine = [address.house_number, address.road]
      .filter(Boolean)
      .join(" ");

    const parts = [
      streetLine,
      address.suburb || address.neighbourhood,
      address.city || address.town || address.village || address.county,
      address.state,
      address.postcode,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  // display_name starts with the name; drop it to keep the rest.
  const displayName = item.display_name || "";
  const name = item.name || "";

  if (name && displayName.startsWith(name)) {
    return displayName.slice(name.length).replace(/^[,\s]+/, "");
  }

  return displayName;
}

function serializeNominatimResults(items, center, radius) {
  const hospitals = items
    .filter(isHealthcarePoi)
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      const distance = haversineMeters(
        center.latitude,
        center.longitude,
        latitude,
        longitude
      );

      // The viewbox is a square; results in its corners can be further
      // than the requested radius. Allow a small tolerance.
      if (distance > radius * 1.05) {
        return null;
      }

      const extratags = item.extratags || {};

      return {
        id:
          item.osm_type && item.osm_id
            ? `${item.osm_type}/${item.osm_id}`
            : `nominatim/${item.place_id}`,
        name: item.name || "Unnamed medical facility",
        address: composeNominatimAddress(item),
        facilityType: nominatimFacilityType(item),
        phone: extratags.phone || extratags["contact:phone"] || "",
        latitude,
        longitude,
        distance,
      };
    })
    .filter((hospital) => hospital !== null);

  // Dedup by OSM id (hospital + clinic keywords can overlap).
  const seen = new Set();

  return hospitals
    .filter((hospital) => {
      if (seen.has(hospital.id)) return false;
      seen.add(hospital.id);
      return true;
    })
    .sort((a, b) => a.distance - b.distance)
    .map(({ distance, ...hospital }) => hospital);
}

// Nominatim policy allows one request at a time; keywords run sequentially.
async function searchNominatimPoi(latitude, longitude, radius) {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos((latitude * Math.PI) / 180));
  const viewbox = [
    (longitude - lngDelta).toFixed(6),
    (latitude + latDelta).toFixed(6),
    (longitude + lngDelta).toFixed(6),
    (latitude - latDelta).toFixed(6),
  ].join(",");

  const items = [];

  for (const keyword of ["hospital", "clinic"]) {
    const url =
      `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(keyword)}` +
      `&viewbox=${viewbox}&bounded=1&format=jsonv2&limit=50` +
      `&extratags=1&addressdetails=1`;

    const result = await callNominatimJson(url);

    if (!result.ok || !Array.isArray(result.body)) {
      return {
        ok: false,
        status: 503,
        message:
          "Hospital search is temporarily unavailable. Please try again shortly.",
      };
    }

    items.push(...result.body);
  }

  return {
    ok: true,
    hospitals: serializeNominatimResults(
      items,
      { latitude, longitude },
      radius
    ),
  };
}

// ==========================================
// PROVIDER ORCHESTRATION
// ==========================================
// 1. Overpass (rich tag data, fast when reachable).
// 2. Nominatim POI search (same OSM data, works on restricted networks).

async function fetchHospitalsNear(latitude, longitude, radius) {
  const overpass = await callOverpass(
    buildNearbyQuery(latitude, longitude, radius)
  );

  if (overpass.ok) {
    return {
      ok: true,
      hospitals: serializeElements(overpass.elements)
        .sort(
          (a, b) =>
            haversineMeters(latitude, longitude, a.latitude, a.longitude) -
            haversineMeters(latitude, longitude, b.latitude, b.longitude)
        )
        // Keep the list inside the OSRM table limit so every hospital
        // gets a driving distance.
        .slice(0, MAX_OSRM_DESTINATIONS),
    };
  }

  console.log(
    "Overpass unavailable - falling back to Nominatim POI search"
  );

  const fallback = await searchNominatimPoi(latitude, longitude, radius);

  if (fallback.ok) {
    return {
      ok: true,
      hospitals: fallback.hospitals.slice(0, MAX_OSRM_DESTINATIONS),
    };
  }

  return {
    ok: false,
    status: fallback.status,
    message:
      "Hospital search is temporarily unavailable. Please try again shortly.",
  };
}

// ==========================================
// DRIVING DISTANCES (OSRM)
// ==========================================
// One table request covers every hospital at once. On any failure the
// hospitals keep drivingDistanceKm = null and the caller falls back to
// straight-line distances/order.

let consecutiveOsrmFailures = 0;
const OSRM_COOLDOWN_MS = 10 * 60 * 1000;
const OSRM_MAX_CONSECUTIVE_FAILURES = 3;
let osrmDisabledUntil = 0;

function osrmAvailable() {
  return (
    Date.now() >= osrmDisabledUntil ||
    consecutiveOsrmFailures < OSRM_MAX_CONSECUTIVE_FAILURES
  );
}

async function applyDrivingDistances(origin, hospitals) {
  const prepared = hospitals.map((hospital) => ({
    ...hospital,
    drivingDistanceKm: null,
  }));

  if (!origin || prepared.length === 0) {
    return prepared;
  }

  if (!osrmAvailable()) {
    console.log("OSRM skipped (recently failing)");
    return prepared;
  }

  const points = [origin, ...prepared.slice(0, MAX_OSRM_DESTINATIONS)];

  const coords = points
    .map(
      (point) =>
        `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`
    )
    .join(";");

  const url =
    `${OSRM_ENDPOINT}/table/v1/driving/${coords}` +
    `?sources=0&annotations=distance`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.json();

    const row = body && body.code === "Ok" ? body.distances && body.distances[0] : null;

    if (!Array.isArray(row)) {
      throw new Error("Unexpected OSRM response");
    }

    prepared.forEach((hospital, index) => {
      const meters = row[index + 1];

      if (Number.isFinite(meters) && meters >= 0) {
        hospital.drivingDistanceKm = Number((meters / 1000).toFixed(2));
      }
    });

    consecutiveOsrmFailures = 0;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("OSRM request timed out");
    } else {
      console.error("OSRM request failed:", error.message);
    }

    consecutiveOsrmFailures += 1;

    if (consecutiveOsrmFailures >= OSRM_MAX_CONSECUTIVE_FAILURES) {
      osrmDisabledUntil = Date.now() + OSRM_COOLDOWN_MS;
      console.log("OSRM disabled temporarily");
    }
  } finally {
    clearTimeout(timeout);
  }

  if (prepared.some((hospital) => hospital.drivingDistanceKm !== null)) {
    prepared.sort(
      (a, b) =>
        (a.drivingDistanceKm ?? Number.POSITIVE_INFINITY) -
        (b.drivingDistanceKm ?? Number.POSITIVE_INFINITY)
    );
  }

  return prepared;
}

// Parses the optional frontend GPS coordinates. Returns null when
// absent or invalid; the response then has no driving distances.
function parseOrigin(req) {
  const lat = Number(req.query.originLat);
  const lng = Number(req.query.originLng);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { latitude: lat, longitude: lng };
  }

  return null;
}

// Cache suffix so different origins do not share stale distances.
// Rounded to 3 decimals (~110 m) so GPS jitter reuses cached entries.
function originCacheSuffix(origin) {
  if (!origin) return "no-origin";

  return `o:${origin.latitude.toFixed(3)}:${origin.longitude.toFixed(3)}`;
}

// ==========================================
// GET /api/places/nearby?lat=..&lng=..&radius=..
// Hospitals / clinics near a coordinate.
// ==========================================

router.get("/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  let radius = Number(req.query.radius) || 5000;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({
      success: false,
      message: "A valid 'lat' query parameter is required.",
    });
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      message: "A valid 'lng' query parameter is required.",
    });
  }

  // Keep public Overpass usage reasonable.
  radius = Math.min(Math.max(radius, 200), 20000);

  const origin = parseOrigin(req);

  // Cache key rounded so tiny map pans and GPS jitter reuse results.
  const cacheKey =
    `nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}` +
    `:${originCacheSuffix(origin)}`;

  const cached = cacheGet(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      count: cached.length,
      hospitals: cached,
    });
  }

  const result = await fetchHospitalsNear(lat, lng, radius);

  if (!result.ok) {
    return res.status(result.status).json({
      success: false,
      message: result.message,
    });
  }

  const hospitals = await applyDrivingDistances(origin, result.hospitals);

  cacheSet(cacheKey, hospitals);

  res.status(200).json({
    success: true,
    count: hospitals.length,
    hospitals,
  });
});

// ==========================================
// GET /api/places/search?q=..
// Manual search: hospitals in a city or named location.
// Geocoded with Nominatim, then an Overpass lookup around it.
// ==========================================

router.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({
      success: false,
      message: "Enter a city or location name (2-120 characters).",
    });
  }

  const origin = parseOrigin(req);

  const cacheKey = `search:${query.toLowerCase()}:${originCacheSuffix(origin)}`;

  const cached = cacheGet(cacheKey);

  if (cached) {
    return res.status(200).json({
      success: true,
      count: cached.length,
      hospitals: cached,
    });
  }

  const location = await geocodePlace(query);

  // Unknown place: an empty result set, not an error.
  if (!location) {
    return res.status(200).json({
      success: true,
      count: 0,
      hospitals: [],
    });
  }

  // Pasted full addresses often geocode to spots with no hospitals
  // in the initial radius: widen until something is found (public
  // service cap is 20 km).
  const SEARCH_RADII_KM = [8, 12, 20];

  let result = null;

  for (const radiusKm of SEARCH_RADII_KM) {
    result = await fetchHospitalsNear(
      location.latitude,
      location.longitude,
      radiusKm * 1000
    );

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    if (result.hospitals.length > 0) {
      break;
    }
  }

  const hospitals = await applyDrivingDistances(origin, result.hospitals);

  cacheSet(cacheKey, hospitals);

  res.status(200).json({
    success: true,
    count: hospitals.length,
    hospitals,
  });
});

module.exports = router;
