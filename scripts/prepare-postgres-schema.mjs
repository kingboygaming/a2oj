import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
console.log("Prepared PostgreSQL Prisma schema.");
