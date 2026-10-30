import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { Language, TestCase, Verdict } from "@prisma/client";

const execFileAsync = promisify(execFile);

export type JudgeResult = {
  verdict: Verdict;
  score: number;
  timeMs: number;
  log: string;
  testResults: { test: number; verdict: Verdict; timeMs: number }[];
};

function normalize(s: string) {
  return s.replace(/\r\n/g, "\n").trimEnd();
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
    let stdout = "";
    let stderr = "";
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
      child.kill("SIGKILL");
      finish({ ok: false, tle: true, stdout, stderr: "Time limit exceeded" });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 2 * 1024 * 1024) {
        child.kill("SIGKILL");
        finish({ ok: false, tle: false, stdout, stderr: "Output limit exceeded" });
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 2 * 1024 * 1024) {
        child.kill("SIGKILL");
        finish({ ok: false, tle: false, stdout, stderr: "Error output limit exceeded" });
      }
    });
    child.on("error", (err) => {
      finish({ ok: false, tle: false, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      finish({
        ok: code === 0,
        tle: false,
        stdout,
        stderr: stderr || (code === 0 ? "" : `exit ${code}`),
      });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function gradeWithCompiler(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
): Promise<JudgeResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tinoj-"));
  let maxTime = 0;
  const logs: string[] = [];

  try {
    if (language === "PYTHON") {
      const srcPath = path.join(dir, "main.py");
      await fs.writeFile(srcPath, source, "utf8");
      const py = (await commandExists("python")) ? "python" : "python3";
      if (!(await commandExists(py))) {
        throw new Error("NO_PYTHON");
      }
      let passed = 0;
      let total = 0;
      const testResults: JudgeResult["testResults"] = [];
      for (const [index, test] of tests.entries()) {
        total += test.points;
        const run = await runTimed(py, [srcPath], test.input, timeLimitMs + 200, dir);
        maxTime = Math.max(maxTime, run.timeMs);
        if (run.tle) {
          testResults.push({ test: index + 1, verdict: "TLE", timeMs: run.timeMs });
          return { verdict: "TLE", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
        }
        if (!run.ok) {
          if (/\b(?:SyntaxError|IndentationError|TabError)\b/.test(run.stderr)) {
            return {
              verdict: "CE",
              score: 0,
              timeMs: maxTime,
              log: run.stderr,
              testResults,
            };
          }
          logs.push(`RTE: ${run.stderr}`);
          testResults.push({ test: index + 1, verdict: "RTE", timeMs: run.timeMs });
          return { verdict: "RTE", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
        }
        if (normalize(run.stdout) === normalize(test.output)) {
          passed += test.points;
          testResults.push({ test: index + 1, verdict: "AC", timeMs: run.timeMs });
        } else {
          logs.push(`WA on test ${test.order + 1}`);
          testResults.push({ test: index + 1, verdict: "WA", timeMs: run.timeMs });
          return { verdict: "WA", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
        }
      }
      return {
        verdict: passed === total ? "AC" : "WA",
        score: passed,
        timeMs: maxTime,
        log: "Accepted",
        testResults,
      };
    }

    const srcPath = path.join(dir, "main.cpp");
    const exePath = path.join(dir, process.platform === "win32" ? "main.exe" : "main");
    await fs.writeFile(srcPath, source, "utf8");
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
        ["-O2", "-std=c++17", srcPath, "-o", exePath],
        "",
        15000,
        dir,
      );
      if (compile.ok) {
        compiled = true;
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

    let passed = 0;
    let total = 0;
    const testResults: JudgeResult["testResults"] = [];
    for (const [index, test] of tests.entries()) {
      total += test.points;
      const run = await runTimed(exePath, [], test.input, timeLimitMs + 200, dir);
      maxTime = Math.max(maxTime, run.timeMs);
      if (run.tle) {
        testResults.push({ test: index + 1, verdict: "TLE", timeMs: run.timeMs });
        return { verdict: "TLE", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
      }
      if (!run.ok) {
        logs.push(`RTE: ${run.stderr}`);
        testResults.push({ test: index + 1, verdict: "RTE", timeMs: run.timeMs });
        return { verdict: "RTE", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
      }
      if (normalize(run.stdout) === normalize(test.output)) {
        passed += test.points;
        testResults.push({ test: index + 1, verdict: "AC", timeMs: run.timeMs });
      } else {
        logs.push(`WA on test ${test.order + 1}`);
        testResults.push({ test: index + 1, verdict: "WA", timeMs: run.timeMs });
        return { verdict: "WA", score: passed, timeMs: maxTime, log: logs.join("\n"), testResults };
      }
    }
    return {
      verdict: passed === total ? "AC" : "WA",
      score: passed,
      timeMs: maxTime,
      log: "Accepted",
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

export async function judgeSubmission(
  language: Language,
  source: string,
  tests: TestCase[],
  timeLimitMs: number,
): Promise<JudgeResult> {
  const mode = process.env.JUDGE_MODE ?? "mock";
  if (mode === "mock") {
    return mockGrade(source, tests);
  }
  try {
    return await gradeWithCompiler(language, source, tests, timeLimitMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { verdict: "CE", score: 0, timeMs: 0, log: message, testResults: [] };
  }
}
