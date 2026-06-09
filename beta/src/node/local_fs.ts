"use strict";

import fs from "fs";
import path from "path";
import { validateVaultPath } from "./vault_path";

export type LocalFsEntryKind = "directory" | "file";

export interface LocalFsEntry {
  name: string;
  relativePath: string;
  kind: LocalFsEntryKind;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  hasChildren?: boolean;
}

export interface LocalFsListRequest {
  rootPath: string;
  relativePath?: string;
  maxEntries?: number;
}

export interface LocalFsReadRequest {
  rootPath: string;
  relativePath: string;
  maxBytes?: number;
}

const DEFAULT_MAX_ENTRIES = 500;
const MAX_ENTRIES_LIMIT = 2000;
const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_BYTES_LIMIT = 1024 * 1024;

const EXCLUDED_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".obsidian",
  ".trash",
  "node_modules",
  "dist",
  "coverage",
  "__pycache__",
]);

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function normalizeRelativePath(rawPath: string | undefined): string {
  const rawNormalized = String(rawPath || "")
    .trim()
    .replace(/\\/g, "/");
  if (path.win32.isAbsolute(rawNormalized) || path.posix.isAbsolute(rawNormalized)) {
    throw new Error("relativePath must be relative.");
  }
  const normalized = rawNormalized
    .replace(/^\/+/, "")
    .replace(/\/+$/g, "");
  if (!normalized) return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("relativePath must not contain traversal segments.");
  }
  return segments.join("/");
}

function isPathInside(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(targetPath);
  if (process.platform === "win32") {
    const rootLower = normalizedRoot.toLowerCase();
    const targetLower = normalizedTarget.toLowerCase();
    return targetLower === rootLower || targetLower.startsWith(rootLower + path.sep);
  }
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + path.sep);
}

function resolveWithinRoot(rootPath: string, relativePath: string): string {
  const targetPath = path.resolve(rootPath, relativePath);
  if (!isPathInside(rootPath, targetPath)) {
    throw new Error("relativePath escapes the mounted root.");
  }
  return targetPath;
}

function shouldExcludeName(name: string): boolean {
  return EXCLUDED_NAMES.has(name.toLowerCase());
}

function hasVisibleChildren(directoryPath: string): boolean {
  try {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    return entries.some((entry) => !shouldExcludeName(entry.name) && !entry.isSymbolicLink());
  } catch {
    return false;
  }
}

function toEntry(rootPath: string, parentRelativePath: string, dirent: fs.Dirent): LocalFsEntry | null {
  if (shouldExcludeName(dirent.name) || dirent.isSymbolicLink()) {
    return null;
  }
  if (!dirent.isDirectory() && !dirent.isFile()) {
    return null;
  }
  const relativePath = parentRelativePath ? `${parentRelativePath}/${dirent.name}` : dirent.name;
  const absolutePath = resolveWithinRoot(rootPath, relativePath);
  const stats = fs.statSync(absolutePath);
  const kind: LocalFsEntryKind = dirent.isDirectory() ? "directory" : "file";
  const entry: LocalFsEntry = {
    name: dirent.name,
    relativePath,
    kind,
    extension: kind === "file" ? path.extname(dirent.name).toLowerCase() : "",
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
  if (kind === "directory") {
    entry.hasChildren = hasVisibleChildren(absolutePath);
  }
  return entry;
}

function sortEntries(entries: LocalFsEntry[]): LocalFsEntry[] {
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function listLocalFsDirectory(request: LocalFsListRequest) {
  const rootPath = validateVaultPath(request.rootPath, { mustExist: true });
  const relativePath = normalizeRelativePath(request.relativePath);
  const directoryPath = resolveWithinRoot(rootPath, relativePath);
  const stats = fs.lstatSync(directoryPath);
  if (stats.isSymbolicLink()) {
    throw new Error("relativePath must not point to a symbolic link.");
  }
  if (!stats.isDirectory()) {
    throw new Error("relativePath must point to a directory.");
  }

  const maxEntries = clampInteger(request.maxEntries, DEFAULT_MAX_ENTRIES, 1, MAX_ENTRIES_LIMIT);
  const entries = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .map((dirent) => toEntry(rootPath, relativePath, dirent))
    .filter((entry): entry is LocalFsEntry => Boolean(entry));
  const sortedEntries = sortEntries(entries);
  const limitedEntries = sortedEntries.slice(0, maxEntries);

  return {
    ok: true,
    rootPath,
    relativePath,
    absolutePath: directoryPath,
    entries: limitedEntries,
    totalEntries: sortedEntries.length,
    truncated: sortedEntries.length > limitedEntries.length,
  };
}

export function readLocalFsFile(request: LocalFsReadRequest) {
  const rootPath = validateVaultPath(request.rootPath, { mustExist: true });
  const relativePath = normalizeRelativePath(request.relativePath);
  if (!relativePath) {
    throw new Error("relativePath is required.");
  }
  const filePath = resolveWithinRoot(rootPath, relativePath);
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) {
    throw new Error("relativePath must not point to a symbolic link.");
  }
  if (!stats.isFile()) {
    throw new Error("relativePath must point to a file.");
  }

  const maxBytes = clampInteger(request.maxBytes, DEFAULT_MAX_BYTES, 1, MAX_BYTES_LIMIT);
  const bytesToRead = Math.min(stats.size, maxBytes);
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buffer, 0, bytesToRead, 0);
    if (isBinaryBuffer(buffer)) {
      throw new Error("File preview is not available for binary content.");
    }
    return {
      ok: true,
      rootPath,
      relativePath,
      absolutePath: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      truncated: stats.size > bytesToRead,
      content: buffer.toString("utf8"),
    };
  } finally {
    fs.closeSync(fd);
  }
}
