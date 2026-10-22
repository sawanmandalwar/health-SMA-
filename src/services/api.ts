console.log('API SERVICE FILE LOADED');

const DEFAULT_API_BASE_URL = 'https://send-untapped-rippling.ngrok-free.dev';
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (
  configuredApiBaseUrl || DEFAULT_API_BASE_URL
).replace(/\/+$/, '');
console.log(
  'Health-Saathi API URL:',
  API_BASE_URL,
  configuredApiBaseUrl ? '(from EXPO_PUBLIC_API_URL)' : '(default ngrok URL)',
);

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly url: string;
  readonly status?: number;
  readonly contentType?: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    details: { url: string; status?: number; contentType?: string },
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.url = details.url;
    this.status = details.status;
    this.contentType = details.contentType;
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// TEMPORARY diagnostics. Logs only method, URL, status and error category.
// Never logs request/response bodies, passwords, or auth tokens.
const API_DEBUG = process.env.NODE_ENV !== 'production';

function logApi(message: string): void {
  if (API_DEBUG) {
    console.log(`[api] ${message}`);
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = apiUrl(path);
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (!headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  logApi(`${method} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    const details = error as {
      name?: string;
      message?: string;
      code?: string;
    };
    const reason = error instanceof Error ? error.message : String(error);
    logApi(
      `${method} ${url} -> NETWORK ERROR name=${details?.name ?? 'unknown'} code=${
        details?.code ?? 'none'
      } message=${details?.message ?? reason}`,
    );
    throw new ApiError('network', `Network request failed for ${url}`, { url });
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

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return 'Cannot reach the server. Check your internet connection and that the backend is running.';
      case 'timeout':
        return 'The server took too long to respond. Please try again.';
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
