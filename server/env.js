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

export function getImageGenerationModel() {
  return process.env.HF_IMAGE_MODEL || undefined;
}

export function isHfApiDisabled() {
  return process.env.DISABLE_HF_API === "1";
}

export function getPort() {
  const port = Number(process.env.PORT);

  if (Number.isFinite(port)) {
    return port;
  }

  return DEFAULT_PORT;
}
