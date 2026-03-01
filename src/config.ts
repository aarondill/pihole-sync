import { z } from "zod";
import { Domain, List } from "./api/types.ts";

const DomainConfig = Domain.omit({ type: true });

const JSONString = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: "Invalid JSON" });
    return z.NEVER;
  }
});

export const Config = JSONString.pipe(
  z.object({
    domains: z.record(Domain.shape.type, z.array(DomainConfig)),
    lists: z.record(List.shape.type, z.array(z.string())),
  })
);
export type Config = z.infer<typeof Config>;
