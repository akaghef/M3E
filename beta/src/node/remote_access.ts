import fs from "node:fs";
import type { ListenOptions } from "node:net";
import net from "node:net";
import type { Server } from "node:http";
import path from "node:path";

export function viewerListenOptions(port: number, host = process.env.M3E_HOST, socket = process.env.M3E_LISTEN_SOCKET): ListenOptions {
  if (socket) return { path: socket };
  return host ? { port, host } : { port };
}

/** The same HTTP server and routes, with exactly one listener. */
export async function listenViewer(server: Server, port: number, ready: () => void): Promise<void> {
  const options = viewerListenOptions(port);
  const socket = options.path;
  if (!socket) { server.listen(options, ready); return; }
  if (!path.isAbsolute(socket)) throw new Error("M3E_LISTEN_SOCKET must be an absolute path.");
  try {
    const existing = fs.lstatSync(socket);
    if (!existing.isSocket()) throw new Error("M3E_LISTEN_SOCKET exists and is not a socket.");
    await new Promise<void>((resolve, reject) => {
      const probe = net.createConnection(socket);
      probe.once("connect", () => { probe.destroy(); reject(new Error("M3E_LISTEN_SOCKET is already in use.")); });
      probe.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ECONNREFUSED" || error.code === "ENOENT") resolve();
        else reject(error);
      });
    });
    const current = fs.lstatSync(socket);
    if (current.dev !== existing.dev || current.ino !== existing.ino) throw new Error("M3E_LISTEN_SOCKET changed during startup.");
    fs.unlinkSync(socket);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let owned: fs.Stats | undefined;
  const ownsShutdown = process.listenerCount("SIGINT") === 0 && process.listenerCount("SIGTERM") === 0;
  const cleanup = () => {
    if (!owned) return;
    try {
      const current = fs.lstatSync(socket);
      if (current.dev === owned.dev && current.ino === owned.ino) fs.unlinkSync(socket);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(error);
    }
    owned = undefined;
  };
  const stop = () => {
    cleanup();
    // The record store's signal handler owns its asynchronous shutdown when present.
    if (ownsShutdown) process.exit(0);
  };
  const detach = () => {
    cleanup();
    process.removeListener("exit", cleanup);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  };
  process.on("exit", cleanup);
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.once("close", detach);
  // Restrict the inode from its creation, not only after the listening callback.
  const mask = process.umask(0o177);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options, () => {
        server.removeListener("error", reject);
        try {
          owned = fs.lstatSync(socket);
          fs.chmodSync(socket, 0o600);
          resolve();
        } catch (error) { reject(error); }
      });
    });
  } catch (error) {
    server.close();
    detach();
    throw error;
  } finally { process.umask(mask); }
  ready();
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
