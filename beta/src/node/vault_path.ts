"use strict";

import fs from "fs";
import path from "path";

type ValidateVaultPathOptions = {
  mustExist?: boolean;
  allowCreate?: boolean;
};

const WINDOWS_PROTECTED_SEGMENTS = new Set([
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
]);

const POSIX_PROTECTED_PATHS = new Set([
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/proc",
  "/root",
  "/sys",
  "/usr",
  "/var",
]);

function hasTraversalSegment(rawPath: string): boolean {
  return rawPath
    .replace(/\\/g, "/")
    .split("/")
    .some((segment) => segment === "..");
}

function isWindowsProtectedPath(resolvedPath: string): boolean {
  const parsed = path.win32.parse(resolvedPath);
  const relative = path.win32.relative(parsed.root, resolvedPath);
  const firstSegment = relative.split(/[\\/]/).find(Boolean)?.toLowerCase() ?? "";
  return WINDOWS_PROTECTED_SEGMENTS.has(firstSegment);
}

function isPosixProtectedPath(resolvedPath: string): boolean {
  return POSIX_PROTECTED_PATHS.has(resolvedPath);
}

function isProtectedPath(resolvedPath: string): boolean {
  if (process.platform === "win32") {
    return isWindowsProtectedPath(resolvedPath);
  }
  return isPosixProtectedPath(resolvedPath);
}

function isFilesystemRoot(resolvedPath: string): boolean {
  const parsed = path.parse(resolvedPath);
  return parsed.root === resolvedPath;
}

export function validateVaultPath(rawPath: string, options?: ValidateVaultPathOptions): string {
  const trimmed = String(rawPath || "").trim();
  if (!trimmed) {
    throw new Error("vaultPath is required.");
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error("vaultPath must be an absolute path.");
  }
  if (hasTraversalSegment(trimmed)) {
    throw new Error("vaultPath must not contain '..' segments.");
  }

  const resolvedPath = path.resolve(trimmed);
  if (isFilesystemRoot(resolvedPath)) {
    throw new Error("vaultPath must not point to a filesystem root.");
  }
  if (isProtectedPath(resolvedPath)) {
    throw new Error("vaultPath points to a protected system directory.");
  }

  if (options?.mustExist === false && options?.allowCreate) {
    const existingAncestor = findExistingAncestor(resolvedPath);
    if (!existingAncestor) {
      throw new Error("vaultPath must have an existing parent directory.");
    }
    if (isProtectedPath(existingAncestor)) {
      throw new Error("vaultPath points under a protected system directory.");
    }
    return resolvedPath;
  }

  const stats = fs.existsSync(resolvedPath) ? fs.lstatSync(resolvedPath) : null;
  if (!stats) {
    throw new Error("vaultPath must point to an existing directory.");
  }
  if (stats.isSymbolicLink()) {
    throw new Error("vaultPath must not be a symbolic link.");
  }
  if (!stats.isDirectory()) {
    throw new Error("vaultPath must point to a directory.");
  }
  return resolvedPath;
}

function findExistingAncestor(targetPath: string): string | null {
  let current = targetPath;
  while (true) {
    if (fs.existsSync(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (!parent || parent === current) {
      return null;
    }
    current = parent;
  }
}
