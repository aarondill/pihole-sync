import { assert } from "tsafe";
import { z } from "zod";
import type { ApiResponse, MethodsReturnApiResponse } from "../base.ts";
import { api, ApiSection } from "../base.ts";
import { ApiError, Domain } from "../types.ts";

export class DomainsAPI extends ApiSection {
  async POST(body: Domain): Promise<ApiResponse<Domain[]>> {
    const ResponseSchema = z
      .object({ domains: z.array(Domain) })
      .transform(data => data.domains); // TODO: generate once
    const url = new URL(`domains/${body.type}/${body.kind}/`, this.API_URL);
    const response = await api(this.session, url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = z
      .union([ApiError, ResponseSchema])
      .parse(await response.json());
    return "error" in data ? { ok: false, data } : { ok: true, data };
  }
  async GET(): Promise<ApiResponse<Domain[]>> {
    const ResponseSchema = z
      .object({ domains: z.array(Domain) })
      .transform(data => data.domains); // TODO: generate once
    const url = new URL("domains", this.API_URL);
    const response = await api(this.session, url, { method: "GET" });
    const data = z
      .union([ApiError, ResponseSchema])
      .parse(await response.json());
    return "error" in data ? { ok: false, data } : { ok: true, data };
  }
}
assert<MethodsReturnApiResponse<DomainsAPI>>();
