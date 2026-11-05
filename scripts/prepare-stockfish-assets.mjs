import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetDirectory = join(root, "public", "chess-engine");

await mkdir(targetDirectory, { recursive: true });

const assets = [
  {
    file: "stockfish-19-lite-single.js",
    url: "https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.js",
    sha256: "ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a",
  },
  {
    file: "stockfish-19-lite-single.wasm",
    url: "https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.wasm",
    sha256: "ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de",
  },
  {
    file: "Copying.txt",
    url: "https://raw.githubusercontent.com/nmrugg/stockfish.js/v19.0.1/Copying.txt",
    size: 35821,
  },
];

for (const asset of assets) {
  const destination = join(targetDirectory, asset.file);
  let contents;
  try {
    contents = await readFile(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const hash = contents && createHash("sha256").update(contents).digest("hex");
  if (
    contents &&
    ((asset.sha256 && hash === asset.sha256) ||
      (!asset.sha256 && contents.length === asset.size))
  ) {
    continue;
  }

  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Could not download ${asset.file}: ${response.status} ${response.statusText}`);
  }
  contents = Buffer.from(await response.arrayBuffer());
  const downloadedHash = createHash("sha256").update(contents).digest("hex");
  if (
    (asset.sha256 && downloadedHash !== asset.sha256) ||
    (asset.size && contents.length !== asset.size)
  ) {
    throw new Error(`Integrity check failed for ${asset.file}.`);
  }
  await writeFile(destination, contents);
}

for (const file of [
  "sf_19_smallnet.js",
  "sf_19_smallnet.wasm",
  "LICENSE",
  "stockfish-worker.js",
]) {
  try {
    await unlink(join(targetDirectory, file));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

console.log(`Prepared Stockfish 19 single-threaded assets in ${targetDirectory}.`);
