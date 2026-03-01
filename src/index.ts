import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { objectKeys } from "tsafe/objectKeys";
import { z } from "zod";
import { Api, USER_AGENT } from "./api/index.ts";
import { Domain, List, SID } from "./api/types.ts";

const DomainConfig = Domain.omit({ type: true });
type DomainConfig = z.infer<typeof DomainConfig>;

const JSONString = z.string().transform((str, ctx) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: "Invalid JSON" });
    return z.NEVER;
  }
});

const Config = JSONString.pipe(
  z.object({
    domains: z.record(Domain.shape.type, z.array(DomainConfig)),
    lists: z.record(List.shape.type, z.array(z.string())),
  })
);

const configFile = process.env.CONFIG_FILE || "./config.json";
const config = Config.decode(await readFile(configFile, "utf-8"));

// Pushes current config to Pi-hole
// NOTE: does *not* remove any domains or lists that are not in the config
async function push(s: SID) {
  // Chore: fetch and diff first.
  // Don't run gravity if nothing has changed.
  for (const type of objectKeys(config.lists)) {
    for (const list of config.lists[type]) {
      const response = await Api.Lists.POST(s, { type, address: list });
      if (response.ok) console.log(`Updated ${type} list ${list}`);
      else {
        console.error(`Failed to add list ${list}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  for (const type of objectKeys(config.domains)) {
    for (const domain of config.domains[type]) {
      const response = await Api.Domains.POST(s, { type, ...domain });
      if (response.ok) console.log(`Updated ${type} domain ${domain.domain}`);
      else {
        console.error(`Failed to add domain ${domain.domain}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  console.log("Update done!");

  console.log("Updating gravity.db");
  const res = await Api.Actions.Gravity.POST(s);
  if (!res.ok) console.log("Gravity Failed: ", res.data);
  else
    await res.data.pipeTo(Writable.toWeb(process.stdout), {
      preventClose: true,
      preventAbort: true,
    });
  console.log("Done!");
}
async function cleanupSessions(s: SID) {
  const sessions = await Api.Auth.Sessions.GET(s);
  if (!sessions.ok) throw new Error("Failed to get sessions");
  const remove = sessions.data
    .filter(s => !s.current_session && s.user_agent === USER_AGENT)
    .map(({ id }) => id);
  console.log("Removing old sessions...");
  await Promise.all(remove.map(id => Api.Auth.Sessions.DELETE(s, id)));
  console.log("Done!");
}

const password = process.env.PIHOLE_PASSWORD ?? "";
const res = await Api.Auth.POST({ password });
if (!res.ok) throw new Error("Failed to create session");
const session = res.data;

await cleanupSessions(session);
await push(session);
// Keep this process alive forever
setInterval(() => void 0, 2 ** 30);
// TODO: pull on an interval
