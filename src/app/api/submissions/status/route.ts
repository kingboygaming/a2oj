import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSubmissionPage } from "@/lib/public-submissions";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  myself: z.enum(["0", "1"]).default("0"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? 1,
    myself: searchParams.get("myself") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Trang không hợp lệ." }, { status: 400 });
  }

  const user = parsed.data.myself === "1" ? await getCurrentUser() : null;
  if (parsed.data.myself === "1" && !user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }

  return NextResponse.json(
    await getPublicSubmissionPage(parsed.data.page, user?.id),
  );
}
