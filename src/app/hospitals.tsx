import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';

import { Ionicons } from '@expo/vector-icons';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useFonts } from 'expo-font';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter, useFocusEffect } from 'expo-router';

import * as Location from 'expo-location';

import { apiFetch, parseJson, getApiErrorMessage } from '../services/api';

import AppHeader from '../components/AppHeader';

// ====================================================
// MAP (OpenStreetMap via MapLibre, native only)
// ====================================================
// @maplibre/maplibre-react-native renders OpenStreetMap data and
// has no web implementation, so it is required lazily and the map
// area falls back to a static notice on web. The free OpenFreeMap
// "Liberty" style is used, so no map API key is required.

let MapLibre: typeof import('@maplibre/maplibre-react-native') | null = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapLibre = require('@maplibre/maplibre-react-native');
}

const isMapSupported = Platform.OS !== 'web' && MapLibre !== null;

// Free vector style built on OpenStreetMap data (attribution is
// rendered on the map by MapLibre automatically).
const OSM_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Neutral fallback camera (India center) used before the user's
// location is known. This is only a map position, never hospital data.
const INITIAL_CAMERA_CENTER: [number, number] = [78.9629, 20.5937];
const INITIAL_CAMERA_ZOOM = 3.5;
const NEARBY_ZOOM = 13.5;

// ====================================================
// COLORS
// ====================================================

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',

  primaryGreen: '#39A78D',

  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',

  dangerRed: '#E2574C',

  background: '#EAF3F5',

  white: '#FFFFFF',

  mainText: '#1D2B33',
  secondaryText: '#71858D',

  border: '#D2E3E8',

  mapBackground: '#CDEBFA',
};

// ====================================================
// TYPES
// ====================================================

type Coords = {
  latitude: number;
  longitude: number;
};

type Hospital = {
  id: string;
  name: string;
  address: string;
  facilityType: string;
  phone: string;
  latitude: number;
  longitude: number;
  // Computed by the backend from the user's GPS origin via OSRM.
  // null when the routing service was unreachable.
  drivingDistanceKm?: number | null;
};

type LocationStatus =
  | 'idle'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'error';

// ====================================================
// DISTANCE HELPERS (haversine, no extra Google API)
// ====================================================

