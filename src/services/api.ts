// The API URL is intentionally not hard-coded. Set EXPO_PUBLIC_API_URL in
// .env (e.g. http://<PC-LAN-IP>:5000 for a local device or your own tunnel).
const DEFAULT_TIMEOUT_MS = 20000;

export type ApiErrorKind =
  | 'config'
  | 'network'
  | 'timeout'
  | 'http'
  | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly url: string;
  readonly status?: number;
  readonly contentType?: string;
  readonly detail?: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    details: {
      url: string;
      status?: number;
      contentType?: string;
      detail?: string;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.url = details.url;
    this.status = details.status;
    this.contentType = details.contentType;
    this.detail = details.detail;
  }
}

type BaseUrlSource = 'env';

interface BaseUrlResolution {
  baseUrl: string;
  error: string | null;
  source: BaseUrlSource;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveBaseUrl(value: string, source: BaseUrlSource): BaseUrlResolution {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      baseUrl: '',
      error: 'EXPO_PUBLIC_API_URL is empty.',
      source,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      baseUrl: '',
      error: `EXPO_PUBLIC_API_URL is not a valid URL: "${trimmed}".`,
      source,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      baseUrl: '',
      error: `EXPO_PUBLIC_API_URL must use http:// or https:// (received "${parsed.protocol}").`,
      source,
    };
  }

  const isIpv6Literal = parsed.hostname.startsWith('[');
  const isValidHostname =
    parsed.hostname.length > 0 &&
    parsed.hostname.length <= 253 &&
    (isIpv6Literal ||
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
        parsed.hostname,
      ));

  if (!isValidHostname) {
    return {
      baseUrl: '',
      error: `EXPO_PUBLIC_API_URL does not contain a valid hostname: "${parsed.hostname}".`,
      source,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      baseUrl: '',
      error: 'EXPO_PUBLIC_API_URL must not contain embedded credentials.',
      source,
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      baseUrl: '',
      error: 'EXPO_PUBLIC_API_URL must not contain a query string or fragment.',
      source,
    };
  }

  const path = stripTrailingSlashes(parsed.pathname);

  return {
    baseUrl: `${parsed.protocol}//${parsed.host}${path}`,
    error: null,
    source,
  };
}

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL;
const hasConfiguredApiBaseUrl =
  typeof configuredApiBaseUrl === 'string' &&
  configuredApiBaseUrl.trim().length > 0;

// No configured URL is a hard config error: the app must know where the
// backend lives and never falls back to a stale hard-coded tunnel URL.
const resolution = hasConfiguredApiBaseUrl
  ? resolveBaseUrl(configuredApiBaseUrl as string, 'env')
  : {
      baseUrl: '',
      error:
        'EXPO_PUBLIC_API_URL is not set. Add it to your .env file (e.g. EXPO_PUBLIC_API_URL=http://<your-backend-host>:5000) and restart Expo with a cleared cache.',
      source: 'env' as const,
    };

export const API_BASE_URL = resolution.baseUrl;
export const API_CONFIG_ERROR = resolution.error;

// Diagnostics only. Never logs bodies, passwords, tokens or auth headers.
const API_DEBUG = process.env.NODE_ENV !== 'production';

function logApi(message: string): void {
  if (API_DEBUG) {
    console.log(`[api] ${message}`);
  }
}

if (API_DEBUG) {
  if (resolution.error) {
    console.error(`[api] ${resolution.error}`);
  } else {
    console.log(`[api] Base URL (EXPO_PUBLIC_API_URL): ${API_BASE_URL}`);
  }
}

function joinApiPath(baseUrl: string, path: string): string {
  // If the path is already an absolute URL, return it as-is so callers
  // (e.g. profile photo URLs) are never double-prefixed with the API base.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const suffix = path.startsWith('/') ? path : `/${path}`;
  let base = baseUrl;

  // The app calls routes such as /api/auth/login. If EXPO_PUBLIC_API_URL was
  // configured with an /api or /auth suffix, avoid producing /api/api or
  // /auth/auth in the final URL.
  for (const segment of ['/api', '/auth']) {
    const lowerBase = base.toLowerCase();
    const lowerSuffix = suffix.toLowerCase();

    if (lowerBase.endsWith(segment) && lowerSuffix.startsWith(`${segment}/`)) {
      base = base.slice(0, -segment.length);
    }
  }

  return `${base}${suffix}`;
}

