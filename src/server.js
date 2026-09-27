const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

const config = require("./config");
const logger = require("./utils/logger");
const metrics = require("./utils/metrics");
const { inboundVoiceWebhook } = require("./calls/inboundHandler");
const { initiateOutboundCall, outboundConnectWebhook } = require("./calls/outboundHandler");
const { handleMediaStream } = require("./telephony/mediaStreamHandler");

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio webhooks post form-encoded
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/metrics", (req, res) => res.json(metrics.snapshot()));

app.post("/voice/inbound", inboundVoiceWebhook);
app.post("/voice/outbound/initiate", initiateOutboundCall);
app.post("/voice/outbound-connect", outboundConnectWebhook);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname, query } = url.parse(request.url, true);
  if (pathname !== "/media-stream") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    handleMediaStream(ws, { callId: query.callId });
  });
});

server.listen(config.port, () => {
  logger.info(`Orderly server listening on :${config.port}`);
});

module.exports = { app, server };
