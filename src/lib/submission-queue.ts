import { Client } from "@upstash/qstash";

const FLOW_CONTROL_KEY = "a2oj-submission-judge";

export function isSubmissionQueueConfigured() {
  if (process.env.QSTASH_DEV === "true") return true;
  return Boolean(
    process.env.QSTASH_TOKEN &&
      process.env.QSTASH_CURRENT_SIGNING_KEY &&
      process.env.QSTASH_NEXT_SIGNING_KEY,
  );
}

function getAppBaseUrl() {
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  if (process.env.QSTASH_DEV === "true") return "http://localhost:3000";
  throw new Error("Thiếu URL công khai của ứng dụng cho QStash.");
}

export async function enqueueSubmission(submissionId: string) {
  const client = new Client({
    token: process.env.QSTASH_TOKEN,
    devMode: process.env.QSTASH_DEV === "true",
  });
  const baseUrl = getAppBaseUrl();
  return client.publishJSON({
    url: `${baseUrl}/api/judge/submission`,
    body: { submissionId },
    retries: 3,
    deduplicationId: `submission-${submissionId}`,
    flowControl: {
      key: FLOW_CONTROL_KEY,
      parallelism: 2,
    },
    failureCallback: `${baseUrl}/api/judge/submission-failure`,
  });
}
