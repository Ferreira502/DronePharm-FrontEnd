function formatValidationEntry(entry = {}) {
  const path = Array.isArray(entry.loc) ? entry.loc.join(".") : "campo";
  const message = entry.msg || entry.message || "valor invalido";
  return `${path}: ${message}`;
}

function extractErrorMessage(payload, response) {
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((entry) => formatValidationEntry(entry)).join(" | ");
  }

  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload)) {
    return payload.map((entry) => formatValidationEntry(entry)).join(" | ");
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return `HTTP ${response.status}`;
}

async function normalizeJsonResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  return { detail: text };
}

export class HttpClient {
  async request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const payload = await normalizeJsonResponse(response);
    if (!response.ok) {
      const error = new Error(extractErrorMessage(payload, response));
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }
}
