#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const pkg = require("../package.json");
const VERSION = pkg.version;
const RELEASE_BASE_URL =
  process.env.OPENNEXUS_RELEASE_BASE_URL ||
  `https://github.com/Alpha-Innovation-Labs/opennexus/releases/download/v${VERSION}`;

function resolveTarget() {
  const key = `${process.platform}:${process.arch}`;
  const map = {
    "darwin:arm64": {
      triple: "aarch64-apple-darwin",
      binaryName: "opennexus",
    },
    "darwin:x64": {
      triple: "x86_64-apple-darwin",
      binaryName: "opennexus",
    },
    "linux:x64": {
      triple: "x86_64-unknown-linux-gnu",
      binaryName: "opennexus",
    },
    "linux:arm64": {
      triple: "aarch64-unknown-linux-gnu",
      binaryName: "opennexus",
    },
    "win32:x64": {
      triple: "x86_64-pc-windows-msvc",
      binaryName: "opennexus.exe",
    },
  };

  return map[key] || null;
}

function getCacheRoot() {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  }

  if (process.env.XDG_CACHE_HOME) {
    return process.env.XDG_CACHE_HOME;
  }

  return path.join(os.homedir(), ".cache");
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        downloadFile(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(
          new Error(`Download failed (${response.statusCode}) for ${url}`),
        );
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

function runBinary(binaryPath) {
  const result = spawnSync(binaryPath, args, { stdio: "inherit" });
  if (result.error) {
    console.error(`Failed to execute ${binaryPath}: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(typeof result.status === "number" ? result.status : 0);
}

async function ensureManagedBinary(target) {
  const cacheRoot = getCacheRoot();
  const installDir = path.join(
    cacheRoot,
    "opennexus",
    "bin",
    VERSION,
    target.triple,
  );
  const binaryPath = path.join(installDir, target.binaryName);

  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  fs.mkdirSync(installDir, { recursive: true });
  const assetName = `opennexus-${target.triple}${
    target.binaryName.endsWith(".exe") ? ".exe" : ""
  }`;
  const url = `${RELEASE_BASE_URL}/${assetName}`;

  console.error(`Installing opennexus ${VERSION} (${target.triple})...`);
  await downloadFile(url, binaryPath);

  if (process.platform !== "win32") {
    fs.chmodSync(binaryPath, 0o755);
  }

  return binaryPath;
}

async function main() {
  const target = resolveTarget();
  if (!target) {
    console.error(
      `Unsupported platform for opennexus wrapper: ${process.platform}/${process.arch}`,
    );
    process.exit(1);
  }

  try {
    const managedBinary = await ensureManagedBinary(target);
    runBinary(managedBinary);
  } catch (error) {
    console.error(`Failed to install opennexus binary: ${error.message}`);
    console.error(
      "Ensure release assets are published for this version and platform.",
    );
    process.exit(1);
  }
}

main();
