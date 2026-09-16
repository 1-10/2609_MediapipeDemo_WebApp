import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const packageDir = path.join(rootDir, "node_modules", "@mediapipe", "tasks-vision");
const vendorDir = path.join(rootDir, "web", "vendor", "tasks-vision");

const requiredEntries = [
  "vision_bundle.mjs",
  "vision_bundle.mjs.map",
  "wasm",
];

async function assertExists(filePath, description) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${description} was not found at ${filePath}`);
    }

    throw error;
  }
}

try {
  await assertExists(
    packageDir,
    "MediaPipe Tasks Vision package. Run `npm install` before copying vendor files",
  );

  for (const entry of requiredEntries) {
    await assertExists(path.join(packageDir, entry), `Required MediaPipe vendor entry '${entry}'`);
  }

  await mkdir(vendorDir, { recursive: true });

  for (const entry of requiredEntries) {
    await cp(path.join(packageDir, entry), path.join(vendorDir, entry), {
      recursive: true,
      force: true,
    });
  }

  console.log(`Copied MediaPipe Tasks Vision files to ${path.relative(rootDir, vendorDir)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
