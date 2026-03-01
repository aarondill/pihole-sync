import { type Extends, type ReturnType } from "tsafe";
import { ApiError, SID } from "./types.ts";
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; data: ApiError };

function stopableTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, stop: () => clearTimeout(timeout) };
}

export const USER_AGENT = "pihole-sync" as const;
export const TIMEOUT = 1000 * 10;
export function api(sid: SID | null, ...args: Parameters<typeof fetch>) {
  const session_headers = sid ? { sid: sid } : null;
  const timeout = stopableTimeout(TIMEOUT);
  const signal = args[1]?.signal
    ? AbortSignal.any([timeout.signal, args[1].signal])
    : timeout.signal;
  let res = fetch(args[0], {
    ...args[1],
    signal,
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      ...args[1]?.headers,
      ...session_headers,
    },
  });
  timeout.stop();
  // The timeout isn't supposed to apply to the Body.
  // This is especially important for updating Gravity, which can take a while.
  return res;
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
