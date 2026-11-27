/**
 * The issuer of a Command is an account id the server chooses from the connection.
 * The Command's actor is the caller's own label and is never copied into `issuer`.
 *
 * Account records themselves are not written here: the record store commits only the
 * projection of a map, and it has no Command that puts an account record. The gap is
 * recorded in the implementation log. Callers still stamp the chosen account id.
 */
import { createHash } from "crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SnapshotRecord } from "../../shared/record_model/types";

export const LOCAL_HUMAN_ACCOUNT_ID = "acct_local_human";
export const SYSTEM_ACCOUNT_ID = "acct_system";
const requestLogin = new AsyncLocalStorage<string | undefined>();

/** Propagate the checked HTTP identity through viewer and MCP Command handlers. */
export function withVerifiedLogin<T>(login: string | undefined, operation: () => T): T {
  return requestLogin.run(login, operation);
}

export type ConnectionKind = "mcp" | "viewer" | "system";

/** Who is on the other end of this connection. MCP is one Actor Instance. */
export interface ConnectionIdentity {
  kind: ConnectionKind;
  /** Tailscale account login, accepted by the remote's configured allow-list. */
  verifiedLogin?: string;
  /** Actor Instance id when `kind` is `mcp`. Ignored otherwise. */
  instanceId?: string;
}

export interface AccountChoice {
  accountId: string;
  accountKind: "ai-agent" | "human" | "system";
  displayName: string;
}

/** One AI agent account per Actor Instance. The id is not the instance id. */
export function aiAgentAccountId(instanceId: string): string {
  const digest = createHash("sha256").update(instanceId, "utf8").digest("hex").slice(0, 20);
  return `acct_ai_${digest}`;
}

export function accountForConnection(connection: ConnectionIdentity): AccountChoice {
  if (connection.kind === "system") {
    return { accountId: SYSTEM_ACCOUNT_ID, accountKind: "system", displayName: "server" };
  }
  if (connection.kind === "viewer") {
    // A human on the viewer, identified by the login the remote checked. An MCP connection
    // stays its AI agent's account even when a verified human runs it.
    const login = connection.verifiedLogin ?? requestLogin.getStore();
    if (login) return { accountId: login, accountKind: "human", displayName: login };
    return { accountId: LOCAL_HUMAN_ACCOUNT_ID, accountKind: "human", displayName: "local" };
  }
  const instanceId = connection.instanceId?.trim() || "anonymous";
  return { accountId: aiAgentAccountId(instanceId), accountKind: "ai-agent", displayName: "AI agent" };
}

/**
 * Look for the account record this connection would own. Does not write one:
 * no store API accepts that Command. `present` is false when the snapshot has none.
 */
export function noteAccount(load: () => readonly Pick<SnapshotRecord, "kind">[], choice: AccountChoice): { accountId: string; present: boolean } {
  const present = load().some((record) => record.kind === "account" && (record as { id?: string }).id === choice.accountId);
  return { accountId: choice.accountId, present };
}
