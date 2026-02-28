// If not unique, it will still succeed, but there will be an error in '.processed.errors[0]'
export type ApiError = {
  error: { key: string; message: string; hint: string | null };
};

declare const tag: unique symbol;
type SID = string & { readonly [tag]: "SID" };
// This is only obtainable via createAuthToken. Note that is there's no password, sid is null
export type Session = { sid: SID | null } & { readonly [tag]: "Session" };
// type-safe construct a session
const _session = (session: Omit<Session, typeof tag>): Session =>
  session as Session;

export const USER_AGENT = "pihole-sync" as const;
function api(
  session: Session | null,
  ...args: Parameters<typeof globalThis.fetch>
) {
  const session_headers = session?.sid ? { sid: session.sid } : null;
  return globalThis.fetch(args[0], {
    ...args[1],
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      ...args[1]?.headers,
      ...session_headers,
    },
  });
}
// shadow fetch for this file so we have to use the api function
const fetch = null;
void fetch;

// Trailing slash is important for later URL calls using this as base
export const API_URL = new URL(
  (process.env.PIHOLE_API || "http://pi.hole/api") + "/"
);
type ApiResponse<T> = { ok: true; data: T } | { ok: false; data: ApiError };
// TODO: authentication

export type List = {
  address: string;
  comment?: string;
  type: "block" | "allow";
};
export type ApiListsRequest = List; // POST /api/lists?type=$TYPE
export type ApiListsResponse = { lists: List[] }; // GET /api/lists

export async function postList(
  session: Session,
  list: List
): Promise<ApiResponse<object>> {
  const url = new URL(`lists`, API_URL);
  url.searchParams.set("type", list.type);
  const body: ApiListsRequest = list;
  const response = await api(session, url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiError | object;
  return "error" in data ? { ok: false, data } : { ok: true, data };
}

export type Domain = {
  domain: string;
  comment?: string;
  type: "deny" | "allow";
  kind: "exact" | "regex";
};
export type ApiDomainsRequest = Domain; // POST /api/domains/$TYPE/$KIND
export type ApiDomainsResponse = { domains: Domain[] }; // GET /api/domains
export async function postDomain(
  session: Session,
  domain: Domain
): Promise<ApiResponse<object>> {
  const baseUrl = new URL(`domains/${domain.type}/`, API_URL);
  const url = new URL(domain.kind, baseUrl);
  const body: ApiDomainsRequest = domain;
  const response = await api(session, url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiError | object;
  return "error" in data ? { ok: false, data } : { ok: true, data };
}

export async function updateGravity(
  session: Session
): Promise<ApiResponse<NonNullable<Response["body"]>>> {
  const url = new URL("action/gravity", API_URL);
  const res = await api(session, url, { method: "POST" });
  if (!res.ok) return { ok: false, data: (await res.json()) as ApiError };
  if (!res.body) throw new Error("No body");
  return { ok: true, data: res.body };
}

export async function createSession(): Promise<ApiResponse<Session>> {
  const password = process.env.PIHOLE_PASSWORD ?? "";
  const url = new URL("auth", API_URL);
  type api_request = { password: string };
  const body: api_request = { password };
  // Explicit null for session, since it doesn't exist yet
  const response = await api(null, url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {},
  });
  type api_res = {
    session: { sid: SID | null; valid: boolean; message: string };
  };
  const data = (await response.json()) as ApiError | api_res;
  return "error" in data
    ? { ok: false, data }
    : data.session.valid
      ? {
          ok: true,
          data: _session({ sid: data.session.sid }),
        }
      : {
          ok: false,
          data: {
            error: {
              // construct our own error, since this doesn't return an error code
              key: "invalid-session",
              message: data.session.message,
              hint: null,
            },
          },
        };
}

type AuthSession = {
  id: SID;
  current_session: boolean;
  user_agent?: string;
};
type APIAuthSessionResponse = { sessions: AuthSession[] };
export async function getAuthSessions(
  session: Session
): Promise<ApiResponse<APIAuthSessionResponse>> {
  const url = new URL("auth/sessions", API_URL);
  const response = await api(session, url, {
    method: "GET",
    headers: {},
  });
  const data = (await response.json()) as ApiError | APIAuthSessionResponse;
  return "error" in data ? { ok: false, data } : { ok: true, data };
}
export async function deleteAuthSession(
  session: Session,
  sid: SID
): Promise<ApiResponse<null>> {
  const url = new URL(`auth/session/${sid}`, API_URL);
  const response = await api(session, url, {
    method: "DELETE",
    headers: {},
  });
  return response.ok
    ? { ok: true, data: null }
    : { ok: false, data: (await response.json()) as ApiError };
}
