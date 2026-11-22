import type { ListenOptions } from "node:net";

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
