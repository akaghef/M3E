export {
  admitToAccount,
  aliasAccessAlternate,
  canReadScope,
  canSendScope,
  canWriteScope,
  decideScopePermission,
  filterScopeChangeSequences,
} from "./scope_permission";

export type {
  AccountId,
  AliasAccessAlternate,
  ScopeCapability,
  ScopeChangeSequence,
  ScopeGrant,
  ScopeId,
  ScopePermissionDecision,
  WorkspaceAccount,
  WorkspaceId,
} from "./scope_permission";
