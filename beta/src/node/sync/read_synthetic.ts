import { FileScopeJournalStore } from "./journal_store";

const peerRoot = process.argv[2];
if (!peerRoot) throw new Error("peerRoot is required");
const store = new FileScopeJournalStore(peerRoot);
const records = store.readScope("scope-synthetic");
process.stdout.write(`${JSON.stringify({ count: records.length, record: records[0] ?? null })}\n`);
