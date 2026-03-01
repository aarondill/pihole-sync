import { assert } from "tsafe";
import { z } from "zod";
import type { ApiResponse, MethodsReturnApiResponse } from "../base.ts";
import { api, ApiSection } from "../base.ts";
import { ApiError, Session, SID } from "../types.ts";
export class AuthAPI extends ApiSection {
  async POST(body: { password: string }): Promise<ApiResponse<SID>> {
    const url = new URL("auth", this.API_URL);
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
  }
  async DELETE(): Promise<ApiResponse<null>> {
    const url = new URL("auth", this.API_URL);
    const response = await api(this.session, url, { method: "DELETE" });
    return response.ok
      ? { ok: true, data: null }
      : { ok: false, data: await response.json().then(ApiError.parse) };
  }

  async getSessions(): Promise<ApiResponse<Session[]>> {
    const ResponseSchema = z
      .object({ sessions: z.array(Session) })
      .transform(data => data.sessions);
    const url = new URL("auth/sessions", this.API_URL);
    const response = await api(this.session, url, { method: "GET" });
    const data = z
      .union([ApiError, ResponseSchema])
      .parse(await response.json());
    return "error" in data ? { ok: false, data } : { ok: true, data };
  }
  async deleteSession(id: Session["id"]): Promise<ApiResponse<null>> {
    const url = new URL(`auth/session/${id}`, this.API_URL);
    const response = await api(this.session, url, { method: "DELETE" });
    return response.ok
      ? { ok: true, data: null }
      : { ok: false, data: await response.json().then(ApiError.parse) };
  }
}
assert<MethodsReturnApiResponse<AuthAPI>>();
