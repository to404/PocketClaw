const http = require("http");

function createProxyServer(req, clientSocket, head, gatewayHost, gatewayPort) {
  const token = process.env.POCKETCLAW_GATEWAY_TOKEN || "pocketclaw-local";
  let path = req.url || "/";
  if (token) {
    path += (path.includes("?") ? "&" : "?") + "token=" + token;
  }

  const options = {
    hostname: gatewayHost,
    port: gatewayPort,
    path: path,
    method: "GET",
    headers: {
      ...req.headers,
      host: `${gatewayHost}:${gatewayPort}`,
    },
  };

  const proxyReq = http.request(options);

  proxyReq.on("upgrade", (_proxyRes, proxySocket, proxyHead) => {
    clientSocket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${_proxyRes.headers["sec-websocket-accept"]}\r\n` +
        "\r\n",
    );

    if (proxyHead && proxyHead.length) {
      clientSocket.write(proxyHead);
    }

    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);

    proxySocket.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => proxySocket.destroy());
    proxySocket.on("close", () => clientSocket.destroy());
    clientSocket.on("close", () => proxySocket.destroy());
  });

  proxyReq.on("response", (res) => {
    // Gateway rejected the upgrade (e.g. 401 unauthorized)
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      clientSocket.write(
        `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n\r\n`,
      );
      clientSocket.destroy();
    });
  });

  proxyReq.on("error", () => {
    clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    clientSocket.destroy();
  });

  proxyReq.end();
}

module.exports = { createProxyServer };
