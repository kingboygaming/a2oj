import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  MAX_PROBLEM_STATEMENT_PDF_SIZE,
  PDF_STATEMENT_PLACEHOLDER,
} from "@/lib/problem-statement-pdf-constants";

export const PROBLEM_STATEMENT_PDF_BUCKET =
  process.env.SUPABASE_PROBLEM_PDF_BUCKET || "problem-statements";
export { MAX_PROBLEM_STATEMENT_PDF_SIZE, PDF_STATEMENT_PLACEHOLDER };

export function getProblemPdfStorage() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Thiếu SUPABASE_URL (hoặc NEXT_PUBLIC_SUPABASE_URL) hoặc SUPABASE_SERVICE_ROLE_KEY để dùng PDF đề bài.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).storage.from(PROBLEM_STATEMENT_PDF_BUCKET);
}

export function isProblemPdfPathOwnedBy(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  if (!path.startsWith(prefix)) return false;
  const fileName = path.slice(prefix.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i.test(fileName);
}

export async function verifyProblemPdf(path: string, userId: string): Promise<void> {
  if (!isProblemPdfPathOwnedBy(path, userId)) {
    throw new Error("Đường dẫn PDF không hợp lệ.");
  }

  const { data: file, error } = await getProblemPdfStorage().download(path);
  if (error) {
    throw new Error(`Không thể xác minh PDF đã tải lên: ${error.message}`);
  }
  if (file.size === 0 || file.size > MAX_PROBLEM_STATEMENT_PDF_SIZE) {
    throw new Error("PDF đề bài phải có dung lượng tối đa 20 MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    throw new Error("Tệp tải lên không phải PDF hợp lệ.");
  }
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  return new TextDecoder("ascii").decode(bytes.subarray(0, 1024)).includes("%PDF-");
}
