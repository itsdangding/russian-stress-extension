"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = manifest.version;

const distDir = path.join(rootDir, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipName = `russian-stress-extension-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

const filesToInclude = [
  "manifest.json",
  "accent.js",
  "background.js",
  "content.js",
  "options.css",
  "options.html",
  "options.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "stress-data.json",
  "icons",
  "LICENSE",
  "NOTICE",
  "README.md",
  "privacy-policy.md"
];

for (const file of filesToInclude) {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: Required file or directory not found: ${file}`);
    process.exit(1);
  }
}

// Build zip file using macOS / Linux zip utility with clean attributes and excluding junk
const fileList = filesToInclude.map((f) => `"${f}"`).join(" ");
const zipCmd = `zip -r -q -X "${zipPath}" ${fileList} -x "*.DS_Store" "*__MACOSX*"`;

console.log(`Packaging extension v${version} into ${zipName}...`);
try {
  execSync(zipCmd, { cwd: rootDir, stdio: "inherit" });
  const stat = fs.statSync(zipPath);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`Success! Created ${zipPath} (${sizeMb} MB)`);
} catch (error) {
  console.error("Packaging failed:", error.message);
  process.exit(1);
}
