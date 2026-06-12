"use strict";

(function () {
interface ArtifactItem {
  id: string;
  title: string;
  project: string;
  kind: string;
  href: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface ArtifactListResponse {
  ok: true;
  generatedAt: string;
  artifacts: ArtifactItem[];
  roots: string[];
}

let artifacts: ArtifactItem[] = [];
let searchQuery = "";
let kindFilter = "";

const listEl = document.getElementById("artifacts-list") as HTMLElement;
const emptyEl = document.getElementById("artifacts-empty") as HTMLElement;
const statusEl = document.getElementById("artifacts-status") as HTMLElement;
const summaryEl = document.getElementById("artifacts-summary") as HTMLElement;
const searchEl = document.getElementById("artifacts-search") as HTMLInputElement;
const kindEl = document.getElementById("artifacts-kind") as HTMLSelectElement;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(text: string): void {
  statusEl.textContent = text;
  if (!text) return;
  window.setTimeout(() => {
    if (statusEl.textContent === text) statusEl.textContent = "";
  }, 4000);
}

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

async function fetchArtifacts(): Promise<ArtifactItem[]> {
  const res = await fetch("/api/artifacts");
  const body = await res.json() as ArtifactListResponse | { ok: false; error: string };
  if (!res.ok || !("ok" in body) || body.ok !== true) {
    throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
  }
  return Array.isArray(body.artifacts) ? body.artifacts : [];
}

function artifactMatches(item: ArtifactItem): boolean {
  if (kindFilter && item.kind !== kindFilter) return false;
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  return [
    item.title,
    item.project,
    item.kind,
    item.path,
  ].some((value) => value.toLowerCase().includes(q));
}

function renderKindOptions(): void {
  const kinds = Array.from(new Set(artifacts.map((item) => item.kind))).sort();
  const current = kindEl.value;
  kindEl.innerHTML = `<option value="">All types</option>${kinds
    .map((kind) => `<option value="${escapeHtml(kind)}">${escapeHtml(kind.toUpperCase())}</option>`)
    .join("")}`;
  kindEl.value = kinds.includes(current) ? current : "";
}

function render(): void {
  const shown = artifacts.filter(artifactMatches);
  summaryEl.textContent = `${shown.length} shown / ${artifacts.length} indexed`;
  emptyEl.hidden = shown.length > 0;
  listEl.innerHTML = shown.map((item) => `
    <article class="artifact-row">
      <div class="artifact-kind">${escapeHtml(item.kind.toUpperCase())}</div>
      <div class="artifact-body">
        <a class="artifact-title" href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>
        <div class="artifact-meta">
          <span>${escapeHtml(item.project)}</span>
          <span>${escapeHtml(formatBytes(item.sizeBytes))}</span>
          <span>${escapeHtml(relTime(item.modifiedAt))}</span>
        </div>
        <div class="artifact-path">${escapeHtml(item.path)}</div>
      </div>
      <a class="artifact-open" href="${escapeHtml(item.href)}">Open</a>
    </article>
  `).join("");
}

async function init(): Promise<void> {
  try {
    artifacts = await fetchArtifacts();
    renderKindOptions();
    render();
  } catch (err) {
    summaryEl.textContent = "Artifact index unavailable";
    setStatus((err as Error).message);
  }
}

searchEl.addEventListener("input", () => {
  searchQuery = searchEl.value;
  render();
});

kindEl.addEventListener("change", () => {
  kindFilter = kindEl.value;
  render();
});

void init();
})();