function haversineKm(from: Coords, to: Coords): number {
  const earthRadiusKm = 6371;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number | null): string {
  if (distanceKm == null) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

// ====================================================
// SCREEN
// ====================================================

export default function HospitalsScreen() {
  const router = useRouter();

  const { width } = useResponsiveDimensions();

  const isMobile = width < 600;

  const isTablet = width >= 600 && width < 900;

  const mapRef = useRef<any>(null);

  const cameraRef = useRef<any>(null);

  // Center of the last successful hospital query, so panning the map
  // only triggers a fresh search when the area actually changed.
  const lastQueryCenterRef = useRef<Coords | null>(null);

  const panSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );


  // ==================================================
  // FONTS
  // ==================================================

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,

    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });


  // ==================================================
  // LOCATION
  // ==================================================

  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>('idle');

  const [locationError, setLocationError] = useState('');

  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  // Latest GPS fix kept in a ref so hospital requests always carry a
  // fresh origin without waiting for a re-render.
  const userCoordsRef = useRef<Coords | null>(null);


  // ==================================================
  // HOSPITALS
  // ==================================================

  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  const [hospitalsError, setHospitalsError] = useState('');

  const [activeAreaLabel, setActiveAreaLabel] =
    useState('Discover hospitals near you');


  // ==================================================
  // SEARCH
  // ==================================================

  const [query, setQuery] = useState('');

  const [searching, setSearching] = useState(false);


  // ==================================================
  // SELECTED HOSPITAL (details card on the map)
  // ==================================================

  const [selectedHospitalId, setSelectedHospitalId] = useState<
    string | null
  >(null);


  // ==================================================
  // TOAST
  // ==================================================

  const [toastVisible, setToastVisible] = useState(false);

  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    setToastVisible(true);

    setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  }, []);


  // ==================================================
  // LOAD NEARBY HOSPITALS FROM THE BACKEND PROXY
  // ==================================================

  // Query param for the backend to compute driving distances from the
  // user's GPS position (OSRM). Empty when no fix is available.
  const originParams = (): string => {
    const origin = userCoordsRef.current;

    if (!origin) {
      return '';
    }

    return `&originLat=${origin.latitude}&originLng=${origin.longitude}`;
  };

  const loadNearbyHospitals = useCallback(
    async (coords: Coords, areaLabel = 'Hospitals near your location') => {
      setHospitalsLoading(true);
      setHospitalsError('');

      try {
        const response = await apiFetch(
          `/api/places/nearby?lat=${coords.latitude}&lng=${coords.longitude}&radius=5000${originParams()}`,
        );

        const data = await parseJson(response);

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load nearby hospitals');
        }

        setHospitals(data.hospitals || []);
        setActiveAreaLabel(areaLabel);
        lastQueryCenterRef.current = coords;
        setSelectedHospitalId(null);
      } catch (error) {
        console.log('Nearby hospitals error:', error);
        setHospitals([]);
        setHospitalsError(getApiErrorMessage(error));
      } finally {
        setHospitalsLoading(false);
      }
    },
    [],
  );

  const moveCameraTo = useCallback(
    (coords: Coords, zoom = NEARBY_ZOOM) => {
      if (!isMapSupported || !cameraRef.current) return;

      cameraRef.current.easeTo({
        center: [coords.longitude, coords.latitude],
        zoom,
        duration: 600,
      });
    },
    [],
  );


  // ==================================================
  // REQUEST PERMISSION + GET CURRENT LOCATION
  // ==================================================

  const locateUser = useCallback(async () => {
    setLocationStatus('locating');
    setLocationError('');

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationStatus('denied');
        setLocationError(
          'Location permission was denied. Search for a city instead, or allow location access in Settings.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      userCoordsRef.current = coords;
      setUserCoords(coords);
      setLocationStatus('granted');
      moveCameraTo(coords, 0.05);
      await loadNearbyHospitals(coords);
    } catch (error) {
      console.log('Location error:', error);
      setLocationStatus('error');
      setLocationError(
        'Could not determine your location. Search for a city instead.',
      );
    }
  }, [loadNearbyHospitals, moveCameraTo]);


  // ==================================================
  // SILENT GPS REFRESH (when returning to the screen)
  // ==================================================
  // Keeps distances accurate without reloading hospital data.

  const refreshGpsSilently = useCallback(async () => {
    try {
      const last = await Location.getLastKnownPositionAsync();

      if (last && Date.now() - last.timestamp < 60_000) {
        const coords: Coords = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        };
        userCoordsRef.current = coords;
        setUserCoords(coords);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      userCoordsRef.current = coords;
      setUserCoords(coords);
    } catch {
      // Keep the previous fix; permission may be missing here.
    }
  }, []);

  const hasLocatedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasLocatedRef.current) {
        hasLocatedRef.current = true;
        locateUser();
      } else {
        refreshGpsSilently();
      }
    }, [locateUser, refreshGpsSilently]),
  );


  // ==================================================
  // CITY / LOCATION SEARCH (manual fallback + feature)
  // ==================================================

  const searchLocation = useCallback(async () => {
    const area = query.trim();

    if (area.length < 2) {
      showToast('Enter a city or location name');
      return;
    }

    setSearching(true);
    setHospitalsError('');
    setHospitalsLoading(true);

    try {
      const response = await apiFetch(
        `/api/places/search?q=${encodeURIComponent(area)}${originParams()}`,
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to search hospitals');
      }

      const results: Hospital[] = data.hospitals || [];

      setHospitals(results);
      setActiveAreaLabel(`Hospitals in ${area}`);
      setSelectedHospitalId(null);

      // Remember the searched area so the map pan handler does not
      // immediately re-run a nearby search for the same region.
      if (results.length > 0) {
        lastQueryCenterRef.current = {
          latitude:
            results.reduce((sum, h) => sum + h.latitude, 0) / results.length,
          longitude:
            results.reduce((sum, h) => sum + h.longitude, 0) / results.length,
        };
      }

      if (results.length === 0) {
        showToast(`No hospitals found for ${area}`);
      } else if (isMapSupported && cameraRef.current) {
        if (results.length === 1) {
          cameraRef.current.easeTo({
            center: [results[0].longitude, results[0].latitude],
            zoom: NEARBY_ZOOM,
            duration: 600,
          });
        } else {
          // Frame all results on the map.
          const lats = results.map((hospital) => hospital.latitude);
          const lngs = results.map((hospital) => hospital.longitude);

          cameraRef.current.fitBounds(
            [
              Math.min(...lngs),
              Math.min(...lats),
              Math.max(...lngs),
              Math.max(...lats),
            ],
            { paddingTop: 60, paddingRight: 60, paddingBottom: 60, paddingLeft: 60 },
            600,
          );
        }
      }
    } catch (error) {
      console.log('Hospital search error:', error);
      setHospitals([]);
      setHospitalsError(getApiErrorMessage(error));
    } finally {
      setSearching(false);
      setHospitalsLoading(false);
    }
  }, [query, showToast]);


  // ==================================================
  // MAP PAN SEARCH (results follow the visible map area)
  // ==================================================

  const handleMapRegionChange = useCallback(
    (event: { nativeEvent?: { center?: unknown } }) => {
      const center = event?.nativeEvent?.center;

      let longitude: number | null = null;
      let latitude: number | null = null;

      if (Array.isArray(center) && center.length >= 2) {
        const lng = Number(center[0]);
        const lat = Number(center[1]);

        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          longitude = lng;
          latitude = lat;
        }
      } else if (center && typeof center === 'object') {
        const asObject = center as { lng?: unknown; lat?: unknown };
        const lng = Number(asObject.lng);
        const lat = Number(asObject.lat);

        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          longitude = lng;
          latitude = lat;
        }
      }

      if (longitude == null || latitude == null) {
        return;
      }

      // Wait until the first real query (GPS or manual search) has run,
      // otherwise the initial camera position would trigger a search.
      if (!lastQueryCenterRef.current) {
        return;
      }

      // Ignore small adjustments and camera animations we triggered.
      if (haversineKm(lastQueryCenterRef.current, { latitude, longitude }) < 1.5) {
        return;
      }

      if (hospitalsLoading || searching) {
        return;
      }

      if (panSearchTimerRef.current) {
        clearTimeout(panSearchTimerRef.current);
      }

      panSearchTimerRef.current = setTimeout(() => {
        panSearchTimerRef.current = null;
        loadNearbyHospitals(
          { latitude, longitude },
          'Hospitals in this area',
        );
      }, 1000);
    },
    [hospitalsLoading, searching, loadNearbyHospitals],
  );

  useEffect(() => {
    return () => {
      if (panSearchTimerRef.current) {
        clearTimeout(panSearchTimerRef.current);
        panSearchTimerRef.current = null;
      }
    };
  }, []);


  // ==================================================
  // DIRECTIONS
  // ==================================================

  const openDirections = useCallback(
    (hospital: Hospital) => {
      const destination = encodeURIComponent(
        `${hospital.latitude},${hospital.longitude}`,
      );

      const url =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

      Linking.openURL(url).catch(() => {
        showToast('Unable to open directions');
      });
    },
    [showToast],
  );


  // ==================================================
  // CALL
  // ==================================================

  const callHospital = useCallback(
    (hospital: Hospital) => {
      if (!hospital.phone) {
        showToast('No phone number available');
        return;
      }

      Linking.openURL(`tel:${hospital.phone}`).catch(() => {
        showToast('Unable to start a call');
      });
    },
    [showToast],
  );


  // ==================================================
  // DISTANCE + DERIVED DATA
  // ==================================================
  // The backend sorts hospitals by driving distance when the user's
  // GPS origin was available; straight-line is the fallback.

  const distanceFor = useCallback(
    (hospital: Hospital): number | null => {
      if (hospital.drivingDistanceKm != null) {
        return hospital.drivingDistanceKm;
      }

      if (!userCoords) return null;

      return haversineKm(userCoords, {
        latitude: hospital.latitude,
        longitude: hospital.longitude,
      });
    },
    [userCoords],
  );

  const selectedHospital = useMemo(() => {
    if (!selectedHospitalId) return null;

    return (
      hospitals.find((hospital) => hospital.id === selectedHospitalId) || null
    );
  }, [hospitals, selectedHospitalId]);


  // ==================================================
  // FONT CHECK
  // ==================================================

  if (!fontsLoaded) {
    return null;
  }


  // ==================================================
  // FACILITY TYPE ROW (from OpenStreetMap tags)
  // ==================================================

  const renderFacilityType = (hospital: Hospital) => {
    return (
      <Text style={styles.facilityTypeText}>
        {hospital.facilityType}
      </Text>
    );
  };


  // ==================================================
  // MAP AREA (markers + selected hospital card)
  // ==================================================

  const renderMap = () => {
    // Local copies so TypeScript can narrow the lazy module refs.
    const ActiveMap = MapLibre?.Map;
    const ActiveCamera = MapLibre?.Camera;
    const ActiveMarker = MapLibre?.Marker;
    const ActiveUserLocation = MapLibre?.UserLocation;

    if (!isMapSupported || !ActiveMap || !ActiveCamera || !ActiveMarker) {
      // Web fallback: hospital search and cards still work.
      return (
        <View
          style={[
            styles.map,
            styles.mapFallback,
            isMobile && styles.mapMobile,
          ]}
        >
          <Ionicons
            name="map-outline"
            size={44}
            color={COLORS.primaryBlue}
          />

          <Text style={styles.mapFallbackTitle}>
            Interactive map
          </Text>

          <Text style={styles.mapFallbackText}>
            The map is available in the Android and iOS apps. Hospital search still works here.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.map,
          isMobile && styles.mapMobile,
        ]}
      >
        <ActiveMap
          ref={mapRef}
          mapStyle={OSM_STYLE_URL}
          style={StyleSheet.absoluteFill}
          onRegionDidChange={handleMapRegionChange}
          onPress={() => setSelectedHospitalId(null)}
        >
          <ActiveCamera
            ref={cameraRef}
            initialViewState={{
              center: INITIAL_CAMERA_CENTER,
              zoom: INITIAL_CAMERA_ZOOM,
            }}
          />

          {locationStatus === 'granted' && ActiveUserLocation && (
            <ActiveUserLocation animated />
          )}

          {hospitals.map((hospital) => (
            <ActiveMarker
              key={hospital.id || `${hospital.latitude}-${hospital.longitude}`}
              id={hospital.id || `${hospital.latitude}-${hospital.longitude}`}
              lngLat={[hospital.longitude, hospital.latitude]}
              onPress={() => setSelectedHospitalId(hospital.id)}
            >
              <View
                style={[
                  styles.markerPin,

                  hospital.id === selectedHospitalId &&
                    styles.markerPinSelected,
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={COLORS.white}
                />
              </View>
            </ActiveMarker>
          ))}
        </ActiveMap>


        {/* LOCATION STATUS BADGE */}

        <View style={styles.locationBadge}>
          {locationStatus === 'locating' ? (
            <>
              <ActivityIndicator
                size="small"
                color={COLORS.primaryBlue}
              />

              <Text style={styles.locationText}>
                Finding your location...
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="location-outline"
                size={19}
                color={COLORS.primaryBlue}
              />

              <Text
                style={styles.locationText}
                numberOfLines={1}
              >
                {locationStatus === 'granted'
                  ? 'Showing hospitals near you'
                  : activeAreaLabel}
              </Text>
            </>
          )}
        </View>


        {/* RECENTER / RETRY LOCATION BUTTON */}

        <Pressable
          onPress={locateUser}
          disabled={locationStatus === 'locating'}
          style={styles.recenterButton}
        >
          <Ionicons
            name="locate"
            size={21}
            color={COLORS.primaryBlue}
          />
        </Pressable>


        {/* SELECTED HOSPITAL DETAILS CARD */}

        {selectedHospital && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsCardHeader}>
              <View style={styles.detailsCardIcon}>
                <Ionicons
                  name="business-outline"
                  size={22}
                  color={COLORS.primaryGreen}
                />
              </View>

              <View style={styles.detailsCardTitleArea}>
                <Text
                  style={styles.detailsCardName}
                  numberOfLines={2}
                >
                  {selectedHospital.name}
                </Text>

                {renderFacilityType(selectedHospital)}
              </View>

              <Pressable
                onPress={() => setSelectedHospitalId(null)}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {selectedHospital.address ? (
              <Text
                style={styles.detailsCardAddress}
                numberOfLines={2}
              >
                {selectedHospital.address}
              </Text>
            ) : null}

            <View style={styles.detailsCardMetaRow}>
              <Text style={styles.detailsCardDistance}>
                {formatDistance(distanceFor(selectedHospital))}
              </Text>

              <Text style={styles.detailsCardFacilityType}>
                {selectedHospital.facilityType}
              </Text>
            </View>

            <View style={styles.detailsCardActions}>
              {selectedHospital.phone ? (
                <Pressable
                  onPress={() => callHospital(selectedHospital)}
                  style={styles.detailsCardCall}
                >
                  <Ionicons
                    name="call-outline"
                    size={17}
                    color={COLORS.mainText}
                  />

                  <Text style={styles.detailsCardCallText}>
                    Call
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => openDirections(selectedHospital)}
                style={[
                  styles.detailsCardDirections,
                  !selectedHospital.phone &&
                    styles.detailsCardDirectionsFull,
                ]}
              >
                <Ionicons
                  name="navigate-outline"
                  size={17}
                  color={COLORS.white}
                />

                <Text style={styles.detailsCardDirectionsText}>
                  Get Directions
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };


  // ==================================================
  // HOSPITAL CARD
  // ==================================================

  const renderHospital = (hospital: Hospital) => {
    return (
      <Pressable
        key={hospital.id || `${hospital.latitude}-${hospital.longitude}`}
        style={[
          styles.hospitalCard,

          isMobile && styles.hospitalCardMobile,

          hospital.id === selectedHospitalId &&
            styles.hospitalCardSelected,
        ]}
        onPress={() => {
          setSelectedHospitalId(hospital.id);
          moveCameraTo(
            { latitude: hospital.latitude, longitude: hospital.longitude },
            0.03,
          );
        }}
      >

        {/* ------------------------------------------ */}
        {/* HOSPITAL HEADER */}
        {/* ------------------------------------------ */}

        <View style={styles.hospitalHeader}>

          <View style={styles.hospitalIcon}>
            <Ionicons
              name="business-outline"
              size={28}
              color={COLORS.primaryGreen}
            />
          </View>


          <View style={styles.hospitalTitleArea}>

            <Text
              style={[
                styles.hospitalName,

                isMobile && styles.hospitalNameMobile,
              ]}
              numberOfLines={2}
            >
              {hospital.name}
            </Text>


            <View style={styles.hospitalMetaRow}>
              <Text style={styles.distance}>
                {formatDistance(distanceFor(hospital))}
              </Text>

              <Text style={styles.hospitalType}>
                {hospital.facilityType}
              </Text>
            </View>

          </View>

        </View>


        {/* ------------------------------------------ */}
        {/* PHONE */}
        {/* ------------------------------------------ */}

        {hospital.phone ? (
          <View style={styles.phoneRow}>

            <Ionicons
              name="call-outline"
              size={17}
              color={COLORS.secondaryText}
            />

            <Text style={styles.phoneText}>
              {hospital.phone}
            </Text>

          </View>
        ) : null}


        {/* ------------------------------------------ */}
        {/* ADDRESS */}
        {/* ------------------------------------------ */}

        <View style={styles.addressRow}>

          <Ionicons
            name="location-outline"
            size={18}
            color={COLORS.secondaryText}
          />

          <Text style={styles.addressText}>
            {hospital.address || 'Address unavailable'}
          </Text>

        </View>


        {/* ------------------------------------------ */}
        {/* ACTIONS */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.cardActions,

            isMobile && styles.cardActionsMobile,
          ]}
        >

          {hospital.phone ? (
            <Pressable
              onPress={() => callHospital(hospital)}

              style={[
                styles.callButton,

                isMobile && styles.actionButtonMobile,
              ]}
            >

              <Ionicons
                name="call-outline"
                size={19}
                color={COLORS.mainText}
              />

              <Text style={styles.callButtonText}>
                Call
              </Text>

            </Pressable>
          ) : null}


          <Pressable
            onPress={() => openDirections(hospital)}

            style={[
              styles.directionButton,

              !hospital.phone && styles.detailsCardDirectionsFull,

              isMobile && styles.actionButtonMobile,
            ]}
          >

            <Ionicons
              name="navigate-outline"
              size={19}
              color={COLORS.white}
            />

            <Text style={styles.directionButtonText}>
              Directions
            </Text>

          </Pressable>

        </View>

      </Pressable>
    );
  };


  // ==================================================
  // RETURN
  // ==================================================

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ============================================ */}
      {/* HEADER (shared across all screens) */}
      {/* ============================================ */}

      <AppHeader />


      {/* ============================================ */}
      {/* MAIN SCROLL */}
      {/* ============================================ */}

      <ScrollView
        style={styles.scrollView}

        contentContainerStyle={[
          styles.scrollContent,

          isMobile && styles.scrollContentMobile,
        ]}

        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ========================================== */}
        {/* PAGE TITLE */}
        {/* ========================================== */}

        <View style={styles.pageHeader}>

          <Text
            style={[
              styles.pageTitle,

              isMobile && styles.pageTitleMobile,
            ]}
          >
            Nearby Hospitals
          </Text>


          <Text
            style={[
              styles.pageSubtitle,

              isMobile && styles.pageSubtitleMobile,
            ]}
          >
            {activeAreaLabel}
          </Text>

        </View>


        {/* ========================================== */}
        {/* SEARCH (filter list; submit = city search) */}
        {/* ========================================== */}

        <View
          style={[
            styles.searchContainer,

            isMobile && styles.searchContainerMobile,
          ]}
        >

          <Ionicons
            name="search-outline"
            size={25}
            color={COLORS.secondaryText}
          />


          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchLocation}

            placeholder="Search a city, area or hospital..."

            placeholderTextColor={COLORS.secondaryText}

            style={styles.searchInput}

            returnKeyType="search"
            autoCorrect={false}
          />


          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>

              <Ionicons
                name="close-circle"
                size={22}
                color={COLORS.secondaryText}
              />

            </Pressable>
          )}


          <Pressable
            onPress={searchLocation}
            disabled={searching}
            style={styles.searchGoButton}
          >
            {searching ? (
              <ActivityIndicator
                size="small"
                color={COLORS.white}
              />
            ) : (
              <Text style={styles.searchGoText}>
                Search
              </Text>
            )}
          </Pressable>

        </View>


        {/* ========================================== */}
        {/* MAP */}
        {/* ========================================== */}

        {renderMap()}


        {/* ========================================== */}
        {/* LOCATION ERRORS */}
        {/* ========================================== */}

        {(locationStatus === 'denied' || locationStatus === 'error') && (
          <View style={styles.noticeBox}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={COLORS.primaryBlue}
            />

            <Text style={styles.noticeText}>
              {locationError}
            </Text>

            <Pressable onPress={locateUser}>
              <Text style={styles.noticeAction}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}


        {/* ========================================== */}
        {/* HOSPITAL CARDS */}
        {/* ========================================== */}

        {hospitalsLoading ? (

          <View style={styles.stateBox}>
            <ActivityIndicator
              size="large"
              color={COLORS.primaryBlue}
            />

            <Text style={styles.stateText}>
              Finding hospitals...
            </Text>
          </View>

        ) : hospitalsError ? (

          <View style={styles.stateBox}>

            <Ionicons
              name="alert-circle-outline"
              size={44}
              color={COLORS.dangerRed}
            />

            <Text style={styles.stateTitle}>
              Something went wrong
            </Text>

            <Text style={styles.stateText}>
              {hospitalsError}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                if (userCoords) {
                  loadNearbyHospitals(userCoords);
                } else {
                  locateUser();
                }
              }}
            >
              <Text style={styles.retryButtonText}>
                Try again
              </Text>
            </Pressable>

          </View>

        ) : hospitals.length > 0 ? (

          <View
            style={[
              styles.hospitalGrid,

              isMobile && styles.hospitalGridMobile,

              isTablet && styles.hospitalGridTablet,
            ]}
          >

            {hospitals.map(renderHospital)}

          </View>

        ) : (

          /* NO RESULTS */

          <View style={styles.noResults}>

            <Ionicons
              name="search-outline"
              size={50}
              color={COLORS.secondaryText}
            />

            <Text style={styles.noResultsTitle}>
              No hospitals found
            </Text>

            <Text style={styles.noResultsText}>
              {locationStatus === 'granted'
                ? 'No hospitals found in this area. Try moving the map or searching for a city.'
                : 'Search for a city or move the map to find hospitals.'}
            </Text>

          </View>

        )}


        <View style={{ height: 100 }} />

      </ScrollView>


      {/* ============================================ */}
      {/* BOTTOM NAV */}
      {/* ============================================ */}

      <View
        style={[
          styles.bottomNav,

          isMobile && styles.bottomNavMobile,

          !isMobile && styles.bottomNavDesktop,
        ]}
      >

        <BottomTab
          icon="home-outline"
          label="Home"
          onPress={() => router.push('/home')}
        />


        <BottomTab
          icon="medical-outline"
          label="Medicines"
          onPress={() => router.push('/medicines')}
        />


        <BottomTab
          icon="calendar-outline"
          label="Appointments"
          onPress={() => router.push('/appointments')}
        />


        <BottomTab
          icon="person-outline"
          label="Profile"
          onPress={() => router.push('/profile')}
        />

      </View>


      {/* ============================================ */}
      {/* TOAST */}
      {/* ============================================ */}

      {toastVisible && (
        <View
          style={[
            styles.toast,

            isMobile && styles.toastMobile,
          ]}
        >

          <View style={styles.toastIcon}>

            <Ionicons
              name="checkmark"
              size={15}
              color={COLORS.white}
            />

          </View>


          <Text style={styles.toastText}>
            {toastMessage}
          </Text>

        </View>
      )}

    </SafeAreaView>
  );
}


