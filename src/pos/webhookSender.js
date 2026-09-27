const fetch = require("node-fetch");
const crypto = require("crypto");
const config = require("../config");
const logger = require("../utils/logger");

function signPayload(rawBody) {
  return crypto.createHmac("sha256", config.pos.webhookSecret).update(rawBody).digest("hex");
}

/**
 * Pushes a ticket to the restaurant's POS/KDS webhook endpoint. This is the
 * "raising kitchen order-entry speed" path — the ticket lands on the KDS
 * within one HTTP round trip of order confirmation, instead of waiting on a
 * poll cycle.
 */
async function sendTicketWebhook(ticket) {
  const rawBody = JSON.stringify(ticket);
  const signature = signPayload(rawBody);

  const response = await fetch(config.pos.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Orderly-Signature": signature,
    },
    body: rawBody,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`POS webhook failed (${response.status}): ${body}`);
  }

  logger.info("Ticket delivered via webhook", { ticketId: ticket.ticketId }, ticket.callId);
  return response.json().catch(() => ({}));
}

module.exports = { sendTicketWebhook, signPayload };
