import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const COOKIE = "oj_session";

function secret() {
  const configuredSecret = process.env.SESSION_SECRET;
  if (!configuredSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production.");
  }
  return configuredSecret ?? "dev-secret";
}

export function signUserId(userId: string, sessionVersion = 0) {
  const payload = `${userId}.${sessionVersion}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const [userId, version, sig] =
    parts.length === 2 ? [parts[0], "0", parts[1]] : parts;
  if (!userId || !sig) return null;
  const sessionVersion = Number(version);
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0) return null;
  const payload = parts.length === 2 ? userId : `${userId}.${sessionVersion}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { userId, sessionVersion };
}

export async function getCurrentUser() {
  const jar = await cookies();
  const session = verifySessionToken(jar.get(COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findFirst({
    where: { id: session.userId, sessionVersion: session.sessionVersion },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      avatarMimeType: true,
    },
  });
}

export async function setSessionCookie(userId: string, sessionVersion = 0) {
  const jar = await cookies();
  jar.set(COOKIE, signUserId(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function canPublish(role: Role) {
  return role === "TEACHER" || role === "ADMIN";
}

export function canManageContests(role: Role) {
  return role === "TEACHER" || role === "ADMIN";
}
