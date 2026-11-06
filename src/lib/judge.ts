import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { Language, TestCase, Verdict } from "@prisma/client";

const execFileAsync = promisify(execFile);
const PYTHON_TIME_LIMIT_MULTIPLIER = 2;

function effectiveTimeLimitMs(language: Language, timeLimitMs: number) {
  return language === "PYTHON"
    ? timeLimitMs * PYTHON_TIME_LIMIT_MULTIPLIER
    : timeLimitMs;
}

export type JudgeResult = {
  verdict: Verdict;
  score: number;
  timeMs: number;
  log: string;
  testResults: { test: number; verdict: Verdict; timeMs: number; score?: number }[];
};

/**
 * Chuẩn hóa chuỗi output theo quy chuẩn Online Judge:
 * - Chuyển CRLF thành LF.
 * - Xóa khoảng trắng thừa ở cuối mỗi dòng.
 * - Xóa khoảng trắng và dòng trống ở cuối văn bản.
 */
function normalize(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * So khớp output của thí sinh với đáp án testcase theo chuẩn Competitive Programming:
 * 1. So sánh chuỗi đã chuẩn hóa (nhanh nhất).
 * 2. Nếu khác biệt chỉ do định dạng dấu cách/xuống dòng giữa các số, so khớp từng token (Codeforces / Themis standard).
 */
function compareOutput(actual: string, expected: string): boolean {
  const normA = normalize(actual);
  const normE = normalize(expected);
  if (normA === normE) return true;

  // Fallback so khớp theo token (bỏ qua mọi khoảng trắng, tab, newline thừa)
  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensE = normE.split(/\s+/).filter(Boolean);
  if (tokensA.length !== tokensE.length) return false;

  for (let i = 0; i < tokensA.length; i++) {
    if (tokensA[i] !== tokensE[i]) return false;
  }
  return true;
}

/**
 * Chấm xấp xỉ (Heuristic): so sánh độ gần nhau của các số trong output.
 * Trả về điểm 0..testPoints theo tỉ lệ trung bình của các cặp số.
 */
function heuristicScore(actual: string, expected: string, testPoints: number, tolerancePercent = 5): number {
  // Nếu khớp chính xác → full điểm
  if (compareOutput(actual, expected)) return testPoints;

  const parseNums = (s: string): number[] => {
    const tokens = normalize(s).split(/\s+/).filter(Boolean);
    const nums = tokens.map(Number);
    return nums.every((n) => !isNaN(n)) ? nums : [];
  };

  const aVals = parseNums(actual);
  const eVals = parseNums(expected);

  // Nếu expected không thuần số → dùng exact match (đã trả false ở trên)
  if (eVals.length === 0) return 0;
  // Số lượng token khác nhau → 0 điểm
  if (aVals.length !== eVals.length) return 0;

  let ratioSum = 0;
  for (let i = 0; i < eVals.length; i++) {
    const e = eVals[i];
    const a = aVals[i];
    if (e === 0 && a === 0) {
      ratioSum += 1;
    } else if (e === 0 || Math.sign(a) !== Math.sign(e)) {
      // Sai dấu hoặc expected=0 mà actual≠0 → ratio 0
      ratioSum += 0;
    } else if ((Math.abs(a - e) / Math.abs(e)) * 100 <= tolerancePercent) {
      ratioSum += 1;
    } else {
      ratioSum += Math.min(Math.abs(a), Math.abs(e)) / Math.max(Math.abs(a), Math.abs(e));
    }
  }
  return Math.max(0, Math.min(testPoints, Math.round((ratioSum / eVals.length) * testPoints)));
}

async function commandExists(cmd: string) {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [cmd], {
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

function runTimed(
  file: string,
  args: string[],
  input: string,
  timeoutMs: number,
  cwd?: string,
): Promise<{
  ok: boolean;
  tle: boolean;
  stdout: string;
  stderr: string;
  timeMs: number;
}> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finish = (payload: {
      ok: boolean;
      tle: boolean;
      stdout: string;
      stderr: string;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...payload, timeMs: Date.now() - started });
    };

    const timer = setTimeout(() => {
      try {
        if (process.platform === "win32" && child.pid) {
          execFileAsync("taskkill", ["/F", "/T", "/PID", String(child.pid)]).catch(() => {});
        } else {
          child.kill("SIGKILL");
        }
      } catch {}
      finish({
        ok: false,
        tle: true,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: "Time limit exceeded",
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      stdoutBytes += chunk.length;
      if (stdoutBytes > 4 * 1024 * 1024) {
        try { child.kill("SIGKILL"); } catch {}
        finish({
          ok: false,
          tle: false,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: "Output limit exceeded",
        });
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
      if (stderrBytes > 4 * 1024 * 1024) {
        try { child.kill("SIGKILL"); } catch {}
        finish({
          ok: false,
          tle: false,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: "Error output limit exceeded",
        });
      }
    });

    child.on("error", (err) => {
      finish({
        ok: false,
        tle: false,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: err.message,
      });
    });

    child.on("close", (code) => {
      const errStr = Buffer.concat(stderrChunks).toString("utf8");
      finish({
        ok: code === 0,
        tle: false,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: errStr || (code === 0 ? "" : `exit ${code}`),
      });
    });

    child.stdin.on("error", () => {});
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function wrapSourceForFileIO(
  language: Language,
  source: string,
  inputFile?: string | null,
  outputFile?: string | null,
): string {
  if (!inputFile || !outputFile) return source;

  if (language === "CPP") {
    const bridge = `
#include <stdio.h>
#include <stdlib.h>
#include <iostream>

static FILE* __a2oj_freopen(const char* filename, const char* mode, FILE* stream) {
    const bool is_stdin = stream == stdin;
    FILE* reopened = ::freopen(filename, mode, stream);
    // Keep cin attached to the newly reopened stdin even when user code called
    // sync_with_stdio(false) before freopen.
    if (reopened && is_stdin) {
        (void)std::ios::sync_with_stdio(true);
    }
    return reopened;
}

#ifdef _WIN32
#include <io.h>
#define __a2oj_dup _dup
#define __a2oj_read _read
#else
#include <unistd.h>
#define __a2oj_dup dup
#define __a2oj_read read
#endif

#ifdef __cplusplus
namespace __a2oj_file_bridge {
    static int __real_stdout_fd = -1;
    static FILE* __real_stdout = NULL;

    static void __flush_to_real_stdout() {
        fflush(NULL);
        FILE* fp = fopen("${outputFile}", "r");
        if (fp) {
            char buf[8192];
            size_t n;
            while ((n = fread(buf, 1, sizeof(buf), fp)) > 0) {
                if (__real_stdout) {
                    fwrite(buf, 1, n, __real_stdout);
                } else if (__real_stdout_fd >= 0) {
                    (void)write(__real_stdout_fd, buf, (unsigned int)n);
                }
            }
            fclose(fp);
            if (__real_stdout) fflush(__real_stdout);
        }
    }

    static struct __BridgeInit {
        __BridgeInit() {
            __real_stdout_fd = __a2oj_dup(1);
            if (__real_stdout_fd >= 0) {
                __real_stdout = fdopen(__real_stdout_fd, "w");
            }
            FILE* in_file = fopen("${inputFile}", "w");
            if (in_file) {
                char buf[8192];
                int n;
                while ((n = __a2oj_read(0, buf, sizeof(buf))) > 0) {
                    fwrite(buf, 1, n, in_file);
                }
                fclose(in_file);
            }
            #ifdef _WIN32
            freopen("NUL", "r", stdin);
            freopen("NUL", "w", stdout);
            #else
            freopen("/dev/null", "r", stdin);
            freopen("/dev/null", "w", stdout);
            #endif
            atexit(__flush_to_real_stdout);
        }
    } __bridge_init;
}
#endif
`;
    const fileIoSource = source.replace(/(?:std::|::)?\bfreopen(?=\s*\()/g, "__a2oj_freopen");
    return bridge + "\n" + fileIoSource;
  }

  if (language === "PYTHON") {
    const bridge = `
import os, sys, atexit
try:
    __real_stdout_fd = os.dup(1)
    __real_stdout = os.fdopen(__real_stdout_fd, "w", encoding="utf-8", buffering=1)
    __input_data = sys.stdin.read()
    with open("${inputFile}", "w", encoding="utf-8") as __in_f:
        __in_f.write(__input_data)
    sys.stdin = open(os.devnull, "r", encoding="utf-8")
    __devnull_out = open(os.devnull, "w", encoding="utf-8")
    sys.stdout = __devnull_out
    try:
        os.dup2(__devnull_out.fileno(), 1)
    except Exception:
        pass
    def __a2oj_dump_output():
        try:
            sys.stdout.flush()
        except Exception:
            pass
        if os.path.exists("${outputFile}"):
            try:
                with open("${outputFile}", "r", encoding="utf-8") as __out_f:
                    __content = __out_f.read()
                    if __content:
                        __real_stdout.write(__content)
                        __real_stdout.flush()
            except Exception:
                pass
    atexit.register(__a2oj_dump_output)
except Exception:
    pass
`;
    return bridge + "\n" + source;
  }

  return source;
}

async function gradeWithCompiler(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
  inputFile?: string | null,
  outputFile?: string | null,
  judgeType?: string | null,
  heuristicTolerancePercent = 5,
): Promise<JudgeResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tinoj-"));
  let maxTime = 0;
  const logs: string[] = [];
  const effectiveSource =
    language === "CPP"
      ? wrapSourceForFileIO(language, source, inputFile, outputFile)
      : source;
  const executionTimeLimitMs = effectiveTimeLimitMs(language, timeLimitMs);

  try {
    if (language === "PYTHON") {
      const srcPath = path.join(dir, "main.py");
      await fs.writeFile(srcPath, effectiveSource, "utf8");
      const py = (await commandExists("python")) ? "python" : "python3";
      if (!(await commandExists(py))) {
        throw new Error("NO_PYTHON");
      }

      // Chạy song song các testcase Python trong thư mục riêng để tránh xung đột file IO
      const testRuns = await Promise.all(
        tests.map(async (test, index) => {
          const testDir = path.join(dir, `test_${index}`);
          await fs.mkdir(testDir, { recursive: true });
          if (inputFile) {
            await fs.writeFile(path.join(testDir, inputFile), test.input, "utf8");
          }
          const processInput = inputFile ? "" : test.input;
          const run = await runTimed(py, [srcPath], processInput, executionTimeLimitMs + 500, testDir);

          let actualStdout = "";
          let outputFileFound = true;
          if (outputFile) {
            try {
              actualStdout = await fs.readFile(path.join(testDir, outputFile), "utf8");
            } catch {
              outputFileFound = false;
              actualStdout = "__A2OJ_FILE_NOT_FOUND__";
            }
          } else {
            actualStdout = run.stdout;
          }

          return { test, index, run: { ...run, stdout: actualStdout }, outputFileFound };
        }),
      );

      // Kiểm tra Compile Error (SyntaxError)
      for (const { run } of testRuns) {
        if (!run.ok && /\b(?:SyntaxError|IndentationError|TabError)\b/.test(run.stderr)) {
          return {
            verdict: "CE",
            score: 0,
            timeMs: run.timeMs,
            log: run.stderr,
            testResults: [{ test: 1, verdict: "CE", timeMs: run.timeMs }],
          };
        }
      }

      let passed = 0;
      let total = 0;
      let firstFailingVerdict: Verdict | null = null;
      const testResults: JudgeResult["testResults"] = [];

      for (const { test, index, run, outputFileFound } of testRuns) {
        total += test.points;
        maxTime = Math.max(maxTime, run.timeMs);
        let testVerdict: Verdict = "WA";

        if (run.tle) {
          testVerdict = "TLE";
          logs.push(`Test ${index + 1}: Time limit exceeded`);
        } else if (!run.ok) {
          testVerdict = "RTE";
          logs.push(`Test ${index + 1} RTE: ${run.stderr}`);
        } else if (!outputFileFound) {
          testVerdict = "WA";
          logs.push(`Test ${index + 1}: Không tìm thấy file output (${outputFile})`);
        } else if (judgeType === "HEURISTIC") {
          const pts = heuristicScore(run.stdout, test.output, test.points, heuristicTolerancePercent);
          passed += pts;
          testVerdict = pts === test.points ? "AC" : "WA";
          if (pts < test.points) {
            logs.push(`Test ${index + 1}: Wrong Answer`);
          }
          testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
        } else if (compareOutput(run.stdout, test.output)) {
          testVerdict = "AC";
          passed += test.points;
          testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
        } else {
          testVerdict = "WA";
          logs.push(`Test ${index + 1}: Wrong Answer`);
          testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
        }
        if (testVerdict !== "AC" && !firstFailingVerdict) {
          firstFailingVerdict = testVerdict;
        }
      }

      const finalVerdict: Verdict = passed === total ? "AC" : (firstFailingVerdict ?? "WA");
      return {
        verdict: finalVerdict,
        score: passed,
        timeMs: maxTime,
        log: passed === total ? "Accepted" : (logs.length > 0 ? logs.join("\n") : finalVerdict),
        testResults,
      };
    }

    const srcPath = path.join(dir, "main.cpp");
    const exePath = path.join(dir, process.platform === "win32" ? "main.exe" : "main");
    await fs.writeFile(srcPath, effectiveSource, "utf8");
    const compilers = (await Promise.all(
      ["g++", "clang++"].map(async (compiler) =>
        (await commandExists(compiler)) ? compiler : null,
      ),
    )).filter((compiler): compiler is string => compiler !== null);
    if (compilers.length === 0) {
      throw new Error("NO_CXX");
    }

    let compiled = false;
    for (const compiler of compilers) {
      const compile = await runTimed(
        compiler,
        ["-O3", "-std=c++17", "-pipe", srcPath, "-o", exePath],
        "",
        15000,
        dir,
      );
      if (compile.ok) {
        compiled = true;
        logs.length = 0;
        break;
      }
      logs.push(
        `${compiler}: ${compile.stderr || compile.stdout || "Compilation failed."}`,
      );
    }
    if (!compiled) {
      return {
        verdict: "CE",
        score: 0,
        timeMs: 0,
        log: logs.join("\n"),
        testResults: [],
      };
    }

    // Chạy song song tất cả testcase trong thư mục riêng để hỗ trợ File I/O
    const testRuns = await Promise.all(
      tests.map(async (test, index) => {
        const testDir = path.join(dir, `test_${index}`);
        await fs.mkdir(testDir, { recursive: true });
        if (inputFile) {
          await fs.writeFile(path.join(testDir, inputFile), test.input, "utf8");
        }
        const processInput = test.input;
        const run = await runTimed(exePath, [], processInput, timeLimitMs + 500, testDir);

        let actualStdout = "";
        let outputFileFound = true;
        if (outputFile) {
          try {
            actualStdout = await fs.readFile(path.join(testDir, outputFile), "utf8");
          } catch {
            outputFileFound = false;
            actualStdout = "__A2OJ_FILE_NOT_FOUND__";
          }
        } else {
          actualStdout = run.stdout;
        }

        return { test, index, run: { ...run, stdout: actualStdout }, outputFileFound };
      }),
    );

    let passed = 0;
    let total = 0;
    let firstFailingVerdict: Verdict | null = null;
    const testResults: JudgeResult["testResults"] = [];

    for (const { test, index, run, outputFileFound } of testRuns) {
      total += test.points;
      maxTime = Math.max(maxTime, run.timeMs);
      let testVerdict: Verdict = "WA";

      if (run.tle) {
        testVerdict = "TLE";
        logs.push(`Test ${index + 1}: Time limit exceeded`);
      } else if (!run.ok) {
        testVerdict = "RTE";
        logs.push(`Test ${index + 1} RTE: ${run.stderr}`);
      } else if (!outputFileFound) {
        testVerdict = "WA";
        logs.push(`Test ${index + 1}: Không tìm thấy file output (${outputFile})`);
      } else if (judgeType === "HEURISTIC") {
        const pts = heuristicScore(run.stdout, test.output, test.points, heuristicTolerancePercent);
        passed += pts;
        testVerdict = pts === test.points ? "AC" : "WA";
        if (pts < test.points) {
          logs.push(`Test ${index + 1}: Wrong Answer`);
        }
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
      } else if (compareOutput(run.stdout, test.output)) {
        testVerdict = "AC";
        passed += test.points;
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
      } else {
        testVerdict = "WA";
        logs.push(`Test ${index + 1}: Wrong Answer`);
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: run.timeMs });
      }
      if (testVerdict !== "AC" && !firstFailingVerdict) {
        firstFailingVerdict = testVerdict;
      }
    }

    const finalVerdict: Verdict = passed === total ? "AC" : (firstFailingVerdict ?? "WA");
    return {
      verdict: finalVerdict,
      score: passed,
      timeMs: maxTime,
      log: passed === total ? "Accepted" : (logs.length > 0 ? logs.join("\n") : finalVerdict),
      testResults,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function mockGrade(source: string, tests: TestCase[]): JudgeResult {
  const simulatedVerdicts: Record<string, Verdict> = {
    AC: "AC",
    WA: "WA",
    TLE: "TLE",
    CE: "CE",
    MLE: "MLE",
    RE: "RTE",
    RTE: "RTE",
  };
  const simulatedVerdict = source.match(
    /^\s*(?:\/\/|#)\s*OJ-MOCK-VERDICT:\s*(AC|WA|TLE|CE|MLE|RE|RTE)\s*$/m,
  )?.[1];
  const verdict = simulatedVerdict ? simulatedVerdicts[simulatedVerdict] : undefined;
  if (verdict && simulatedVerdict) {
    const score =
      verdict === "AC" ? tests.reduce((sum, test) => sum + test.points, 0) : 0;
    return {
      verdict,
      score,
      timeMs: verdict === "AC" ? 10 : 0,
      log: `Mock verdict simulation: ${simulatedVerdict}. This is not a real execution result.`,
      testResults:
        verdict === "AC"
          ? tests.map((_, index) => ({ test: index + 1, verdict: "AC", timeMs: 0 }))
          : verdict === "WA" || verdict === "RTE" || verdict === "TLE" || verdict === "MLE"
            ? [{ test: 1, verdict, timeMs: 0 }]
            : [],
    };
  }

  const trimmed = source.trim();
  if (trimmed.length < 8) {
    return {
      verdict: "CE",
      score: 0,
      timeMs: 0,
      log: "Source quá ngắn (mock judge).",
      testResults: [],
    };
  }
  if (/TODO/.test(trimmed) && trimmed.length < 40) {
    return {
      verdict: "WA",
      score: 0,
      timeMs: 12,
      log: "Mock WA: code chưa hoàn chỉnh.",
      testResults: tests.length ? [{ test: 1, verdict: "WA", timeMs: 12 }] : [],
    };
  }
  const total = tests.reduce((s, t) => s + t.points, 0);
  return {
    verdict: "AC",
    score: total,
    timeMs: 8 + Math.min(40, trimmed.length % 40),
    log: "Mock AC. Chỉ bật JUDGE_MODE=auto trong môi trường phát triển tin cậy.",
    testResults: tests.map((_, index) => ({ test: index + 1, verdict: "AC", timeMs: 0 })),
  };
}

type Judge0SubmissionResult = {
  stdout: string | null;
  time: string | null;
  memory: number | null;
  stderr: string | null;
  token: string;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
};

/**
 * Chấm điểm bài nộp thông qua Judge0 Batch API với tối ưu hóa -O3 và wall_time_limit:
 * - Hỗ trợ các bài toán có vòng lặp / tính toán lên đến 10^9 cực nhanh.
 * - Tự động phát hiện TLE chuẩn xác không bị treo server.
 */
async function gradeWithJudge0(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
  judgeType?: string | null,
  heuristicTolerancePercent = 5,
): Promise<JudgeResult> {
  const baseUrl = (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, "");
  // C++: 105 (GCC 14.1.0) hoặc 54 (GCC 9.2.0) | Python: 100 (Python 3.12.5) hoặc 92 (Python 3.11.2)
  const languageId =
    language === "CPP"
      ? Number(process.env.JUDGE0_CPP_ID || 105)
      : Number(process.env.JUDGE0_PYTHON_ID || 100);

  // Python được nhân đôi giới hạn thời gian vì CPython chậm hơn C++ đáng kể.
  const executionTimeLimitMs = effectiveTimeLimitMs(language, timeLimitMs);
  const cpuTimeLimit = Math.max(0.5, Math.min(15, Number((executionTimeLimitMs / 1000).toFixed(2))));
  const wallTimeLimit = Math.max(1.5, Math.min(30, Number(((executionTimeLimitMs * 2 + 1000) / 1000).toFixed(2))));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.JUDGE0_KEY) {
    headers["X-Auth-Token"] = process.env.JUDGE0_KEY;
    headers["X-RapidAPI-Key"] = process.env.JUDGE0_KEY;
  }

  const postRes = await fetch(`${baseUrl}/submissions/batch?base64_encoded=false`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      submissions: tests.map((t) => ({
        source_code: source,
        language_id: languageId,
        stdin: t.input,
        compiler_options: language === "CPP" ? "-O3 -std=c++17" : undefined,
        cpu_time_limit: cpuTimeLimit,
        wall_time_limit: wallTimeLimit,
      })),
    }),
  });

  if (!postRes.ok) {
    throw new Error(`Judge0 POST batch HTTP ${postRes.status}`);
  }

  const tokensData = (await postRes.json()) as Array<{ token?: string }>;
  const tokens = tokensData.map((x) => x.token).filter((t): t is string => Boolean(t));
  if (tokens.length !== tests.length) {
    throw new Error("Judge0 tokens mismatch");
  }

  // Poll Python immediately: interpreter startup is usually quick, so avoid
  // adding an unconditional 300 ms delay before the first result check.
  const tokensParam = tokens.join(",");
  let submissions: Judge0SubmissionResult[] = [];
  const pollStart = Date.now();
  // Keep polling long enough for the configured wall limit (including Python's
  // time multiplier) plus queue/network overhead, without waiting indefinitely.
  const maxPollMs = Math.max(wallTimeLimit * 1000 + 8000, 16000);
  let pollInterval = language === "PYTHON" ? 0 : 300;
  let firstPoll = true;

  while (Date.now() - pollStart < maxPollMs) {
    if (!firstPoll || language !== "PYTHON") {
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    firstPoll = false;

    const getRes = await fetch(
      `${baseUrl}/submissions/batch?tokens=${tokensParam}&base64_encoded=false`,
      { headers },
    );
    if (!getRes.ok) {
      throw new Error(`Judge0 GET batch HTTP ${getRes.status}`);
    }
    const data = (await getRes.json()) as { submissions?: Judge0SubmissionResult[] };
    if (Array.isArray(data.submissions) && data.submissions.length === tests.length) {
      const allDone = data.submissions.every((s) => s.status && s.status.id >= 3);
      if (allDone) {
        submissions = data.submissions;
        break;
      }
    }

    const pollStep = language === "PYTHON" ? 100 : 150;
    const maxPollInterval = language === "PYTHON" ? 600 : 700;
    pollInterval = Math.min(pollInterval + pollStep, maxPollInterval);
  }

  if (submissions.length !== tests.length) {
    throw new Error("Judge0 polling timed out");
  }

  // Kiểm tra Compilation Error (CE)
  const ceSub = submissions.find((s) => s.status.id === 6);
  if (ceSub) {
    return {
      verdict: "CE",
      score: 0,
      timeMs: 0,
      log: ceSub.compile_output || ceSub.message || "Biên dịch thất bại (Compile Error).",
      testResults: [{ test: 1, verdict: "CE", timeMs: 0 }],
    };
  }

  // Đối với Python, kiểm tra cú pháp trong stderr
  if (language === "PYTHON") {
    const syntaxErrSub = submissions.find(
      (s) =>
        s.stderr &&
        /\b(?:SyntaxError|IndentationError|TabError)\b/.test(s.stderr),
    );
    if (syntaxErrSub) {
      return {
        verdict: "CE",
        score: 0,
        timeMs: 0,
        log: syntaxErrSub.stderr || "Lỗi cú pháp Python (Compile Error).",
        testResults: [{ test: 1, verdict: "CE", timeMs: 0 }],
      };
    }
  }

  let passed = 0;
  let total = 0;
  let maxTime = 0;
  let firstFailingVerdict: Verdict | null = null;
  const logs: string[] = [];
  const testResults: JudgeResult["testResults"] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const sub = submissions[i];
    total += test.points;

    const timeMs = Math.max(1, Math.round(parseFloat(sub.time ?? "0") * 1000));
    maxTime = Math.max(maxTime, timeMs);

    let testVerdict: Verdict = "WA";

    if (sub.status.id === 5) {
      testVerdict = "TLE";
      logs.push(`Test ${i + 1}: Time limit exceeded`);
    } else if (sub.status.id >= 7 && sub.status.id <= 12) {
      testVerdict = "RTE";
      const err = sub.stderr || sub.message || sub.status.description || "Runtime Error";
      logs.push(`Test ${i + 1} RTE: ${err.trim()}`);
    } else if (sub.status.id === 3 || sub.status.id === 4) {
      if (judgeType === "HEURISTIC") {
        const pts = heuristicScore(sub.stdout ?? "", test.output, test.points, heuristicTolerancePercent);
        passed += pts;
        testVerdict = pts === test.points ? "AC" : "WA";
        if (pts < test.points) {
          logs.push(`Test ${i + 1}: Wrong Answer`);
        }
        testResults.push({ test: i + 1, verdict: testVerdict, timeMs });
      } else if (compareOutput(sub.stdout ?? "", test.output)) {
        testVerdict = "AC";
        passed += test.points;
        testResults.push({ test: i + 1, verdict: testVerdict, timeMs });
      } else {
        testVerdict = "WA";
        logs.push(`Test ${i + 1}: Wrong Answer`);
        testResults.push({ test: i + 1, verdict: testVerdict, timeMs });
      }
    } else {
      testVerdict = "RTE";
      logs.push(`Test ${i + 1} RTE: ${sub.status.description}`);
      testResults.push({ test: i + 1, verdict: testVerdict, timeMs });
    }
    if (testVerdict !== "AC" && !firstFailingVerdict) {
      firstFailingVerdict = testVerdict;
    }
  }

  const finalVerdict: Verdict = passed === total ? "AC" : (firstFailingVerdict ?? "WA");
  return {
    verdict: finalVerdict,
    score: passed,
    timeMs: maxTime,
    log: passed === total ? "Accepted" : (logs.length > 0 ? logs.join("\n") : finalVerdict),
    testResults,
  };
}

type WandboxResponse = {
  status?: string;
  signal?: string;
  compiler_error?: string;
  compiler_message?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
};

async function callWandboxOnce(
  compiler: string,
  code: string,
  stdin: string,
  options?: string,
  timeoutMs = 15000,
): Promise<WandboxResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler, code, stdin, options }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as WandboxResponse;
  } finally {
    clearTimeout(timer);
  }
}

