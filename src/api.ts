// If not unique, it will still succeed, but there will be an error in '.processed.errors[0]'
export type ApiError = {
  error: { key: string; message: string; hint: string | null };
};

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

export async function postList(list: List): Promise<ApiResponse<object>> {
  const url = new URL(`lists`, API_URL);
  url.searchParams.set("type", list.type);
  const body: ApiListsRequest = list;
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {},
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

export async function postDomain(domain: Domain): Promise<ApiResponse<object>> {
  const baseUrl = new URL(`domains/${domain.type}/`, API_URL);
  const url = new URL(domain.kind, baseUrl);
  const body: ApiDomainsRequest = domain;
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {},
  });
  const data = (await response.json()) as ApiError | object;
  return "error" in data ? { ok: false, data } : { ok: true, data };
}

export async function updateGravity(): Promise<
  ApiResponse<NonNullable<Response["body"]>>
> {
  const url = new URL("action/gravity", API_URL);
  const res = await fetch(url, {
    method: "POST",
  });
  if (!res.ok) {
    return { ok: false, data: await res.json() };
  }
  if (!res.body) throw new Error("No body");
  return { ok: true, data: res.body };
}