export function apiUrl(path: string): string {
  return joinApiPath(API_BASE_URL, path);
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = apiUrl(path);
  const method = (init.method ?? 'GET').toUpperCase();

  if (API_CONFIG_ERROR) {
    logApi(`${method} ${url} -> CONFIG ERROR: ${API_CONFIG_ERROR}`);
    throw new ApiError('config', API_CONFIG_ERROR, { url });
  }

  const headers = new Headers(init.headers);

  if (!headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  logApi(`${method} ${url}`);

  const controller = new AbortController();
  const externalSignal = init.signal ?? undefined;
  const onExternalAbort = () => controller.abort();
  let didTimeout = false;

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    const details = error as {
      name?: string;
      message?: string;
      code?: string;
      cause?: { name?: string; message?: string; code?: string };
    };

    if (didTimeout || details?.name === 'AbortError') {
      logApi(
        `${method} ${url} -> TIMEOUT (${DEFAULT_TIMEOUT_MS}ms) name=${
          details?.name ?? 'unknown'
        }`,
      );
      throw new ApiError(
        'timeout',
        `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`,
        { url },
      );
    }

    const reason = error instanceof Error ? error.message : String(error);
    const errorCode = details?.code ?? details?.cause?.code ?? 'none';
    const errorMessage = [details?.message ?? reason, details?.cause?.message]
      .filter(Boolean)
      .join(' | ');

    logApi(
      `${method} ${url} -> NETWORK ERROR name=${details?.name ?? 'unknown'} code=${errorCode} message=${errorMessage}`,
    );
    throw new ApiError('network', `Network request failed for ${url}`, {
      url,
      detail: errorMessage,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  const contentType = response.headers.get('content-type') ?? '';
  logApi(
    `${method} ${url} -> ${response.status}${response.ok ? '' : ' (error)'} ${
      contentType || 'no content-type'
    } (final ${response.url || url})`,
  );

  return response;
}

export async function parseJson<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const url = response.url || API_BASE_URL;

  const body = await readText(response);

  if (!response.ok && !contentType.includes('application/json')) {
    logApi(`HTTP ${response.status} non-JSON response from ${url}`);
    throw new ApiError(
      'http',
      `Server returned ${response.status} ${contentType || 'without a JSON body'}`,
      { url, status: response.status, contentType },
    );
  }

  if (!body) {
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const looksLikeHtml = /^\s*</.test(body);
    logApi(`PARSE ERROR from ${url} (${contentType || 'unknown content type'})`);
    throw new ApiError(
      'parse',
      looksLikeHtml
        ? `Expected JSON but received an HTML page from ${url}`
        : `Received invalid JSON from ${url}`,
      { url, status: response.status, contentType },
    );
  }
}

async function readText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'config':
        return 'The app cannot reach the server because its API URL is not configured correctly. Please contact support.';
      case 'network': {
        const host = hostFromUrl(error.url);
        const looksLikeDnsFailure =
          typeof error.detail === 'string' &&
          /(resolve host|ENOTFOUND|EAI_AGAIN|nodename nor servname)/i.test(
            error.detail,
          );

        if (looksLikeDnsFailure) {
          return `The server hostname${host ? ` (${host})` : ''} could not be resolved. Check your internet connection, disable any DNS blocker or VPN, or try a different Wi-Fi/mobile network.`;
        }

        return `Cannot reach the server${host ? ` at ${host}` : ''}. Check your internet connection and that the server is online.`;
      }
      case 'timeout':
        return 'The server took too long to respond. Check your connection and try again.';
      case 'http':
        if (error.status === 400) {
          return 'The server rejected the request (400). Please check your details.';
        }
        if (error.status === 401) {
          return 'The server rejected the request as unauthorized (401).';
        }
        if (error.status === 404) {
          return 'The requested server endpoint was not found (404). Please check the API URL.';
        }
        if (error.status !== undefined && error.status >= 500) {
          return `The server encountered an error (${error.status}). Please try again later.`;
        }
        return `The server responded with an error (status ${error.status ?? 'unknown'}). Please try again.`;
      case 'parse':
        return 'The server returned an unexpected response. Please try again.';
      default:
        break;
    }
  }
  return 'Something went wrong. Please try again.';
}
