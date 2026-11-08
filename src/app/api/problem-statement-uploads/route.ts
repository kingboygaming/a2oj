import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getProblemPdfStorage,
  hasPdfHeader,
  MAX_PROBLEM_STATEMENT_PDF_SIZE,
} from "@/lib/problem-statement-pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host.toLowerCase() : "";
  } catch {
    originHost = "";
  }
  if (!originHost || !host || originHost !== host.toLowerCase()) {
    return NextResponse.json({ error: "Yêu cầu phải đến từ cùng địa chỉ A2OJ." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PROBLEM_STATEMENT_PDF_SIZE + 64 * 1024) {
    return NextResponse.json({ error: "PDF đề bài phải có dung lượng tối đa 4 MB." }, { status: 413 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu PDF." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Hãy chọn file PDF đề bài." }, { status: 400 });
  }
  if (file.size > MAX_PROBLEM_STATEMENT_PDF_SIZE) {
    return NextResponse.json({ error: "PDF đề bài phải có dung lượng tối đa 4 MB." }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Chỉ hỗ trợ tệp có đuôi .pdf." }, { status: 400 });
  }

  let storage: ReturnType<typeof getProblemPdfStorage>;
  try {
    storage = getProblemPdfStorage();
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Supabase Storage chưa được cấu hình.",
    }, { status: 503 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    return NextResponse.json({ error: "Tệp tải lên không phải PDF hợp lệ." }, { status: 400 });
  }

  const path = `${user.id}/${randomUUID()}.pdf`;
  const { error } = await storage.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    console.error("Could not upload problem PDF to Supabase Storage:", error);
    return NextResponse.json({ error: "Không thể lưu PDF trên Supabase Storage." }, { status: 502 });
  }

  return NextResponse.json({ path });
}
