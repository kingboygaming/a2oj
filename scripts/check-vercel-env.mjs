const required = ["DATABASE_URL", "DIRECT_URL", "SESSION_SECRET"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `Missing required Vercel environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!/^postgres(?:ql)?:\/\//.test(process.env[name])) {
    console.error(
      `${name} must use a PostgreSQL connection URL starting with postgres:// or postgresql://.`,
    );
    process.exit(1);
  }
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET must contain at least 32 characters.");
  process.exit(1);
}
