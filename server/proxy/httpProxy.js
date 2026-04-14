import http from "node:http";
import https from "node:https";

function pickClient(targetUrl) {
  return targetUrl.protocol === "https:" ? https : http;
}

function shouldRetryWithNextToken(proxyResponse, token, authTokens) {
  const statusCode = proxyResponse.statusCode || 0;
  const isLastConfiguredToken = token === authTokens[authTokens.length - 1];
  return [401, 403].includes(statusCode) && !isLastConfiguredToken && authTokens.length > 0;
}

function buildHeaders(requestHeaders, extraHeaders) {
  const headers = { ...requestHeaders, ...extraHeaders };
  delete headers.host;
  delete headers.origin;
  return headers;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sendAttempt({ targetUrl, client, request, response, bodyBuffer, authToken }) {
  return new Promise((resolve, reject) => {
    const extraHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const headers = buildHeaders(request.headers, extraHeaders);

    if (bodyBuffer.length > 0) {
      headers["content-length"] = String(bodyBuffer.length);
    } else {
      delete headers["content-length"];
    }

    const proxyRequest = client.request(
      targetUrl,
      {
        method: request.method,
        headers,
      },
      (proxyResponse) => {
        resolve(proxyResponse);
      }
    );

    proxyRequest.on("error", reject);

    if (bodyBuffer.length > 0) {
      proxyRequest.write(bodyBuffer);
    }

    proxyRequest.end();
  });
}

export async function proxyHttp(request, response, targetBaseUrl, authToken, forwardedPath = request.url) {
  const targetUrl = new URL(forwardedPath, targetBaseUrl);
  const client = pickClient(targetUrl);
  const authTokens = Array.isArray(authToken) ? authToken : [authToken];
  const bodyBuffer = await readRequestBody(request);

  let proxyResponse;
  let lastError;

  for (const token of [...authTokens, ""]) {
    try {
      proxyResponse = await sendAttempt({
        targetUrl,
        client,
        request,
        response,
        bodyBuffer,
        authToken: token || "",
      });

      if (!shouldRetryWithNextToken(proxyResponse, token, authTokens)) {
        break;
      }
    } catch (error) {
      lastError = error;
      proxyResponse = null;
      break;
    }
  }

  if (lastError || !proxyResponse) {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ detail: `Proxy error: ${lastError?.message || "Unknown proxy error"}` }));
    return;
  }

  const headers = { ...proxyResponse.headers };
  delete headers["access-control-allow-origin"];
  delete headers["access-control-allow-credentials"];
  if (headers.location) {
    try {
      const redirectedUrl = new URL(headers.location, targetBaseUrl);
      const backendOrigin = new URL(targetBaseUrl).origin;
      if (redirectedUrl.origin === backendOrigin) {
        headers.location = `${redirectedUrl.pathname}${redirectedUrl.search}`;
      }
    } catch (_) {
      // noop
    }
  }

  response.writeHead(proxyResponse.statusCode || 502, headers);
  proxyResponse.pipe(response);
}
