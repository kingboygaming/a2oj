"use client";

import { createClient } from "@supabase/supabase-js";
import { MAX_PROBLEM_STATEMENT_PDF_SIZE } from "@/lib/problem-statement-pdf-constants";

type UploadIntent = {
  path?: unknown;
  token?: unknown;
  bucket?: unknown;
  error?: unknown;
};

export async function uploadProblemStatementPdf(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Chỉ hỗ trợ file có đuôi .pdf.");
  }
  if (file.size === 0 || file.size > MAX_PROBLEM_STATEMENT_PDF_SIZE) {
    throw new Error("PDF đề bài phải có dung lượng tối đa 20 MB.");
  }
  if (!(await file.slice(0, 1024).text()).includes("%PDF-")) {
    throw new Error("Tệp tải lên không phải PDF hợp lệ.");
  }

  let response: Response;
  try {
    response = await fetch("/api/problem-statement-uploads", { method: "POST" });
  } catch {
    throw new Error("Không thể kết nối đến máy chủ để bắt đầu tải PDF lên.");
  }

  const intent = (await response.json().catch(() => null)) as UploadIntent | null;
  if (!response.ok) {
    throw new Error(
      typeof intent?.error === "string"
        ? intent.error
        : `Không thể bắt đầu tải PDF lên (HTTP ${response.status}).`,
    );
  }
  if (
    typeof intent?.path !== "string" ||
    typeof intent.token !== "string" ||
    typeof intent.bucket !== "string"
  ) {
    throw new Error("Máy chủ không trả về thông tin tải PDF hợp lệ.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY (hay NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) để tải PDF trực tiếp.",
    );
  }

  let error: Error | null;
  try {
    ({ error } = await createClient(supabaseUrl, supabaseKey)
      .storage.from(intent.bucket)
      .uploadToSignedUrl(intent.path, intent.token, file, {
        contentType: "application/pdf",
        upsert: false,
      }));
  } catch (cause) {
    throw new Error(
      cause instanceof Error
        ? `Không thể kết nối đến Supabase Storage: ${cause.message}`
        : "Không thể kết nối đến Supabase Storage.",
    );
  }
  if (error) {
    throw new Error(`Không thể tải PDF lên Supabase Storage: ${error.message}`);
  }

  return intent.path;
}
