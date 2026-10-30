import { createHmac, randomBytes } from "crypto";
import { spawn } from "child_process";
import { z } from "zod";
import type { Language } from "@prisma/client";

const RUNNER_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,254}$/;
const RUNNER_SECRET_MIN_LENGTH = 32;
const RUNNER_TIMEOUT_MS = 90_000;
const OUTPUT_LIMIT_BYTES = 5 * 1024 * 1024;
const MAX_SAMPLE_RUNS = 20;

const resultSchema = z.object({
  verdict: z.enum(["OK", "TLE", "RTE", "CE"]),
  output: z.string(),
  error: z.string(),
  timeMs: z.number().int().nonnegative(),
});

export type IdeRunResult = z.infer<typeof resultSchema>;

const samplesResultSchema = z.object({
  results: z.array(
    z.object({
      sampleId: z.string(),
      result: resultSchema,
    }),
  ).max(MAX_SAMPLE_RUNS),
});

function getRemoteRunnerUrl() {
  const configuredUrl = process.env.IDE_RUNNER_URL?.trim();
  if (!configuredUrl) return null;

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("IDE_RUNNER_URL phải là một URL hợp lệ.");
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("IDE_RUNNER_URL phải dùng HTTPS.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("IDE_RUNNER_URL không được chứa thông tin đăng nhập hoặc fragment.");
  }
  return url.toString();
}

async function runRemotePayload<T>(
  url: string,
  payload: object,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T> {
  const secret = process.env.IDE_RUNNER_SECRET?.trim();
  if (!secret || secret.length < RUNNER_SECRET_MIN_LENGTH) {
    throw new Error("IDE_RUNNER_SECRET phải có ít nhất 32 ký tự.");
  }

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        "x-tinoj-timestamp": timestamp,
        "x-tinoj-nonce": nonce,
        "x-tinoj-signature": signature,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (Buffer.byteLength(responseText, "utf8") > OUTPUT_LIMIT_BYTES) {
      throw new Error("IDE runner trả về dữ liệu vượt giới hạn.");
    }

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      throw new Error("IDE runner trả về JSON không hợp lệ.");
    }
    if (!response.ok) {
      const error =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "error" in responseBody &&
        typeof responseBody.error === "string"
          ? responseBody.error
          : `IDE runner trả về HTTP ${response.status}.`;
      throw new Error(error.slice(0, 1000));
    }

    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      throw new Error("IDE runner trả về kết quả không hợp lệ.");
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("IDE runner vượt quá thời gian phản hồi.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runDockerPayload<T>(
  payload: object,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T> {
  const remoteRunnerUrl = getRemoteRunnerUrl();
  if (remoteRunnerUrl) {
    return runRemotePayload(remoteRunnerUrl, payload, schema, timeoutMs);
  }
  if (process.env.VERCEL === "1") {
    throw new Error(
      "Vercel không chạy Docker cục bộ. Hãy cấu hình IDE_RUNNER_URL và IDE_RUNNER_SECRET cho runner riêng.",
    );
  }

  const image = process.env.IDE_RUNNER_IMAGE ?? "tinoj-ide-runner:latest";
  if (!RUNNER_IMAGE_PATTERN.test(image)) {
    throw new Error("IDE_RUNNER_IMAGE không hợp lệ.");
  }
  const dockerCommand = process.env.IDE_DOCKER_COMMAND?.trim() || "docker";

  const child = spawn(
    dockerCommand,
    [
      "run",
      "--rm",
      "--interactive",
      "--init",
      "--pull=never",
      "--network=none",
      "--memory=768m",
      "--memory-swap=768m",
      "--cpus=1",
      "--pids-limit=64",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges:true",
      "--user=65534:65534",
      "--tmpfs=/tmp:rw,nosuid,nodev,exec,size=128m,uid=65534,gid=65534,mode=700",
      "--env=PYTHONDONTWRITEBYTECODE=1",
      image,
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );

  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finishWithError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      child.kill();
      finishWithError(new Error("Docker runner vượt quá thời gian phản hồi."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > OUTPUT_LIMIT_BYTES) {
        child.kill();
        finishWithError(new Error("Docker runner trả về dữ liệu vượt giới hạn."));
        return;
      }
      stdout.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      stderrBytes += chunk.length;
      if (stderrBytes > OUTPUT_LIMIT_BYTES) {
        child.kill();
        finishWithError(new Error("Docker runner trả về thông báo lỗi vượt giới hạn."));
        return;
      }
      stderr.push(chunk);
    });

    child.on("error", (error) => {
      if ("code" in error && error.code === "ENOENT") {
        finishWithError(
          new Error(
            `Không tìm thấy Docker CLI "${dockerCommand}". Hãy đặt IDE_DOCKER_COMMAND thành đường dẫn đầy đủ của docker.exe trong .env rồi khởi động lại A2OJ.`,
          ),
        );
        return;
      }
      finishWithError(new Error(`Không thể khởi động Docker: ${error.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();
      if (code !== 0) {
        reject(
          new Error(
            stderrText
              ? `Docker runner thoát với mã ${code}: ${stderrText.slice(0, 1000)}`
              : `Docker runner thoát với mã ${code}.`,
          ),
        );
        return;
      }

      let response: unknown;
      try {
        response = JSON.parse(Buffer.concat(stdout).toString("utf8"));
      } catch {
        reject(new Error("Docker runner trả về JSON không hợp lệ."));
        return;
      }
      const parsed = schema.safeParse(response);
      if (!parsed.success) {
        reject(new Error("Docker runner trả về kết quả không hợp lệ."));
        return;
      }
      resolve(parsed.data);
    });

    child.stdin.on("error", (error) => {
      finishWithError(new Error(`Không thể gửi dữ liệu tới Docker runner: ${error.message}`));
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function runCodeInDocker(
  language: Language,
  source: string,
  input: string,
  timeLimitMs: number,
): Promise<IdeRunResult> {
  return runDockerPayload(
    { language, source, input, timeLimitMs },
    resultSchema,
    RUNNER_TIMEOUT_MS,
  );
}

export function runCodeOnSamples(
  language: Language,
  source: string,
  samples: { id: string; input: string }[],
  timeLimitMs: number,
) {
  if (samples.length === 0 || samples.length > MAX_SAMPLE_RUNS) {
    throw new Error(`Số sample phải từ 1 đến ${MAX_SAMPLE_RUNS}.`);
  }
  const perSampleTimeoutMs = Math.min(Math.max(timeLimitMs, 1), 3000);
  const timeoutMs = Math.min(
    RUNNER_TIMEOUT_MS,
    20_000 + perSampleTimeoutMs * samples.length,
  );
  return runDockerPayload(
    {
      language,
      source,
      inputs: samples.map((sample) => ({ id: sample.id, input: sample.input })),
      timeLimitMs: perSampleTimeoutMs,
    },
    samplesResultSchema,
    timeoutMs,
  );
}
