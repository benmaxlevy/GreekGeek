import {
  AccessTokenResponseSchema,
  AuthTokensResponseSchema,
  LogoutResponseSchema,
  OrganizationListSchema,
  PublicUserSchema,
  SignupResponseSchema,
  UniversityListSchema,
  type AuthTokensResponse,
  type LoginRequest,
  type OrganizationList,
  type PublicUser,
  type SignupRequest,
  type SignupResponse,
  type UniversityList,
} from '@rally/contracts';
import { getAccessToken, setAccessToken } from './auth-token';

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = AccessTokenResponseSchema.parse(await res.json());
      setAccessToken(data.accessToken);
      return data.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiFetch(input: string, init: RequestInit = {}, replay = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status !== 401 || !replay || input.includes('/api/auth/refresh')) {
    return res;
  }

  const nextToken = await refreshAccessToken();
  if (!nextToken) {
    return res;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${nextToken}`);
  if (init.body && !retryHeaders.has('Content-Type')) {
    retryHeaders.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  });
}

export async function loginRequest(body: LoginRequest): Promise<AuthTokensResponse> {
  const res = await apiFetch(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    false,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Login failed'));
  }
  const data = AuthTokensResponseSchema.parse(await res.json());
  setAccessToken(data.accessToken);
  return data;
}

export async function signupRequest(body: SignupRequest): Promise<SignupResponse> {
  const res = await apiFetch(
    '/api/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    false,
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Signup failed'));
  }
  // Signup does not issue session tokens — clear any stale in-memory token.
  setAccessToken(null);
  return SignupResponseSchema.parse(await res.json());
}

/** Public catalog — no auth required. */
export async function listPublicUniversities(): Promise<UniversityList> {
  const res = await apiFetch('/api/universities', {}, false);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list universities'));
  }
  return UniversityListSchema.parse(await res.json());
}

/** Public catalog filtered by university — no auth required. */
export async function listPublicOrganizations(
  universityId: string,
): Promise<OrganizationList> {
  const search = new URLSearchParams({ universityId });
  const res = await apiFetch(`/api/organizations?${search.toString()}`, {}, false);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to list organizations'));
  }
  return OrganizationListSchema.parse(await res.json());
}

export async function logoutRequest(): Promise<void> {
  const res = await apiFetch(
    '/api/auth/logout',
    { method: 'POST' },
    false,
  );
  setAccessToken(null);
  if (!res.ok) {
    throw new Error(await readError(res, 'Logout failed'));
  }
  LogoutResponseSchema.parse(await res.json());
}

export async function fetchMe(): Promise<PublicUser | null> {
  if (!getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }
  }

  const res = await apiFetch('/api/auth/me');
  if (res.status === 401) {
    setAccessToken(null);
    return null;
  }
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load session'));
  }
  return PublicUserSchema.parse(await res.json());
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
  } catch {
    // ignore parse errors
  }
  return `${fallback} (${res.status})`;
}

export { readError };
