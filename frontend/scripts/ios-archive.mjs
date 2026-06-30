import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "ios", "App");
const archivePath = join(appDir, "build", "Mitfahrbank.xcarchive");

const teamId = process.env.APPLE_TEAM_ID?.trim();
if (!teamId) {
  console.error(`
Fehler: APPLE_TEAM_ID ist nicht gesetzt.

Team-ID finden:
  developer.apple.com → Account → Membership details → Team ID (10 Zeichen)

Dann:
  export APPLE_TEAM_ID=DEINTEAMID
  npm run ios:upload

Wichtig: Apple-ID muss in Xcode → Settings → Accounts eingetragen sein.
Bei "No Accounts" oder "No profiles": siehe frontend/ios/README.md
`);
  process.exit(1);
}

if (!existsSync(join(appDir, "App.xcworkspace"))) {
  console.error("iOS-Workspace fehlt. Zuerst: npm run build:ios");
  process.exit(1);
}

const env = {
  ...process.env,
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
};

const args = [
  "-workspace",
  "App.xcworkspace",
  "-scheme",
  "App",
  "-configuration",
  "Release",
  "-archivePath",
  archivePath,
  "-allowProvisioningUpdates",
  `DEVELOPMENT_TEAM=${teamId}`,
  "archive",
];

console.log(`→ xcodebuild archive (Team ${teamId})…`);
const result = spawnSync("xcodebuild", args, { cwd: appDir, env, stdio: "inherit" });
process.exit(result.status ?? 1);
