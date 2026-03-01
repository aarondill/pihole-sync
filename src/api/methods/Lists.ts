import { assert } from "tsafe";
import { z } from "zod";
import type { ApiResponse, MethodsReturnApiResponse } from "../base.ts";
import { api, ApiSection } from "../base.ts";
import { ApiError, List } from "../types.ts";

export class ListsAPI extends ApiSection {
  async GET(): Promise<ApiResponse<List[]>> {
    const ResponseSchema = z // TODO: generate once
      .object({ lists: z.array(List) })
      .transform(data => data.lists);
    const url = new URL("lists", this.API_URL);
    const response = await api(this.session, url, { method: "GET" });
    const data = z
      .union([ApiError, ResponseSchema])
      .parse(await response.json());
    return "error" in data ? { ok: false, data } : { ok: true, data };
  }
  async POST(body: List): Promise<ApiResponse<List[]>> {
    const ResponseSchema = z
      .object({ lists: z.array(List) })
      .transform(data => data.lists); // TODO: generate once
    const url = new URL(`lists`, this.API_URL);
    url.searchParams.set("type", body.type);
    const response = await api(this.session, url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = z
      .union([ApiError, ResponseSchema])
      .parse(await response.json());
    return "error" in data ? { ok: false, data } : { ok: true, data };
  }
}
assert<MethodsReturnApiResponse<ListsAPI>>();
