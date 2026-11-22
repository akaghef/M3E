import fs from "node:fs";
import type { ListenOptions } from "node:net";
import path from "node:path";

export function viewerListenOptions(port: number, host = process.env.M3E_HOST): ListenOptions {
  return host ? { port, host } : { port };
}

/** An unset list disables the gate. A set but empty list denies all requests. */
export function allowedLogin(header: string | string[] | undefined, list: string | undefined): boolean {
  if (list === undefined) return true;
  if (typeof header !== "string" || header.includes(",")) return false;
  const login = header.trim();
  return login !== "" && list.split(",").some((entry) => entry.trim() === login);
}

export function isTailscaleHttpsOrigin(url: URL): boolean {
  return url.protocol === "https:" && url.hostname.endsWith(".ts.net");
}

/** API origins are configuration only. Resource and tool arguments never become fetch URLs. */
export function validateM3eApiUrl(value: string): string {
  const error = "M3E_API_URL must be a loopback HTTP(S) or HTTPS *.ts.net origin without credentials, path, query or fragment.";
  const input = value.trim();
  // Check the raw form before URL normalization can erase paths or empty delimiters.
  if (!/^https?:\/\/[^/?#\\\s@]+\/?$/i.test(input)) throw new Error(error);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(error);
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && !isTailscaleHttpsOrigin(url)) {
    throw new Error(error);
  }
  return url.origin;
}

/**
 * A workspace moved to a remote M3E leaves `moved-to-remote.json` ({"url": ...}) in its local data
 * directory. The local server then refuses to start on the frozen local copy. Returns the remote URL,
 * or null when the workspace was not moved.
 */
export function movedToRemote(dataDir: string): string | null {
  const marker = path.join(dataDir, "moved-to-remote.json");
  if (!fs.existsSync(marker)) return null;
  try {
    const url = (JSON.parse(fs.readFileSync(marker, "utf8")) as { url?: unknown }).url;
    return typeof url === "string" && url.trim() ? url.trim() : "(remote URL not recorded)";
  } catch {
    return "(remote URL not readable)";
  }
}
