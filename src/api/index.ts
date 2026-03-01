import { ActionsAPI } from "./methods/Actions.ts";
import { AuthAPI } from "./methods/Auth.ts";
import { DomainsAPI } from "./methods/Domains.ts";
import { ListsAPI } from "./methods/Lists.ts";
import { SID } from "./types.ts";

// Use `login` to create a Pihole instance
export class Pihole {
  // Note: this *must* end with a slash
  private API_URL: URL;
  private session: SID = null;
  public Lists: ListsAPI;
  public Domains: DomainsAPI;
  public Actions: ActionsAPI;
  public Auth: AuthAPI;
  /**
   * Note: you must call `login` before using authenticated methods
   * @param API_URL - The URL of the Pi-hole API (http://pi.hole/api by default)
   */
  constructor(API_URL: URL = new URL("http://pi.hole/api/")) {
    this.API_URL = new URL(API_URL.href + "/");
    this.Lists = new ListsAPI(this.API_URL, () => this.session);
    this.Domains = new DomainsAPI(this.API_URL, () => this.session);
    this.Actions = new ActionsAPI(this.API_URL, () => this.session);
    this.Auth = new AuthAPI(this.API_URL, () => this.session);
  }
  async login(password: string) {
    const res = await this.Auth.POST({ password });
    if (!res.ok) throw new Error("Failed to create session");
    this.session = res.data;
  }
  async logout() {
    if (!this.session) return; // Do nothing if not logged in
    const res = await this.Auth.DELETE();
    if (!res.ok) throw new Error("Failed to delete session");
    this.session = null;
  }
  // Allow `using Pihole` to be used as a context manager
  [Symbol.asyncDispose] = this.logout;
}
