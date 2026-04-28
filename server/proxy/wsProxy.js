import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

function buildPathWithToken(requestUrl, token) {
  const url = new URL(requestUrl, "http://local-proxy");
  if (token) {
    url.searchParams.set("token", token);
  }
  return `${url.pathname}${url.search}`;
}

function openSocket(targetUrl) {
  if (targetUrl.protocol === "wss:" || targetUrl.protocol === "https:") {
    return tls.connect(targetUrl.port || 443, targetUrl.hostname);
  }

  return net.connect(targetUrl.port || 80, targetUrl.hostname);
}

function onSocketReady(socket, callback) {
  let handled = false;
  const run = () => {
    if (handled) {
      return;
    }

    handled = true;
    callback();
  };

  socket.once("connect", run);
  socket.once("secureConnect", run);
}

export function proxyWebSocket(request, clientSocket, head, backendBaseUrl, wsToken) {
  const backendHttpUrl = new URL(backendBaseUrl);
  const targetProtocol = backendHttpUrl.protocol === "https:" ? "wss:" : "ws:";
  const targetUrl = new URL(`${targetProtocol}//${backendHttpUrl.host}${buildPathWithToken(request.url, wsToken)}`);
  const upstreamSocket = openSocket(targetUrl);

  onSocketReady(upstreamSocket, () => {
    const headers = [
      `GET ${targetUrl.pathname}${targetUrl.search} HTTP/1.1`,
      `Host: ${targetUrl.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${request.headers["sec-websocket-key"]}`,
      `Sec-WebSocket-Version: ${request.headers["sec-websocket-version"] || "13"}`,
    ];

    if (request.headers.origin) {
      headers.push(`Origin: ${request.headers.origin}`);
    }

    if (request.headers["sec-websocket-protocol"]) {
      headers.push(`Sec-WebSocket-Protocol: ${request.headers["sec-websocket-protocol"]}`);
    }

    upstreamSocket.write(`${headers.join("\r\n")}\r\n\r\n`);

    if (head && head.length) {
      upstreamSocket.write(head);
    }
  });

  upstreamSocket.on("error", () => {
    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    upstreamSocket.destroy();
  });

  upstreamSocket.pipe(clientSocket);
  clientSocket.pipe(upstreamSocket);
}
