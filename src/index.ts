import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { objectKeys } from "tsafe/objectKeys";
import { z } from "zod";
import { Pihole } from "./api/index.ts";
import { Domain, List } from "./api/types.ts";

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
async function push(api: Pihole) {
  // Chore: fetch and diff first.
  // Don't run gravity if nothing has changed.
  for (const type of objectKeys(config.lists)) {
    for (const list of config.lists[type]) {
      const response = await api.Lists.POST({ type, address: list });
      if (response.ok) console.log(`Updated ${type} list ${list}`);
      else {
        console.error(`Failed to add list ${list}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  for (const type of objectKeys(config.domains)) {
    for (const domain of config.domains[type]) {
      const response = await api.Domains.POST({ type, ...domain });
      if (response.ok) console.log(`Updated ${type} domain ${domain.domain}`);
      else {
        console.error(`Failed to add domain ${domain.domain}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  console.log("Update done!");

  console.log("Updating gravity.db");
  const res = await api.Actions.Gravity();
  if (!res.ok) console.log("Gravity Failed: ", res.data);
  else
    await res.data.pipeTo(Writable.toWeb(process.stdout), {
      preventClose: true,
      preventAbort: true,
    });
  console.log("Done!");
}

export const API_URL = new URL(process.env.PIHOLE_API || "http://pi.hole/api");
const password = process.env.PIHOLE_PASSWORD ?? "";
await using pihole = await new Pihole(API_URL).login(password);
await push(pihole);
// Keep this process alive forever
// setInterval(() => void 0, 2 ** 30);
// TODO: pull on an interval
