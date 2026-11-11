/**
 * Scope permission for cutover sync.
 *
 * Workspace ACL is the account boundary. It is not a sync unit.
 * The sync unit is the scope. Read, write, and send ride on the scope.
 *
 * Scope_and_Alias keeps an access value on each alias. That remains an
 * alternate proposal (`AliasAccessAlternate`) and is not consulted here.
 * Visible range, edit range, sync range, and the responsibility boundary
 * are aligned on the scope (Strategy S8, Cloud Sync comparison unit).
 */

export type AccountId = string;
export type WorkspaceId = string;
export type ScopeId = string;

/** Account boundary carried by a workspace. Membership is not a sync grant. */
export interface WorkspaceAccount {
  accountId: AccountId;
  workspaceId: WorkspaceId;
}

export type ScopeCapability = "read" | "write";

/** Permission stored on the scope. Write includes read. */
export interface ScopeGrant {
  scopeId: ScopeId;
  capability: ScopeCapability;
}

/**
 * Alternate proposal from Scope_and_Alias: retain access per alias.
 * `decideScopePermission` does not read this.
 */
export interface AliasAccessAlternate {
  aliasId: string;
  access: ScopeCapability;
}

export interface ScopePermissionDecision {
  admitted: boolean;
  read: boolean;
  write: boolean;
  send: boolean;
}

export interface ScopeChangeSequence<T> {
  scopeId: ScopeId;
  changes: readonly T[];
}

const DENIED: ScopePermissionDecision = Object.freeze({
  admitted: false,
  read: false,
  write: false,
  send: false,
});

function nonEmpty(value: string): boolean {
  return value.length > 0;
}

/** Whether this actor may enter the workspace account. No scope grant is implied. */
export function admitToAccount(actorAccountId: AccountId, workspace: WorkspaceAccount): boolean {
  if (!nonEmpty(actorAccountId) || !nonEmpty(workspace.accountId) || !nonEmpty(workspace.workspaceId)) {
    return false;
  }
  return actorAccountId === workspace.accountId;
}

function capabilityOf(grants: readonly ScopeGrant[], scopeId: ScopeId): ScopeCapability | null {
  let capability: ScopeCapability | null = null;
  for (const grant of grants) {
    if (grant.scopeId !== scopeId) continue;
    if (grant.capability === "write") return "write";
    if (grant.capability === "read") capability = "read";
  }
  return capability;
}

/** Read, write, and send for one scope. Outside the account, all are denied. */
export function decideScopePermission(
  actorAccountId: AccountId,
  workspace: WorkspaceAccount,
  grants: readonly ScopeGrant[],
  scopeId: ScopeId,
): ScopePermissionDecision {
  if (!admitToAccount(actorAccountId, workspace) || !nonEmpty(scopeId)) {
    return DENIED;
  }
  const capability = capabilityOf(grants, scopeId);
  const write = capability === "write";
  const read = capability === "read" || write;
  return { admitted: true, read, write, send: write };
}

export function canReadScope(
  actorAccountId: AccountId,
  workspace: WorkspaceAccount,
  grants: readonly ScopeGrant[],
  scopeId: ScopeId,
): boolean {
  return decideScopePermission(actorAccountId, workspace, grants, scopeId).read;
}

export function canWriteScope(
  actorAccountId: AccountId,
  workspace: WorkspaceAccount,
  grants: readonly ScopeGrant[],
  scopeId: ScopeId,
): boolean {
  return decideScopePermission(actorAccountId, workspace, grants, scopeId).write;
}

/** Send to another device. Requires account admission and write on that scope. */
export function canSendScope(
  actorAccountId: AccountId,
  workspace: WorkspaceAccount,
  grants: readonly ScopeGrant[],
  scopeId: ScopeId,
): boolean {
  return decideScopePermission(actorAccountId, workspace, grants, scopeId).send;
}

/**
 * Change sequences for scopes that cannot be sent become empty.
 * Scope order is kept. Inputs are not mutated.
 */
export function filterScopeChangeSequences<T>(
  actorAccountId: AccountId,
  workspace: WorkspaceAccount,
  grants: readonly ScopeGrant[],
  sequences: readonly ScopeChangeSequence<T>[],
): ScopeChangeSequence<T>[] {
  return sequences.map((sequence) => {
    if (canSendScope(actorAccountId, workspace, grants, sequence.scopeId)) {
      return { scopeId: sequence.scopeId, changes: sequence.changes.slice() };
    }
    return { scopeId: sequence.scopeId, changes: [] };
  });
}

/** Names the alias-access alternate. The returned flag is always not consulted. */
export function aliasAccessAlternate(alias: AliasAccessAlternate): {
  proposal: "alias-access";
  consulted: false;
  access: ScopeCapability;
} {
  return { proposal: "alias-access", consulted: false, access: alias.access };
}
