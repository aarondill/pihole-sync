import { z } from "zod";
import { Domain, List } from "./api/types.ts";

const DomainConfig = Domain.omit({ type: true });

const json = (options?: {
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
  space?: Parameters<typeof JSON.stringify>[2];
}) =>
  z.codec(z.string(), z.json(), {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString, options?.reviver);
      } catch (err: any) {
        ctx.issues.push({
          code: "invalid_format",
          format: "json",
          input: jsonString,
          message: err.message,
        });
        return z.NEVER;
      }
    },
    encode: value => JSON.stringify(value, options?.replacer, options?.space),
  });

const replacer = (_key: string, value: unknown) =>
  value instanceof Object &&
  !(value instanceof Array) &&
  Object.keys(value).length > 0
    ? Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, key: string) => {
          sorted[key] = (value as Record<string, unknown>)[key];
          return sorted;
        }, {})
    : value;

export const Config = z.object({
  domains: z.partialRecord(Domain.shape.type, z.array(DomainConfig)),
  lists: z.partialRecord(List.shape.type, z.array(z.string())),
});
export type Config = z.infer<typeof Config>;

export const ConfigToJSON = json({ replacer, space: 2 }).pipe(Config);
