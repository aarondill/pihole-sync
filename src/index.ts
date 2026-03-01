import * as fs from "node:fs/promises";
import { Writable } from "node:stream";
import { objectEntries, objectFromEntries } from "tsafe";
import { Pihole } from "./api/index.ts";
import { Config, ConfigToJSON } from "./config.ts";
// Pushes current config to Pi-hole
// NOTE: does *not* remove any domains or lists that are not in the config
async function push(api: Pihole, config: Config) {
  {
    // fetch and diff first.
    const current = await pull(api);
    const toPush: Config = {
      domains: objectFromEntries(
        objectEntries(config.domains).map(([type, domains]) => [
          type,
          domains?.filter(
            x => !current.domains[type]?.map(x => x.domain).includes(x.domain)
          ),
        ])
      ),
      lists: objectFromEntries(
        objectEntries(config.lists).map(([type, lists]) => [
          type,
          lists?.filter(x => !current.lists[type]?.includes(x)),
        ])
      ),
    };
    config = toPush;
  }
  console.debug(config);
  // Don't run gravity if nothing has changed.
  let somethingChanged = false;
  for (const [type, lists] of objectEntries(config.lists)) {
    if (!lists) continue; // Make typescript happy
    for (const list of lists) {
      somethingChanged = true;
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
      somethingChanged = true;
      const response = await api.Domains.POST({ type, ...domain });
      if (response.ok) console.log(`Updated ${type} domain ${domain.domain}`);
      else {
        console.error(`Failed to add domain ${domain.domain}:`, response.data);
        throw new Error("Failed to update");
      }
    }
  }

  console.log("Update done!");

  if (!somethingChanged) return;
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
async function pull(api: Pihole): Promise<Config> {
  console.log("Pulling config from Pi-hole");
  const [domains, lists] = await Promise.all([
    api.Domains.GET(),
    api.Lists.GET(),
  ]);
  const ok = domains.ok && lists.ok;
  if (!ok) {
    const msgs = [domains, lists].filter(x => !x.ok).map(x => x.data);
    throw new Error("Failed to fetch: " + msgs.join(", "));
  }
  console.log("Got config from Pi-hole");
  return Config.decode({
    domains: domains.data.reduce((acc: Config["domains"], domain) => {
      (acc[domain.type] ??= []).push(domain);
      return acc;
    }, {}),
    lists: lists.data.reduce((acc: Config["lists"], list) => {
      (acc[list.type] ??= []).push(list.address);
      return acc;
    }, {}),
  });
}

const configFile = process.env.CONFIG_FILE || "./config.json";

export const API_URL = new URL(process.env.PIHOLE_API || "http://pi.hole/api");
const password = process.env.PIHOLE_PASSWORD ?? "";
await using pihole = new Pihole(API_URL);

while (!(await pihole.ping())) {
  console.log("Pi-hole is not responding. Waiting...");
  await new Promise(resolve => setTimeout(resolve, 1000 * 10));
}

await pihole.login(password);

let lastFileContents = await fs.readFile(configFile, "utf-8");
let config = ConfigToJSON.decode(lastFileContents);
await push(pihole, config);

setInterval(async () => {
  config = await pull(pihole);
  const newFileContents = ConfigToJSON.encode(config);
  if (newFileContents !== lastFileContents) {
    lastFileContents = newFileContents;
    await fs.writeFile(configFile, newFileContents + "\n");
  }
}, 1000 * 60);