function isInfrastructureError(res: WandboxResponse): boolean {
  const text = `${res.program_error ?? ""} ${res.compiler_error ?? ""} ${res.program_message ?? ""}`;
  return /crun|OCI runtime|Resource temporarily unavailable|failed to exec pid1/i.test(text);
}

async function executeOnWandbox(
  language: Language,
  code: string,
  stdin: string,
  timeoutMs: number,
): Promise<WandboxResponse> {
  // Chọn các phiên bản compiler nhanh, ổn định
  const compilers =
    language === "CPP"
      ? ["gcc-13.2.0", "gcc-12.3.0"]
      : ["cpython-3.12.7", "cpython-3.11.10", "cpython-3.10.15"];

  const options = language === "CPP" ? "-O3 -std=c++17" : undefined;
  let lastResponse: WandboxResponse | null = null;

  for (const compiler of compilers) {
    try {
      const resp = await callWandboxOnce(compiler, code, stdin, options, timeoutMs);
      if (!isInfrastructureError(resp)) {
        return resp;
      }
      lastResponse = resp;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error("Không thể kết nối đến máy chủ chấm Wandbox.");
}

export async function runReferenceCodeOnWandbox(
  language: Language,
  source: string,
  inputs: string[],
  timeLimitMs: number,
): Promise<string[]> {
  if (inputs.length < 1 || inputs.length > 10) {
    throw new Error("Số input phải từ 1 đến 10.");
  }
  const timeoutMs = Math.min(Math.max(timeLimitMs + 5000, 16000), 30_000);
  const results = await Promise.all(
    inputs.map((input) => executeOnWandbox(language, source, input, timeoutMs)),
  );
  const compileError = results.find((result) => result.compiler_error?.trim());
  if (compileError) {
    throw new Error((compileError.compiler_error || compileError.compiler_message || "Lời giải không biên dịch được.").slice(0, 2000));
  }
  const failed = results.find((result) => isInfrastructureError(result) || result.status !== "0");
  if (failed) {
    const details = failed.program_error || failed.program_message || failed.status || "Không chạy được lời giải.";
    throw new Error(details.slice(0, 2000));
  }
  return results.map((result) => result.program_output ?? "");
}

async function gradeWithWandbox(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
  judgeType?: string | null,
  heuristicTolerancePercent = 5,
): Promise<JudgeResult> {
  const timeout = Math.max(timeLimitMs + 5000, 16000);

  // Chạy song song các testcase trên Wandbox thay vì lặp tuần tự
  const executions = await Promise.all(
    tests.map(async (test, index) => {
      const started = Date.now();
      try {
        const data = await executeOnWandbox(language, source, test.input, timeout);
        const elapsed = Date.now() - started;
        return { ok: true as const, data, elapsed, test, index };
      } catch (err) {
        const elapsed = Date.now() - started;
        return { ok: false as const, error: err, elapsed, test, index };
      }
    }),
  );

  // Check Compilation Error (CE)
  for (const item of executions) {
    if (item.ok && item.data.compiler_error && item.data.compiler_error.trim().length > 0) {
      return {
        verdict: "CE",
        score: 0,
        timeMs: 0,
        log: item.data.compiler_error || item.data.compiler_message || "Biên dịch thất bại (Compile Error).",
        testResults: [{ test: item.index + 1, verdict: "CE", timeMs: 0 }],
      };
    }
    if (
      language === "PYTHON" &&
      item.ok &&
      item.data.program_error &&
      /\b(?:SyntaxError|IndentationError|TabError)\b/.test(item.data.program_error)
    ) {
      return {
        verdict: "CE",
        score: 0,
        timeMs: 0,
        log: item.data.program_error,
        testResults: [{ test: item.index + 1, verdict: "CE", timeMs: 0 }],
      };
    }
  }

  let maxTime = 0;
  let passed = 0;
  let total = 0;
  let firstFailingVerdict: Verdict | null = null;
  const logs: string[] = [];
  const testResults: JudgeResult["testResults"] = [];

  for (const item of executions) {
    const { test, index, elapsed } = item;
    total += test.points;
    maxTime = Math.max(maxTime, elapsed);
    let testVerdict: Verdict = "WA";

    if (!item.ok) {
      const isTimeout = item.error instanceof Error && item.error.name === "AbortError";
      testVerdict = isTimeout ? "TLE" : "RTE";
      logs.push(`Test ${index + 1}: ${isTimeout ? "Time limit exceeded" : String(item.error)}`);
    } else {
      const { data } = item;
      if (isInfrastructureError(data)) {
        testVerdict = "RTE";
        logs.push(`Test ${index + 1}: Máy chủ chấm đang quá tải tạm thời.`);
      } else if (
        data.signal === "Kill" ||
        data.signal === "SIGKILL" ||
        data.signal === "SIGXCPU"
      ) {
        testVerdict = "TLE";
        logs.push(`Test ${index + 1}: Time limit exceeded`);
      } else if (data.status !== "0") {
        testVerdict = "RTE";
        const errorMsg = data.program_error || data.program_message || `exit code ${data.status}`;
        logs.push(`Test ${index + 1} RTE: ${errorMsg}`);
      } else if (judgeType === "HEURISTIC") {
        const pts = heuristicScore(data.program_output ?? "", test.output, test.points, heuristicTolerancePercent);
        passed += pts;
        testVerdict = pts === test.points ? "AC" : "WA";
        if (pts < test.points) {
          logs.push(`Test ${index + 1}: Wrong Answer`);
        }
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: elapsed });
      } else if (compareOutput(data.program_output ?? "", test.output)) {
        testVerdict = "AC";
        passed += test.points;
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: elapsed });
      } else {
        testVerdict = "WA";
        logs.push(`Test ${index + 1}: Wrong Answer`);
        testResults.push({ test: index + 1, verdict: testVerdict, timeMs: elapsed });
      }
    }

    if (testVerdict !== "AC" && !firstFailingVerdict) {
      firstFailingVerdict = testVerdict;
    }
  }

  const finalVerdict: Verdict = passed === total ? "AC" : (firstFailingVerdict ?? "WA");
  return {
    verdict: finalVerdict,
    score: passed,
    timeMs: maxTime,
    log: passed === total ? "Accepted" : (logs.length > 0 ? logs.join("\n") : finalVerdict),
    testResults,
  };
}

