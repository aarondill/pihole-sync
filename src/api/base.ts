import { type Extends, type ReturnType } from "tsafe";
import { ApiError, SID } from "./types.ts";
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; data: ApiError };

export const USER_AGENT = "pihole-sync" as const;
export function api(sid: SID | null, ...args: Parameters<typeof fetch>) {
  const session_headers = sid ? { sid: sid } : null;
  return fetch(args[0], {
    ...args[1],
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      ...args[1]?.headers,
      ...session_headers,
    },
  });
}

export class ApiSection {
  protected API_URL: URL;
  protected _session: () => SID;
  protected get session(): SID {
    return this._session();
  }
  constructor(API_URL: URL, _session: () => SID) {
    this.API_URL = API_URL;
    this._session = _session;
  }
}

export type Methods<Api> = {
  [Key in keyof Api]: Api[Key] extends (...args: any[]) => unknown
    ? Api[Key]
    : never;
}[keyof Api];
/**
 * A sanity check to ensure that the methods return the correct type
 * Use with assert<MethodsReturnApiResponse<API>>();
 */
export type MethodsReturnApiResponse<
  T extends ApiSection,
  Returns = ReturnType<Methods<T>>,
  Expected = ApiResponse<unknown>,
> = Extends<Returns, Expected>;
