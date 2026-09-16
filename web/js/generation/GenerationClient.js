/**
 * @typedef {import("../../../shared/types.js").GeneratedImage} GeneratedImage
 */

/**
 * @param {string} prompt
 * @returns {Promise<GeneratedImage>}
 */
export async function generateImage(prompt) {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

/**
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function buildErrorMessage(response) {
  const fallback = `Image generation failed: ${response.status}`;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await response.json();
      const message = body?.error ?? body?.message;
      return message ? `${fallback} ${message}` : fallback;
    } catch {
      return fallback;
    }
  }

  const text = await response.text();
  return text ? `${fallback} ${text}` : fallback;
}
