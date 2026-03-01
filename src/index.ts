import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { objectKeys } from "tsafe/objectKeys";
import { Pihole } from "./api/index.ts";
import { Config } from "./config.ts";
// Pushes current config to Pi-hole
// NOTE: does *not* remove any domains or lists that are not in the config
async function push(api: Pihole, config: Config) {
  // Chore: fetch and diff first.
  // Don't run gravity if nothing has changed.
  for (const [type, lists] of objectEntries(config.lists)) {
    if (!lists) continue; // Make typescript happy
    for (const list of lists) {
      const response = await api.Lists.POST({ type, address: list });
      if (response.ok) console.log(`Updated ${type} list ${list}`);
      else {
        console.error(`Failed to add list ${list}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  for (const [type, domains] of objectEntries(config.domains)) {
    if (!domains) continue; // Make typescript happy
    for (const domain of domains) {
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

const configFile = process.env.CONFIG_FILE || "./config.json";
const config = await readFile(configFile, "utf-8").then(Config.decode);

export const API_URL = new URL(process.env.PIHOLE_API || "http://pi.hole/api");
const password = process.env.PIHOLE_PASSWORD ?? "";
await using pihole = await new Pihole(API_URL).login(password);
await push(pihole, config);
// Keep this process alive forever
// setInterval(() => void 0, 2 ** 30);
// TODO: pull on an interval
