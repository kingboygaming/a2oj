import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sourcePath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const targetPath = fileURLToPath(
  new URL("../prisma/schema.postgresql.prisma", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const datasourcePattern =
  /datasource db\s*\{\s*provider\s*=\s*"sqlite"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/;

if (!datasourcePattern.test(source)) {
  throw new Error("Could not find the expected SQLite datasource in prisma/schema.prisma.");
}

const postgresSchema = source.replace(
  datasourcePattern,
  `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`,
);

await writeFile(targetPath, postgresSchema, "utf8");

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../prisma/migrations");
const migrationEntries = await readdir(migrationsDir, { withFileTypes: true });
const hasVersionedMigration = await Promise.all(
  migrationEntries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      try {
        await readFile(join(migrationsDir, entry.name, "migration.sql"), "utf8");
        return true;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return false;
        }
        throw error;
      }
    }),
).then((results) => results.some(Boolean));

if (!hasVersionedMigration) {
  throw new Error(`No checked-in PostgreSQL migrations found in ${migrationsDir}.`);
}

console.log("Prepared PostgreSQL Prisma schema; using checked-in versioned migrations.");
