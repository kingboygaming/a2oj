import { unzipSync } from "fflate";

export type ImportedTestCase = {
  name: string;
  input: string;
  output: string;
  isSample: false;
  points: number;
};

// ZIP archive limit: 50 MB compressed (accommodate n=10^6 inputs after Deflate)
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
// Per-file uncompressed limit: 30 MB (~n=10^6 integers takes ~11 MB raw)
const MAX_ENTRY_BYTES = 30 * 1024 * 1024;
// Total uncompressed limit across all test files: 200 MB
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_CASES = 100;

export function parseTestCaseZip(data: Uint8Array): ImportedTestCase[] {
  if (data.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("File ZIP vượt quá giới hạn 50 MB.");
  }

  let totalUncompressedBytes = 0;
  let relevantFileCount = 0;
  let archiveError = "";
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(data, {
      filter: (file) => {
        if (file.name.endsWith("/")) return false;
        const basename = file.name.split("/").pop() ?? "";
        if (!/\.(in|out)$/i.test(basename)) return false;

        relevantFileCount += 1;
        if (relevantFileCount > MAX_CASES * 2) {
          archiveError = `ZIP không được có quá ${MAX_CASES} cặp test.`;
          return false;
        }
        if (file.compression !== 0 && file.compression !== 8) {
          archiveError = "ZIP chỉ hỗ trợ file không nén hoặc nén Deflate.";
          return false;
        }
        if (
          !Number.isSafeInteger(file.originalSize) ||
          file.originalSize < 0 ||
          file.originalSize > MAX_ENTRY_BYTES
        ) {
          archiveError = "Mỗi file test phải có kích thước không quá 30 MB.";
          return false;
        }

        totalUncompressedBytes += file.originalSize;
        if (totalUncompressedBytes > MAX_TOTAL_BYTES) {
          archiveError = "Tổng dung lượng giải nén của test không được quá 200 MB.";
          return false;
        }
        return true;
      },
    });
  } catch {
    throw new Error("File ZIP bị lỗi hoặc chứa dữ liệu không thể giải nén.");
  }

  if (archiveError) throw new Error(archiveError);

  const pairs = new Map<
    string,
    { name: string; input?: string; output?: string }
  >();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  for (const [path, content] of Object.entries(files)) {
    const basename = path.split("/").pop() ?? "";
    const match = /^(.*)\.(in|out)$/i.exec(basename);
    if (!match || !match[1]) continue;

    const name = match[1];
    const key = name.toLocaleLowerCase();
    const pair = pairs.get(key) ?? { name };
    const field = match[2].toLowerCase() === "in" ? "input" : "output";
    if (pair[field] !== undefined) {
      throw new Error(
        `Có nhiều file .${field === "input" ? "in" : "out"} cho test "${name}".`,
      );
    }

    try {
      pair[field] = decoder.decode(content);
    } catch {
      throw new Error(`File ${basename} không phải văn bản UTF-8 hợp lệ.`);
    }
    pairs.set(key, pair);
  }

  if (pairs.size === 0) {
    throw new Error("ZIP không có file .in/.out nào.");
  }
  if (pairs.size > MAX_CASES) {
    throw new Error(`ZIP không được có quá ${MAX_CASES} cặp test.`);
  }

  const incomplete = [...pairs.values()].find((pair) => pair.input === undefined || pair.output === undefined);
  if (incomplete) {
    const missingExtension = incomplete.input === undefined ? ".in" : ".out";
    throw new Error(`Test "${incomplete.name}" thiếu file ${missingExtension}.`);
  }

  return [...pairs.values()]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((pair) => ({
      name: pair.name,
      input: pair.input ?? "",
      output: pair.output ?? "",
      isSample: false,
      points: 100,
    }));
}
