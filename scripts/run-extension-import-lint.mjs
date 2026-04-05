import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED_PLUGIN_ROOT_DIR } from "./lib/bundled-plugin-paths.mjs";
import { classifyBundledExtensionSourcePath } from "./lib/extension-source-classifier.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionsRoot = path.join(repoRoot, BUNDLED_PLUGIN_ROOT_DIR);
const oxlintConfigPath = path.join(extensionsRoot, ".oxlintrc.import-boundaries.json");
const oxlintPath = path.resolve(repoRoot, "node_modules", ".bin", "oxlint");

function collectProductionExtensionSourceFiles(rootDir) {
  const out = [];

  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(repoRoot, fullPath).replaceAll("\\", "/");
      if (!classifyBundledExtensionSourcePath(relativePath).isProductionSource) {
        continue;
      }
      out.push(relativePath);
    }
  }

  walk(rootDir);
  return out.toSorted((left, right) => left.localeCompare(right));
}

const files = collectProductionExtensionSourceFiles(extensionsRoot);

if (files.length === 0) {
  process.exit(0);
}

const result = spawnSync(
  oxlintPath,
  ["--no-ignore", "-A", "all", "-D", "no-restricted-imports", "-c", oxlintConfigPath, ...files],
  {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
