/** Product entry to the existing server-owned generation route. No connection settings here. */
export function connectFlashGeneration(options: {
  destination: () => { uri: string; name: string; map: string } | null;
  prepare: () => Promise<boolean>;
  completed: (map: string) => Promise<void>;
}): { refresh: () => void } {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const type = element<HTMLSelectElement>("flash-source-type");
  const text = element<HTMLTextAreaElement>("v4-source-text");
  const sourceFile = element<HTMLInputElement>("flash-source-file");
  const attachments = element<HTMLInputElement>("flash-attachments");
  const instruction = element<HTMLTextAreaElement>("flash-instruction");
  const submit = element<HTMLButtonElement>("flash-generate");
  const refresh = element<HTMLButtonElement>("flash-check");
  const status = element<HTMLElement>("flash-generation-status");
  const target = element<HTMLElement>("flash-destination");
  type Pending = { request: Record<string, unknown>; job?: string; map: string };
  let pending: Pending | null = null;
  let busy = false;
  let lastJob: { id: string; map: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const storageKey = () => `m3e:flash:${options.destination()?.map ?? ""}`;
  const remember = () => {
    // Only an opaque reference is retained. Source materials never enter browser storage.
    if (pending?.job) try { sessionStorage.setItem(`m3e:flash:${pending.map}`, JSON.stringify({ job: pending.job, map: pending.map })); } catch { /* storage may be disabled */ }
  };
  function updateType(): void {
    const file = ["document", "image", "audio", "video"].includes(type.value);
    sourceFile.hidden = !file; text.hidden = file;
    sourceFile.accept = type.value === "image" ? "image/*" : type.value === "audio" ? "audio/*" : type.value === "video" ? "video/*" : ".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx";
    text.placeholder = type.value === "url" ? "資料のURL" : "話題または素材の本文";
  }
  async function fileInput(file: File, chosen?: string): Promise<Record<string, string>> {
    if (!file.size || file.size > 45 * 1024 * 1024) throw new Error("ファイルは空でない45 MiB以下のものを選んでください。");
    const mime = file.type || "application/octet-stream";
    const kind = chosen || (["image", "audio", "video"].find(k => mime.startsWith(k + "/")) ?? "document");
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("ファイルを読み取れませんでした。"));
      reader.readAsDataURL(file);
    });
    return { type: kind, filename: file.name, mime_type: mime, base64 };
  }
  async function call(url: string, body?: Record<string, unknown>): Promise<Record<string, any>> {
    const response = await fetch(url, { method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(120000), headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("処理を受け付けられませんでした。入力と接続を確認してください。");
    return response.json();
  }
  async function check(): Promise<void> {
    if (busy || !pending) return;
    busy = true;
    try {
      const result = pending.job
        ? await call(`/api/flash/jobs/${encodeURIComponent(pending.job)}`)
        : await call("/api/flash/jobs", pending.request);
      pending.job = result.job_id; pending.request = {}; remember();
      if (result.state === "succeeded") {
        const map = pending.map;
        status.textContent = `保存完了：${result.result?.node_count ?? ""} node。`;
        try { sessionStorage.removeItem(`m3e:flash:${pending.map}`); } catch { /* optional */ }
        pending = null; submit.disabled = false; refresh.hidden = true;
        await options.completed(map);
      } else if (result.state === "failed" || result.state === "indeterminate") {
        status.textContent = result.state === "failed" ? "生成または保存に失敗しました。再生成前に結果を確認してください。" : "結果を確定できませんでした。「状態を確認」で同じ処理を確認してください。";
        // Retain the same job; never silently regenerate an uncertain outcome.
        refresh.hidden = false;
        if (result.state === "failed") {
          lastJob = { id: result.job_id, map: pending.map };
          try { sessionStorage.removeItem(`m3e:flash:${pending.map}`); } catch { /* optional */ }
          pending = null; submit.disabled = false; submit.textContent = "新しく生成して保存";
        }
      } else {
        status.textContent = "処理中です。完了すると指定先に保存します。";
        timer = setTimeout(() => void check(), 3000);
      }
    } catch {
      status.textContent = "状態を取得できませんでした。「状態を確認」で同じ処理を再確認してください。";
      refresh.hidden = false;
    } finally { busy = false; }
  }
  submit.addEventListener("click", () => {
    if (busy || pending) return;
    // Disable synchronously so double click cannot create a second request.
    busy = true; submit.disabled = true;
    void (async () => {
      lastJob = null;
      const destination = options.destination();
      if (!destination) throw new Error("保存先のnodeを選択してください。");
      const files = Array.from(attachments.files ?? []);
      if (files.length > 10) throw new Error("追加添付は10件までです。");
      const primary = sourceFile.hidden ? undefined : sourceFile.files?.[0];
      if (!sourceFile.hidden && !primary) throw new Error("素材ファイルを選択してください。");
      if (sourceFile.hidden && !text.value.trim()) throw new Error("素材を入力してください。");
      if ((primary?.size ?? 0) + files.reduce((n, f) => n + f.size, 0) > 45 * 1024 * 1024) throw new Error("素材と添付の合計は45 MiB以下にしてください。");
      if (!await options.prepare()) throw new Error("先にmapを保存してください。");
      const source = primary ? await fileInput(primary, type.value) : type.value === "url" ? { type: "url", url: text.value.trim() } : { type: type.value, text: text.value.trim() };
      const request = { request_id: crypto.randomUUID(), target: destination.uri, source, attachments: await Promise.all(files.map(f => fileInput(f))), instruction: instruction.value.trim(), language: "ja" };
      if (new TextEncoder().encode(JSON.stringify(request)).length > 64 * 1024 * 1024) throw new Error("素材と添付が大きすぎます。");
      pending = { request, map: destination.map }; status.textContent = "送信中です。";
    })().catch(error => { status.textContent = error instanceof Error ? error.message : "入力を確認してください。"; submit.disabled = false; }).finally(() => { busy = false; if (pending) void check(); });
  });
  refresh.addEventListener("click", () => { if (!pending && lastJob) pending = { job: lastJob.id, map: lastJob.map, request: {} }; clearTimeout(timer); void check(); });
  type.addEventListener("change", updateType); updateType();
  return { refresh() {
    const destination = options.destination(); target.textContent = `保存先：${destination?.name ?? "nodeを選択してください"}`;
    if (!pending && destination) try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey()) ?? "null");
      if (saved?.map === destination.map && typeof saved.job === "string") { pending = { request: {}, map: saved.map, job: saved.job }; submit.disabled = true; void check(); }
    } catch { /* no retained job */ }
  } };
}
