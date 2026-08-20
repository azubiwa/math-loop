import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const clientRoot = new URL("../dist/client/", import.meta.url);
const publishRoot = new URL("../dist/client/math-loop/", import.meta.url);
const clientPath = fileURLToPath(clientRoot);
const publishPath = fileURLToPath(publishRoot);

await mkdir(publishRoot, { recursive: true });

for (const entry of await readdir(clientRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  await copyFile(join(clientPath, entry.name), join(publishPath, entry.name));
}

console.log("GitHub Pages artifact prepared at dist/client/math-loop");
