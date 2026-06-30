import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "ios", "App");
const archivePath = join(appDir, "build", "Mitfahrbank.xcarchive");
const exportPath = join(appDir, "build", "export");
const exportOptions = join(appDir, "ExportOptions.plist");

const teamId = process.env.APPLE_TEAM_ID?.trim();
if (!teamId) {
  console.error("APPLE_TEAM_ID fehlt — siehe npm run ios:archive");
  process.exit(1);
}

if (!existsSync(archivePath)) {
  console.error(`Archiv fehlt: ${archivePath}\nZuerst: npm run ios:archive`);
  process.exit(1);
}

const env = {
  ...process.env,
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
};

const args = [
  "-exportArchive",
  "-archivePath",
  archivePath,
  "-exportOptionsPlist",
  exportOptions,
  "-exportPath",
  exportPath,
  "-allowProvisioningUpdates",
  `DEVELOPMENT_TEAM=${teamId}`,
];

console.log("→ xcodebuild exportArchive (Upload nach App Store Connect)…");
const result = spawnSync("xcodebuild", args, { cwd: appDir, env, stdio: "inherit" });
if (result.status === 0) {
  console.log("\nFertig. Prüfe App Store Connect → TestFlight (Verarbeitung dauert einige Minuten).");
}
process.exit(result.status ?? 1);
