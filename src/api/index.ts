import { ApiError, Domain, List, Session, SID } from "./types.ts";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; data: ApiError };

export const USER_AGENT = "pihole-sync" as const;
function api(sid: SID | null, ...args: Parameters<typeof globalThis.fetch>) {
  const session_headers = sid ? { sid: sid } : null;
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

import * as z from "zod";
// TODO: Api -> `class Pihole` (contain the session)
export const Api = {
  Lists: {
    async GET(): Promise<ApiResponse<List[]>> {
      const ResponseSchema = z // TODO: generate once
        .object({ lists: z.array(List) })
        .transform(data => data.lists);
      const url = new URL("lists", API_URL);
      const response = await api(null, url, { method: "GET" });
      const data = z
        .union([ApiError, ResponseSchema])
        .parse(await response.json());
      return "error" in data ? { ok: false, data } : { ok: true, data };
    },
    async POST(session: SID, body: List): Promise<ApiResponse<List[]>> {
      const ResponseSchema = z
        .object({ lists: z.array(List) })
        .transform(data => data.lists); // TODO: generate once
      const url = new URL(`lists`, API_URL);
      url.searchParams.set("type", body.type);
      const response = await api(session, url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = z
        .union([ApiError, ResponseSchema])
        .parse(await response.json());
      return "error" in data ? { ok: false, data } : { ok: true, data };
    },
  },
  Domains: {
    async POST(session: SID, body: Domain): Promise<ApiResponse<Domain[]>> {
      const ResponseSchema = z
        .object({ domains: z.array(Domain) })
        .transform(data => data.domains); // TODO: generate once
      const url = new URL(`domains/${body.type}/${body.kind}/`, API_URL);
      const response = await api(session, url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = z
        .union([ApiError, ResponseSchema])
        .parse(await response.json());
      return "error" in data ? { ok: false, data } : { ok: true, data };
    },
    async GET(session: SID): Promise<ApiResponse<Domain[]>> {
      const ResponseSchema = z
        .object({ domains: z.array(Domain) })
        .transform(data => data.domains); // TODO: generate once
      const url = new URL("domains", API_URL);
      const response = await api(session, url, { method: "GET" });
      const data = z
        .union([ApiError, ResponseSchema])
        .parse(await response.json());
      return "error" in data ? { ok: false, data } : { ok: true, data };
    },
  },
  Actions: {
    Gravity: {
      async POST(
        session: SID
      ): Promise<ApiResponse<NonNullable<Response["body"]>>> {
        const url = new URL("action/gravity", API_URL);
        const res = await api(session, url, { method: "POST" });
        if (!res.ok)
          return { ok: false, data: await res.json().then(ApiError.parse) };
        if (!res.body) throw new Error("No body");
        return { ok: true, data: res.body };
      },
    },
  },
  Auth: {
    async POST(body: { password: string }): Promise<ApiResponse<SID>> {
      // { "session": { "valid": true, "totp": false, "sid": "PB9uJXEu18pmfbH2Gdnbvg=", "csrf": "qJ5rsbqT0S59KuY1EeAfbQ=", "validity": 1800, "message": "password correct" }, "took": 1.2953979969024658 }
      const url = new URL("auth", API_URL);
      // Explicit null for session, since it doesn't exist yet
      const response = await api(null, url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const ResponseSchema = z.object({
        session: z.object({
          sid: z.string().nullable(),
          valid: z.boolean(),
          message: z.string(),
        }),
      }); // TODO: generate once
      const data = z
        .union([ApiError, ResponseSchema])
        .parse(await response.json());
      return "error" in data
        ? { ok: false, data }
        : data.session.valid
          ? { ok: true, data: SID.decode(data.session.sid) }
          : {
              ok: false,
              // construct our own error, since this doesn't return an error code
              data: ApiError.decode({
                error: {
                  key: "invalid-session",
                  message: data.session.message,
                  hint: null,
                },
              }),
            };
    },
    Sessions: {
      async GET(session: SID): Promise<ApiResponse<Session[]>> {
        const ResponseSchema = z
          .object({ sessions: z.array(Session) })
          .transform(data => data.sessions);
        const url = new URL("auth/sessions", API_URL);
        const response = await api(session, url, { method: "GET" });
        const data = z
          .union([ApiError, ResponseSchema])
          .parse(await response.json());
        return "error" in data ? { ok: false, data } : { ok: true, data };
      },
      async DELETE(
        session: SID,
        id: Session["id"]
      ): Promise<ApiResponse<null>> {
        const url = new URL(`auth/session/${id}`, API_URL);
        const response = await api(session, url, { method: "DELETE" });
        return response.ok
          ? { ok: true, data: null }
          : { ok: false, data: await response.json().then(ApiError.parse) };
      },
    },
  },
};
