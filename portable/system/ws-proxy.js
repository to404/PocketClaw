const net = require("net");
const http = require("http");

function createProxyServer(req, clientSocket, head, gatewayHost, gatewayPort) {
  const options = {
    hostname: gatewayHost,
    port: gatewayPort,
    path: req.url,
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

  proxyReq.on("error", () => {
    clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    clientSocket.destroy();
  });

  proxyReq.end();
}

module.exports = { createProxyServer };
