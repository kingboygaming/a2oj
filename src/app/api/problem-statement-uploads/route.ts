import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getProblemPdfStorage,
  PROBLEM_STATEMENT_PDF_BUCKET,
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

  let storage: ReturnType<typeof getProblemPdfStorage>;
  try {
    storage = getProblemPdfStorage();
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Supabase Storage chưa được cấu hình.",
    }, { status: 503 });
  }
  const path = `${user.id}/${randomUUID()}.pdf`;
  let data: { path: string; token: string };
  try {
    const result = await storage.createSignedUploadUrl(path, { upsert: false });
    if (result.error) {
      console.error("Could not create signed problem PDF upload URL:", result.error);
      return NextResponse.json(
        {
          error: `Không thể bắt đầu tải PDF lên Supabase Storage: ${result.error.message}`,
        },
        { status: 502 },
      );
    }
    data = result.data;
  } catch (error) {
    console.error("Could not create signed problem PDF upload URL:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? `Không thể kết nối đến Supabase Storage: ${error.message}`
          : "Không thể kết nối đến Supabase Storage.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    bucket: PROBLEM_STATEMENT_PDF_BUCKET,
  });
}
