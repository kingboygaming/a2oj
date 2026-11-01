import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const COOKIE = "oj_session";
const CONTEST_ACCESS_COOKIE_PREFIX = "oj_contest_access_";
const CONTEST_ACCESS_TTL_SECONDS = 60 * 60 * 24 * 30;

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

function contestAccessPayload(contestId: string, expiresAt: number, passwordHash: string) {
  const passwordFingerprint = crypto.createHash("sha256").update(passwordHash).digest("hex");
  return { payload: `${contestId}.${expiresAt}.${passwordFingerprint}`, passwordFingerprint };
}

export function signContestAccessToken(contestId: string, expiresAt: number, passwordHash: string) {
  const { payload, passwordFingerprint } = contestAccessPayload(contestId, expiresAt, passwordHash);
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${expiresAt}.${passwordFingerprint}.${signature}`;
}

export function verifyContestAccessToken(
  token: string | undefined,
  contestId: string,
  passwordHash: string,
  now = Date.now(),
) {
  if (!token) return false;
  const [expiresAtText, passwordFingerprint, signature, ...extra] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (extra.length || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  const { payload, passwordFingerprint: expectedFingerprint } = contestAccessPayload(
    contestId,
    expiresAt,
    passwordHash,
  );
  const expectedSignature = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const fingerprintBuffer = Buffer.from(passwordFingerprint ?? "");
  const expectedFingerprintBuffer = Buffer.from(expectedFingerprint);
  const signatureBuffer = Buffer.from(signature ?? "");
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  return (
    fingerprintBuffer.length === expectedFingerprintBuffer.length &&
    signatureBuffer.length === expectedSignatureBuffer.length &&
    crypto.timingSafeEqual(fingerprintBuffer, expectedFingerprintBuffer) &&
    crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  );
}

export async function hasContestAccess(contestId: string, passwordHash: string | null) {
  if (!passwordHash) return true;
  const jar = await cookies();
  return verifyContestAccessToken(
    jar.get(`${CONTEST_ACCESS_COOKIE_PREFIX}${contestId}`)?.value,
    contestId,
    passwordHash,
  );
}

export async function setContestAccessCookie(contestId: string, passwordHash: string) {
  const jar = await cookies();
  const expiresAt = Date.now() + CONTEST_ACCESS_TTL_SECONDS * 1000;
  jar.set(
    `${CONTEST_ACCESS_COOKIE_PREFIX}${contestId}`,
    signContestAccessToken(contestId, expiresAt, passwordHash),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CONTEST_ACCESS_TTL_SECONDS,
    },
  );
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
