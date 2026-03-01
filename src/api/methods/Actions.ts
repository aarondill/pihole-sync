import { assert } from "tsafe";
import type { ApiResponse, MethodsReturnApiResponse } from "../base.ts";
import { api, ApiSection } from "../base.ts";
import { ApiError } from "../types.ts";

export class ActionsAPI extends ApiSection {
  async Gravity(): Promise<ApiResponse<NonNullable<Response["body"]>>> {
    const url = new URL("action/gravity", this.API_URL);
    const res = await api(this.session, url, { method: "POST" });
    if (!res.ok)
      return { ok: false, data: await res.json().then(ApiError.parse) };
    if (!res.body) throw new Error("No body");
    return { ok: true, data: res.body };
  }
}
assert<MethodsReturnApiResponse<ActionsAPI>>();
