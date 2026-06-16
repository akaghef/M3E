/*****
 * Mapify browser-context fetch stub.
 *
 * This file is intentionally NOT a Node/curl cookie scraper.
 * Run only inside a logged-in Mapify browser page context or content script.
 * Pass only fetched JSON back to local tools.
 *****/

async function fetchMapifyContentJsonInPageContext(fileId) {
  if (!fileId) throw new Error("fileId is required");
  const res = await fetch("/api/history/download-user-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileId, subFilename: "content.json" })
  });
  if (!res.ok) throw new Error(`Mapify fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

// Example browser-console usage:
// const contentJson = await fetchMapifyContentJsonInPageContext("<file-id>");
// copy(JSON.stringify(contentJson, null, 2));

export { fetchMapifyContentJsonInPageContext };
