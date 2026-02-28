import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { objectKeys } from "tsafe/objectKeys";
import {
  createSession,
  postDomain,
  postList,
  updateGravity,
  type Domain,
  type List,
  type Session,
} from "./api.ts";

type DomainConfig = Omit<Domain, "type">;

type JSONConfig = {
  domains: Record<Domain["type"], DomainConfig[]>;
  lists: Record<List["type"], string[]>;
};
const configFile = process.env.CONFIG_FILE || "./config.json";
const config: JSONConfig = JSON.parse(await readFile(configFile, "utf-8"));
// TODO: Validate config

// Pushes current config to Pi-hole
// NOTE: does *not* remove any domains or lists that are not in the config
async function push(s: Session) {
  let ok = true;

  for (const type of objectKeys(config.lists)) {
    for (const list of config.lists[type]) {
      const response = await postList(s, { type, address: list });
      if (response.ok) console.log(`Updated ${type} list ${list}`);
      else console.error(`Failed to add list ${list}:`, response.data);
      ok &&= response.ok;
    }
  }

  for (const type of objectKeys(config.domains)) {
    for (const domain of config.domains[type]) {
      const response = await postDomain(s, { type, ...domain });
      if (response.ok) console.log(`Updated ${type} domain ${domain.domain}`);
      else
        console.error(`Failed to add domain ${domain.domain}:`, response.data);
      ok &&= response.ok;
    }
  }

  if (!ok) throw new Error("Failed to update");
  else console.log("Update done!");

  console.log("Updating gravity.db");
  const res = await updateGravity(s);
  if (!res.ok) console.log("Gravity Failed: ", res.data);
  else res.data.pipeTo(Writable.toWeb(process.stdout));
}

const res = await createSession();
if (!res.ok) throw new Error("Failed to create session");
const session = res.data;
await push(session);
console.log("Done!");
// Keep this process alive forever
setInterval(() => void 0, Infinity);
// TODO: pull on an interval
