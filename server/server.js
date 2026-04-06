import http from "node:http";
import path from "node:path";
import { env } from "./config/env.js";
import { proxyHttp } from "./proxy/httpProxy.js";
import { proxyWebSocket } from "./proxy/wsProxy.js";
import { sendJson, serveFile, sendText } from "./utils/http.js";

const ROOT_DIR = path.resolve(process.cwd());

function resolveStaticPath(requestUrl) {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  if (pathname === "/") {
    return path.join(ROOT_DIR, "index.html");
  }

  const cleanPath = pathname.replace(/^\/+/, "");
  return path.join(ROOT_DIR, cleanPath);
}

function handleConfig(response) {
  sendJson(response, 200, {
    refreshIntervalMs: env.refreshIntervalMs,
    backendLabel: env.backendBaseUrl,
    websocketEnabled: true,
  });
}

function requestHandler(request, response) {
  if (!request.url) {
    sendText(response, 400, "Bad request");
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/config") {
    handleConfig(response);
    return;
  }

  if (request.url === "/backend-root") {
    proxyHttp(request, response, `${env.backendBaseUrl}/`, env.restWriteToken);
    return;
  }

  if (request.url.startsWith("/api/")) {
    proxyHttp(request, response, env.backendBaseUrl, env.restWriteToken);
    return;
  }

  if (request.url === "/favicon.ico") {
    serveFile(response, path.join(ROOT_DIR, "assets", "favicon.svg"));
    return;
  }

  serveFile(response, resolveStaticPath(request.url));
}

const server = http.createServer(requestHandler);

server.on("upgrade", (request, socket, head) => {
  if (!request.url || !request.url.startsWith("/ws/")) {
    socket.destroy();
    return;
  }

  proxyWebSocket(request, socket, head, env.backendBaseUrl, env.wsToken);
});

server.listen(env.frontendPort, env.frontendHost, () => {
  console.log(`DronePharm frontend disponivel em http://${env.frontendHost}:${env.frontendPort}`);
});
