import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(process.cwd());

function stripQuotes(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(fileContent) {
  const env = {};
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    env[key] = stripQuotes(value);
  }

  return env;
}

function loadEnv() {
  const externalEnvFile = process.env.FRONTEND_ENV_FILE || process.env.BACKEND_ENV_FILE || "";
  if (!externalEnvFile) {
    return {};
  }

  const envPath = path.isAbsolute(externalEnvFile)
    ? externalEnvFile
    : path.resolve(ROOT_DIR, externalEnvFile);

  if (!fs.existsSync(envPath)) {
    return {};
  }

  const fileContent = fs.readFileSync(envPath, "utf8");
  return parseEnvFile(fileContent);
}

const fileEnv = loadEnv();
const mergedEnv = { ...fileEnv, ...process.env };

const backendPort = mergedEnv.API_PORT || mergedEnv.SERVER_PORT || "8000";

export const env = {
  frontendHost: mergedEnv.FRONTEND_HOST || "127.0.0.1",
  frontendPort: Number(mergedEnv.FRONTEND_PORT || 8080),
  backendBaseUrl:
    mergedEnv.BACKEND_BASE_URL ||
    `http://127.0.0.1:${backendPort}`,
  wsToken: mergedEnv.WS_TOKEN || "",
  restWriteToken: mergedEnv.REST_WRITE_TOKEN || "",
  refreshIntervalMs: Number(mergedEnv.FRONTEND_REFRESH_INTERVAL_MS || 20000),
};
