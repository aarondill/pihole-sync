import { id } from "tsafe";
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

const sortBy =
  <T>(key: (t: T) => any = id) =>
  (a: T, b: T) => {
    const aVal = key(a),
      bVal = key(b);
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  };
const sortId = sortBy();
const sortedString = z.codec(z.array(z.string()), z.array(z.string()), {
  decode: value => value.sort(sortId),
  encode: value => value.sort(sortId),
});
const sortedDomain = z.codec(z.array(DomainConfig), z.array(DomainConfig), {
  decode: value => value.sort(sortBy(x => x.domain)),
  encode: value => value.sort(sortBy(x => x.domain)),
});
export const Config = z.object({
  domains: z.partialRecord(Domain.shape.type, sortedDomain),
  lists: z.partialRecord(List.shape.type, sortedString),
});
export type Config = z.infer<typeof Config>;

export const ConfigToJSON = json({ replacer, space: 2 }).pipe(Config);
