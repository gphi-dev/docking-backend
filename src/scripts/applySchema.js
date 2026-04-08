import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applySchemaFromSqlFile() {
  const schemaFilePath = path.resolve(__dirname, "../../../database/schema.sql");
  const schemaSql = fs.readFileSync(schemaFilePath, "utf8");

  const connection = await mysql.createConnection({
    host: env.database.socketPath ? undefined : env.database.host,
    port: env.database.socketPath ? undefined : env.database.port,
    socketPath: env.database.socketPath || undefined,
    user: env.database.user,
    password: env.database.password,
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
    console.log("Schema applied successfully.");
  } finally {
    await connection.end();
  }
}

applySchemaFromSqlFile().catch((error) => {
  console.error("Failed to apply schema:", error);
  process.exit(1);
});
