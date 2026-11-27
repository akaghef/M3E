import type http from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import { connectionFromRequest } from "../../src/node/sync/http";
import { accountForConnection, LOCAL_HUMAN_ACCOUNT_ID, aiAgentAccountId } from "../../src/node/sync/issuer";
afterEach(() => vi.unstubAllEnvs());
function issuer(login?: string | string[], kind = "viewer") {
  return accountForConnection(connectionFromRequest({ headers: {
    "tailscale-user-login": login, "x-m3e-connection": kind, "x-m3e-actor-instance": "instance",
  } } as unknown as http.IncomingMessage)).accountId;
}
test("verified login is the issuer of viewer Commands; an MCP connection stays its AI agent's account", () => {
  vi.stubEnv("M3E_TAILSCALE_USERS", "beta@example.test"); vi.stubEnv("M3E_SYNC_REMOTE", undefined);
  expect(issuer(" beta@example.test ")).toBe("beta@example.test");
  expect(issuer("beta@example.test", "mcp")).toBe(aiAgentAccountId("instance"));
});
test("unchecked, absent, disallowed, duplicated and local-mode headers never become issuer", () => {
  vi.stubEnv("M3E_TAILSCALE_USERS", undefined);
  expect(issuer("beta@example.test")).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  vi.stubEnv("M3E_TAILSCALE_USERS", "beta@example.test");
  expect(issuer()).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  expect(issuer("other@example.test")).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  expect(issuer(["beta@example.test"])).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  expect(issuer("beta@example.test,other@example.test")).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  vi.stubEnv("M3E_SYNC_REMOTE", "https://remote.example");
  expect(issuer("beta@example.test")).toBe(LOCAL_HUMAN_ACCOUNT_ID);
  expect(issuer("beta@example.test", "mcp")).toBe(aiAgentAccountId("instance"));
});
