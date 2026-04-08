export function detectCloudConflict(
  existingCloudSavedAt: string | null,
  baseSavedAt: string | null,
  forcePush: boolean,
): boolean {
  if (forcePush) {
    return false;
  }
  if (!existingCloudSavedAt || !baseSavedAt) {
    return false;
  }
  return existingCloudSavedAt !== baseSavedAt;
}
