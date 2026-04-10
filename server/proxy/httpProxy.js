import http from "node:http";
import https from "node:https";

function pickClient(targetUrl) {
  return targetUrl.protocol === "https:" ? https : http;
}

function buildHeaders(requestHeaders, extraHeaders) {
  const headers = { ...requestHeaders, ...extraHeaders };
  delete headers.host;
  delete headers.origin;
  return headers;
}

export function proxyHttp(request, response, targetBaseUrl, authToken, forwardedPath = request.url) {
  const targetUrl = new URL(forwardedPath, targetBaseUrl);
  const client = pickClient(targetUrl);

  const proxyRequest = client.request(
    targetUrl,
    {
      method: request.method,
      headers: buildHeaders(request.headers, authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    (proxyResponse) => {
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
  );

  proxyRequest.on("error", (error) => {
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ detail: `Proxy error: ${error.message}` }));
  });

  request.pipe(proxyRequest);
}