/**
 * Điều phối chấm trên Cloud: ưu tiên Judge0 Batch API (1.5 - 3 giây),
 * nếu gặp sự cố sẽ tự động fallback sang Wandbox song song.
 */
async function gradeWithCloud(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
  inputFile?: string | null,
  outputFile?: string | null,
  judgeType?: string | null,
  heuristicTolerancePercent = 5,
): Promise<JudgeResult> {
  const effectiveSource = wrapSourceForFileIO(language, source, inputFile, outputFile);
  try {
    return await gradeWithJudge0(language, effectiveSource, tests, timeLimitMs, judgeType, heuristicTolerancePercent);
  } catch (errJudge0) {
    console.warn("Judge0 failed or unreachable, falling back to Wandbox:", errJudge0);
    try {
      return await gradeWithWandbox(language, effectiveSource, tests, timeLimitMs, judgeType, heuristicTolerancePercent);
    } catch (errWandbox) {
      const message = errWandbox instanceof Error ? errWandbox.message : String(errWandbox);
      return {
        verdict: "RTE",
        score: 0,
        timeMs: 0,
        log: `Máy chủ chấm cloud gặp sự cố kết nối: ${message}`,
        testResults: [],
      };
    }
  }
}

export async function judgeSubmission(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
  inputFile?: string | null,
  outputFile?: string | null,
  judgeType?: string | null,
  heuristicTolerancePercent = 5,
): Promise<JudgeResult> {
  const mode = process.env.JUDGE_MODE?.toLowerCase();
  if (mode === "mock") {
    return mockGrade(source, tests);
  }

  const isCloudForced =
    process.env.VERCEL === "1" ||
    mode === "cloud" ||
    mode === "judge0" ||
    mode === "wandbox";

  if (!isCloudForced) {
    try {
      return await gradeWithCompiler(language, source, tests, timeLimitMs, inputFile, outputFile, judgeType, heuristicTolerancePercent);
    } catch (err) {
      if (err instanceof Error && (err.message === "NO_CXX" || err.message === "NO_PYTHON")) {
        return await gradeWithCloud(language, source, tests, timeLimitMs, inputFile, outputFile, judgeType, heuristicTolerancePercent);
      }
      const message = err instanceof Error ? err.message : String(err);
      return { verdict: "CE", score: 0, timeMs: 0, log: message, testResults: [] };
    }
  }

  return await gradeWithCloud(language, source, tests, timeLimitMs, inputFile, outputFile, judgeType, heuristicTolerancePercent);
}
