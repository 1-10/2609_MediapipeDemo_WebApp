import process from "node:process";

const DEFAULT_PORT = 8000;

try {
  process.loadEnvFile();
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

export function getHfToken() {
  return process.env.HF_TOKEN;
}

export function getPort() {
  const port = Number(process.env.PORT);

  if (Number.isFinite(port)) {
    return port;
  }

  return DEFAULT_PORT;
}
