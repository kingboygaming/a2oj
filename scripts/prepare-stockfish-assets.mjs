import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectory = join(root, "node_modules", "@lichess-org", "stockfish-web");
const targetDirectory = join(root, "public", "chess-engine");

await mkdir(targetDirectory, { recursive: true });

for (const file of [
  "sf_19_smallnet.js",
  "sf_19_smallnet.wasm",
  "LICENSE",
]) {
  await copyFile(join(packageDirectory, file), join(targetDirectory, file));
}

console.log(`Prepared Stockfish web assets in ${targetDirectory}.`);
