// Stand-in for a restaurant's POS/KDS system, for local development and
// demos. Accepts webhook ticket pushes and exposes a polling endpoint, so
// posSyncService.js can be exercised end-to-end without a real POS vendor.
// Run with: npm run mock-pos

const express = require("express");
const config = require("../config");
const { signPayload } = require("./webhookSender");
const logger = require("../utils/logger");

const app = express();
app.use(express.json());

const receivedTickets = [];

app.post("/webhooks/tickets", (req, res) => {
  const signature = req.headers["x-orderly-signature"];
  const expected = signPayload(JSON.stringify(req.body));

  if (signature !== expected) {
    logger.warn("Rejected ticket webhook: bad signature", { ticketId: req.body?.ticketId });
    return res.status(401).json({ error: "invalid signature" });
  }

  receivedTickets.push({ ...req.body, receivedAt: new Date().toISOString(), status: "fired_to_kds" });
  logger.info("KDS received ticket", {
    ticketId: req.body.ticketId,
    items: req.body.lineItems?.length,
    total: req.body.total,
  });
  res.json({ status: "ok", ticketId: req.body.ticketId });
});

app.get("/pos/tickets/pending", (req, res) => {
  const { ticketId } = req.query;
  if (ticketId) {
    const ticket = receivedTickets.find((t) => t.ticketId === ticketId);
    return res.json(ticket ?? { status: "not_found" });
  }
  res.json(receivedTickets);
});

app.get("/health", (req, res) => res.json({ ok: true, ticketsReceived: receivedTickets.length }));

if (require.main === module) {
  app.listen(config.mockPos.port, () => {
    logger.info(`Mock POS/KDS listening on :${config.mockPos.port}`);
  });
}

module.exports = app;
