/**
 * Push a device outbox to one server.
 *   node outbox_cli.js push --outbox <file> --server <url>
 * Rejected entries are printed as JSON. They have already left the outbox.
 */
import { pushOutboxFile } from "./outbox";

function arg(name: string, argv: string[]): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(argv: string[]): Promise<void> {
  if (argv[0] !== "push") throw new Error("usage: outbox_cli.js push --outbox <file> --server <url>");
  const outbox = arg("--outbox", argv);
  const server = arg("--server", argv);
  if (!outbox || !server) throw new Error("usage: outbox_cli.js push --outbox <file> --server <url>");
  const report = await pushOutboxFile(outbox, server);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: Error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
