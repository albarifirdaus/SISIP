import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const commands = [
  [process.execPath, [resolve(root, "tools/qa-static.mjs")], "QA aplikasi"],
  ["git", ["diff", "--check"], "Pemeriksaan whitespace Git"]
];

for (const [command, args, label] of commands) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Release check gagal: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log("Release check lulus: QA aplikasi dan diff Git terverifikasi.");

