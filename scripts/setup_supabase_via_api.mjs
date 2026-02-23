#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || "";
const projectRef = process.env.SUPABASE_PROJECT_REF || "";
const moderatorUserId = process.env.MODERATOR_USER_ID || "";
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

if (!accessToken) {
  console.error("Error: SUPABASE_ACCESS_TOKEN is required.");
  process.exit(1);
}

if (!projectRef) {
  console.error("Error: SUPABASE_PROJECT_REF is required.");
  process.exit(1);
}

const managementApi = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

async function runQuery(query, label, parameters = []) {
  console.log(`Running: ${label}`);

  const response = await fetch(managementApi, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      parameters
    })
  });

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || raw || "Unknown API error";
    throw new Error(`${label} failed (${response.status}): ${message}`);
  }

  return payload;
}

async function main() {
  const schemaSql = await readFile(resolve(rootDir, "supabase", "schema.sql"), "utf8");
  const rlsSql = await readFile(resolve(rootDir, "supabase", "rls.sql"), "utf8");

  await runQuery(schemaSql, "Apply schema.sql");
  await runQuery(rlsSql, "Apply rls.sql");

  if (moderatorUserId) {
    await runQuery(
      "insert into public.moderators (user_id) values ($1) on conflict (user_id) do nothing;",
      "Ensure moderator",
      [moderatorUserId]
    );
  }

  if (supabaseUrl && supabaseAnonKey) {
    const moderatorLine = moderatorUserId
      ? `window.MODERATOR_USER_ID = \"${moderatorUserId}\";\n`
      : "";
    const content = `window.SUPABASE_URL = \"${supabaseUrl}\";\nwindow.SUPABASE_ANON_KEY = \"${supabaseAnonKey}\";\n${moderatorLine}`;
    const legacyConfigPath = resolve(rootDir, "config.js");
    const publicDir = resolve(rootDir, "public");
    const publicConfigPath = resolve(publicDir, "config.js");

    await mkdir(publicDir, { recursive: true });
    await Promise.all([
      writeFile(legacyConfigPath, content, "utf8"),
      writeFile(publicConfigPath, content, "utf8")
    ]);
    console.log("Updated config.js and public/config.js");
  }

  console.log("Supabase setup via API finished.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
