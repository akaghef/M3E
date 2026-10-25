export interface MarkdownFilePreviewNodeFields {
  link?: string;
  attributes?: Record<string, string>;
}

export interface MarkdownFilePreviewTarget {
  rootPath: string;
  relativePath: string;
}

export interface MarkdownFilePreviewContext {
  allowedRootPaths: string[];
}

function normalizeSeparators(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}

function decodedPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pathWithoutFragment(value: string): string {
  return decodedPath(value.trim().split("#", 1)[0] || "");
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || isWindowsAbsolutePath(value);
}

function isMarkdownPath(value: string): boolean {
  return /\.(?:md|markdown)$/i.test(pathWithoutFragment(value));
}

function normalizedRootKey(value: string): string {
  const normalized = normalizeSeparators(value);
  return isWindowsAbsolutePath(normalized) ? normalized.toLowerCase() : normalized;
}

function normalizedAbsoluteKey(value: string): string {
  const normalized = normalizeSeparators(value);
  return isWindowsAbsolutePath(normalized) ? normalized.toLowerCase() : normalized;
}

function relativePathWithinRoot(absolutePath: string, rootPath: string): string | null {
  const rootKey = normalizedRootKey(rootPath);
  const absoluteKey = normalizedAbsoluteKey(absolutePath);
  if (!rootKey || !absoluteKey || absoluteKey === rootKey) {
    return null;
  }
  if (!absoluteKey.startsWith(`${rootKey}/`)) {
    return null;
  }
  const normalizedAbsolute = normalizeSeparators(absolutePath);
  const normalizedRoot = normalizeSeparators(rootPath);
  return normalizedAbsolute.slice(normalizedRoot.length + 1);
}

function safeRelativePath(value: string): string | null {
  const normalized = normalizeSeparators(pathWithoutFragment(value)).replace(/^\.\//, "");
  if (!normalized || isAbsolutePath(normalized)) {
    return null;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return normalized;
}

function uniqueAllowedRoots(context: MarkdownFilePreviewContext): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const rawRoot of context.allowedRootPaths) {
    const root = normalizeSeparators(String(rawRoot || ""));
    const key = normalizedRootKey(root);
    if (!root || !isAbsolutePath(root) || seen.has(key)) continue;
    seen.add(key);
    roots.push(root);
  }
  return roots;
}

function matchingAllowedRoot(rawRoot: string, allowedRoots: string[]): string | null {
  const key = normalizedRootKey(rawRoot);
  return allowedRoots.find((root) => normalizedRootKey(root) === key) || null;
}

export function resolveMarkdownFilePreviewTarget(
  node: MarkdownFilePreviewNodeFields,
  context: MarkdownFilePreviewContext,
): MarkdownFilePreviewTarget | null {
  const attributes = node.attributes || {};
  const allowedRoots = uniqueAllowedRoots(context);
  if (allowedRoots.length === 0) return null;

  const localFsRelativePath = attributes["local-fs:relative-path"] || "";
  const localFsRootPath = attributes["local-fs:root-path"] || "";
  if (isMarkdownPath(localFsRelativePath)) {
    const rootPath = matchingAllowedRoot(localFsRootPath, allowedRoots);
    const relativePath = safeRelativePath(localFsRelativePath);
    if (rootPath && relativePath) {
      return { rootPath, relativePath };
    }
  }

  const vaultRelativePath = attributes["vault:path"] || "";
  if (attributes["vault:kind"] === "file" && isMarkdownPath(vaultRelativePath)) {
    const relativePath = safeRelativePath(vaultRelativePath);
    if (relativePath) {
      return { rootPath: allowedRoots[0]!, relativePath };
    }
  }

  const linkPath = pathWithoutFragment(String(node.link || ""));
  if (!isMarkdownPath(linkPath)) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(linkPath) && !isWindowsAbsolutePath(linkPath)) {
    return null;
  }

  if (isAbsolutePath(linkPath)) {
    for (const rootPath of allowedRoots.sort((a, b) => b.length - a.length)) {
      const relativePath = relativePathWithinRoot(linkPath, rootPath);
      if (relativePath) return { rootPath, relativePath };
    }
    return null;
  }

  const relativePath = safeRelativePath(linkPath);
  return relativePath ? { rootPath: allowedRoots[0]!, relativePath } : null;
}
