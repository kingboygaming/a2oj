import crypto from "node:crypto";
import bcrypt from "bcryptjs";

function normalizeForHash(password: string) {
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

export function hashContestPassword(password: string) {
  return bcrypt.hash(normalizeForHash(password), 12);
}

export function verifyContestPassword(password: string, passwordHash: string) {
  return bcrypt.compare(normalizeForHash(password), passwordHash);
}
