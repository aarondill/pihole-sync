import * as z from "zod";

export const ApiError = z.object({
  error: z.object({
    key: z.string(),
    message: z.string(),
    hint: z.string().nullable(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

// This is only obtainable via createAuthToken. Note that is there's no password, sid is null
export const SID = z.string().brand<"SID">().nullable();
export type SID = z.infer<typeof SID>;

export const Session = z.object({
  id: z.int(),
  current_session: z.boolean(),
  valid: z.boolean(),
  remote_addr: z.string(),
  user_agent: z.string().nullable().optional(),
});
export type Session = z.infer<typeof Session>;

export const List = z.object({
  address: z.string(),
  comment: z.string().nullable().optional(),
  type: z.union([z.literal("block"), z.literal("allow")]),
});
export type List = z.infer<typeof List>;

export const Domain = z.object({
  domain: z.string(),
  comment: z.string().nullable().optional(),
  type: z.union([z.literal("block"), z.literal("allow")]),
  kind: z.union([z.literal("exact"), z.literal("regex")]),
});
export type Domain = z.infer<typeof Domain>;