// ====================================================
// BOTTOM TAB COMPONENT
// ====================================================

const BottomTab = ({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  label: string;

  active?: boolean;

  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bottomTab,

        active && styles.bottomTabActive,
      ]}
    >

      <Ionicons
        name={icon}
        size={22}
        color={
          active
            ? COLORS.primaryBlue
            : COLORS.secondaryText
        }
      />

      <Text
        style={[
          styles.bottomTabText,

          active && styles.bottomTabTextActive,
        ]}
      >
        {label}
      </Text>

    </Pressable>
  );
};


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  // ==================================================
  // SCREEN
  // ==================================================

  screen: {
    flex: 1,

    backgroundColor: COLORS.background,
  },


  scrollView: {
    flex: 1,
  },


  scrollContent: {
    paddingHorizontal: 34,

    paddingTop: 30,
  },


  scrollContentMobile: {
    paddingHorizontal: 16,

    paddingTop: 22,
  },


  // ==================================================
  // HEADER
  // ==================================================

  topHeader: {
    height: 84,

    backgroundColor: COLORS.white,

    borderBottomWidth: 1,

    borderBottomColor: COLORS.border,

    paddingHorizontal: 32,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },


  welcomeText: {
    fontFamily: 'Inter_500Medium',

    fontSize: 17,

    color: COLORS.secondaryText,

    flex: 1,
  },


  headerRight: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 22,
  },


  notificationIcon: {
    position: 'relative',
  },


  avatar: {
    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor: COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent: 'center',

    overflow: 'hidden',
  },


  avatarPhoto: {
    width: 48,

    height: 48,
  },


  avatarText: {
    color: COLORS.white,

    fontFamily: 'Poppins_700Bold',

    fontSize: 17,
  },


  // ==================================================
  // PAGE HEADER
  // ==================================================

  pageHeader: {
    marginBottom: 28,
  },


  pageTitle: {
    fontFamily: 'Poppins_700Bold',

    fontSize: 36,

    color: COLORS.mainText,
  },


  pageTitleMobile: {
    fontSize: 29,
  },


  pageSubtitle: {
    fontFamily: 'Inter_400Regular',

    fontSize: 18,

    color: COLORS.secondaryText,

    marginTop: 2,
  },


  pageSubtitleMobile: {
    fontSize: 15,
  },


  // ==================================================
  // SEARCH
  // ==================================================

  searchContainer: {
    height: 57,

    backgroundColor: COLORS.white,

    borderRadius: 7,

    borderWidth: 1,

    borderColor: COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 15,

    gap: 8,

    marginBottom: 23,

    elevation: 2,
  },


  searchContainerMobile: {
    height: 52,
  },


  searchInput: {
    flex: 1,

    fontFamily: 'Inter_400Regular',

    fontSize: 16,

    color: COLORS.mainText,
  },


  searchGoButton: {
    height: 40,

    paddingHorizontal: 14,

    borderRadius: 7,

    backgroundColor: COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent: 'center',
  },


  searchGoText: {
    fontFamily: 'Inter_700Bold',

    fontSize: 14,

    color: COLORS.white,
  },


  // ==================================================
  // MAP
  // ==================================================

  map: {
    height: 338,

    width: '100%',

    backgroundColor: COLORS.mapBackground,

    borderRadius: 9,

    borderWidth: 1,

    borderColor: '#C4DFEA',

    overflow: 'hidden',

    position: 'relative',

    marginBottom: 28,
  },


  mapMobile: {
    height: 300,
  },


  // ==================================================
  // MAP MARKERS (MapLibre Marker views)
  // ==================================================

  markerPin: {
    width: 42,

    height: 42,

    borderRadius: 21,

    backgroundColor: COLORS.primaryBlue,

    borderWidth: 2,

    borderColor: COLORS.white,

    alignItems: 'center',

    justifyContent: 'center',

    elevation: 5,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 3 },

    shadowOpacity: 0.2,

    shadowRadius: 5,
  },


  markerPinSelected: {
    backgroundColor: COLORS.primaryGreen,
  },


  mapFallback: {
    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    padding: 24,
  },


  mapFallbackTitle: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 17,

    color: COLORS.mainText,
  },


  mapFallbackText: {
    fontFamily: 'Inter_400Regular',

    fontSize: 13,

    color: COLORS.secondaryText,

    textAlign: 'center',
  },


  // ==================================================
  // MAP OVERLAYS
  // ==================================================

  locationBadge: {
    position: 'absolute',

    bottom: 18,

    left: 18,

    right: 74,

    backgroundColor: COLORS.white,

    borderRadius: 9,

    paddingVertical: 10,

    paddingHorizontal: 15,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    elevation: 4,
  },


  locationText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.mainText,

    flexShrink: 1,
  },


  recenterButton: {
    position: 'absolute',

    bottom: 18,

    right: 18,

    width: 44,

    height: 44,

    borderRadius: 22,

    backgroundColor: COLORS.white,

    alignItems: 'center',

    justifyContent: 'center',

    elevation: 4,
  },


  // ==================================================
  // SELECTED HOSPITAL DETAILS CARD
  // ==================================================

  detailsCard: {
    position: 'absolute',

    top: 12,

    left: 12,

    right: 12,

    backgroundColor: COLORS.white,

    borderRadius: 12,

    borderWidth: 1,

    borderColor: COLORS.border,

    padding: 14,

    elevation: 6,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 3 },

    shadowOpacity: 0.15,

    shadowRadius: 8,
  },


  detailsCardHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
  },


  detailsCardIcon: {
    width: 44,

    height: 44,

    borderRadius: 9,

    backgroundColor: COLORS.lightGreen,

    alignItems: 'center',

    justifyContent: 'center',
  },


  detailsCardTitleArea: {
    flex: 1,
  },


  detailsCardName: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 16,

    color: COLORS.mainText,
  },


  detailsCardAddress: {
    fontFamily: 'Inter_400Regular',

    fontSize: 13,

    color: COLORS.secondaryText,

    marginTop: 8,
  },


  detailsCardMetaRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 14,

    marginTop: 8,
  },


  detailsCardDistance: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.primaryBlue,
  },


  detailsCardActions: {
    flexDirection: 'row',

    gap: 10,

    marginTop: 12,
  },


  detailsCardCall: {
    height: 42,

    paddingHorizontal: 18,

    borderRadius: 7,

    backgroundColor: '#E1F2F6',

    borderWidth: 1,

    borderColor: '#CDE3E8',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,
  },


  detailsCardCallText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.mainText,
  },


  detailsCardDirections: {
    flex: 1,

    height: 42,

    borderRadius: 7,

    backgroundColor: COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,
  },


  detailsCardDirectionsFull: {
    flex: 1,
  },


  detailsCardDirectionsText: {
    fontFamily: 'Inter_700Bold',

    fontSize: 14,

    color: COLORS.white,
  },


  // ==================================================
  // FACILITY TYPE (from OpenStreetMap tags)
  // ==================================================

  facilityTypeText: {
    fontFamily: 'Inter_500Medium',

    fontSize: 12,

    color: COLORS.primaryGreen,
  },


  detailsCardFacilityType: {
    fontFamily: 'Inter_500Medium',

    fontSize: 13,

    color: COLORS.primaryGreen,
  },


  hospitalType: {
    fontFamily: 'Inter_500Medium',

    fontSize: 13,

    color: COLORS.primaryGreen,
  },


  phoneRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    marginBottom: 16,
  },


  phoneText: {
    fontFamily: 'Inter_400Regular',

    fontSize: 15,

    color: COLORS.secondaryText,
  },


  // ==================================================
  // NOTICE / STATE BOXES
  // ==================================================

  noticeBox: {
    backgroundColor: COLORS.lightBlue,

    borderRadius: 9,

    borderWidth: 1,

    borderColor: '#C9E4F2',

    padding: 14,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    marginBottom: 20,
  },


  noticeText: {
    flex: 1,

    fontFamily: 'Inter_400Regular',

    fontSize: 13,

    color: COLORS.mainText,
  },


  noticeAction: {
    fontFamily: 'Inter_700Bold',

    fontSize: 13,

    color: COLORS.primaryBlue,
  },


  stateBox: {
    backgroundColor: COLORS.white,

    borderRadius: 10,

    borderWidth: 1,

    borderColor: COLORS.border,

    paddingVertical: 56,

    paddingHorizontal: 24,

    alignItems: 'center',

    justifyContent: 'center',

    gap: 10,
  },


  stateTitle: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 18,

    color: COLORS.mainText,
  },


  stateText: {
    fontFamily: 'Inter_400Regular',

    fontSize: 14,

    color: COLORS.secondaryText,

    textAlign: 'center',
  },


  retryButton: {
    marginTop: 8,

    height: 46,

    paddingHorizontal: 28,

    borderRadius: 8,

    backgroundColor: COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent: 'center',
  },


  retryButtonText: {
    fontFamily: 'Inter_700Bold',

    fontSize: 15,

    color: COLORS.white,
  },


  // ==================================================
  // HOSPITAL GRID
  // ==================================================

  hospitalGrid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 20,
  },


  hospitalGridMobile: {
    flexDirection: 'column',

    gap: 16,
  },


  hospitalGridTablet: {
    gap: 14,
  },


  // ==================================================
  // HOSPITAL CARD
  // ==================================================

  hospitalCard: {
    flex: 1,

    minWidth: 290,

    backgroundColor: COLORS.white,

    borderRadius: 9,

    borderWidth: 1,

    borderColor: COLORS.border,

    padding: 24,

    elevation: 2,
  },


  hospitalCardMobile: {
    width: '100%',

    minWidth: 0,

    padding: 18,
  },


  hospitalCardSelected: {
    borderColor: COLORS.primaryBlue,

    borderWidth: 2,
  },


  // ==================================================
  // HOSPITAL HEADER
  // ==================================================

  hospitalHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 14,
  },


  hospitalIcon: {
    width: 58,

    height: 58,

    borderRadius: 9,

    backgroundColor: COLORS.lightGreen,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 14,
  },


  hospitalTitleArea: {
    flex: 1,
  },


  hospitalName: {
    fontFamily: 'Poppins_700Bold',

    fontSize: 19,

    color: COLORS.mainText,

    marginBottom: 3,
  },


  hospitalNameMobile: {
    fontSize: 17,
  },


  hospitalMetaRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,
  },


  distance: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.primaryBlue,
  },


  // ==================================================
  // ADDRESS
  // ==================================================

  addressRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    marginBottom: 21,
  },


  addressText: {
    fontFamily: 'Inter_400Regular',

    fontSize: 15,

    color: COLORS.secondaryText,

    flex: 1,
  },


  // ==================================================
  // ACTIONS
  // ==================================================

  cardActions: {
    flexDirection: 'row',

    gap: 10,
  },


  cardActionsMobile: {
    gap: 9,
  },


  callButton: {
    flex: 1,

    height: 52,

    borderRadius: 7,

    backgroundColor: '#E1F2F6',

    borderWidth: 1,

    borderColor: '#CDE3E8',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,
  },


  directionButton: {
    flex: 1,

    height: 52,

    borderRadius: 7,

    backgroundColor: COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    elevation: 2,
  },


  actionButtonMobile: {
    height: 48,
  },


  callButtonText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 15,

    color: COLORS.mainText,
  },


  directionButtonText: {
    fontFamily: 'Inter_700Bold',

    fontSize: 15,

    color: COLORS.white,
  },


  // ==================================================
  // NO RESULTS
  // ==================================================

  noResults: {
    backgroundColor: COLORS.white,

    borderRadius: 10,

    borderWidth: 1,

    borderColor: COLORS.border,

    paddingVertical: 70,

    alignItems: 'center',

    justifyContent: 'center',
  },


  noResultsTitle: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 20,

    color: COLORS.mainText,

    marginTop: 12,
  },


  noResultsText: {
    fontFamily: 'Inter_400Regular',

    fontSize: 14,

    color: COLORS.secondaryText,

    marginTop: 5,

    textAlign: 'center',

    paddingHorizontal: 30,
  },


  // ==================================================
  // BOTTOM NAV
  // ==================================================

  bottomNav: {
    height: 72,

    backgroundColor: COLORS.white,

    borderTopWidth: 1,

    borderTopColor: COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-around',

    paddingHorizontal: 25,
  },


  bottomNavMobile: {
    height: 68,

    paddingHorizontal: 8,
  },


  bottomNavDesktop: {
    width: '100%',

    maxWidth: 720,

    alignSelf: 'center',

    height: 64,

    marginTop: 10,

    marginBottom: 14,

    paddingHorizontal: 12,

    borderTopWidth: 0,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 16,
  },


  bottomTab: {
    minWidth: 80,

    alignItems: 'center',

    justifyContent: 'center',

    gap: 3,

    paddingVertical: 5,
  },


  bottomTabActive: {
    backgroundColor: '#E5F2F9',

    borderRadius: 10,
  },


  bottomTabText: {
    fontFamily: 'Inter_500Medium',

    fontSize: 11,

    color: COLORS.secondaryText,
  },


  bottomTabTextActive: {
    fontFamily: 'Inter_700Bold',

    color: COLORS.primaryBlue,
  },


  // ==================================================
  // TOAST
  // ==================================================

  toast: {
    position: 'absolute',

    top: 28,

    alignSelf: 'center',

    backgroundColor: COLORS.white,

    borderRadius: 11,

    paddingVertical: 15,

    paddingHorizontal: 21,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.15,

    shadowRadius: 10,

    elevation: 10,

    zIndex: 9999,
  },


  toastMobile: {
    top: 15,

    left: 16,

    right: 16,

    alignSelf: 'auto',
  },


  toastIcon: {
    width: 23,

    height: 23,

    borderRadius: 12,

    backgroundColor: '#1D1D1D',

    alignItems: 'center',

    justifyContent: 'center',
  },


  toastText: {
    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    color: COLORS.mainText,
  },
});
