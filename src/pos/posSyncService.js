const crypto = require("crypto");
const config = require("../config");
const { orderTotal } = require("../agent/orderParser");
const { sendTicketWebhook } = require("./webhookSender");
const { enqueueForPolling } = require("./pollingClient");
const logger = require("../utils/logger");

/**
 * Translates a parsed conversational order into the ticket shape a
 * restaurant POS/KDS expects: flat line items, per-line modifiers, and a
 * total — no reference to how the order was collected (call transcript,
 * dialogue turns, etc).
 */
function toTicket({ callId, order }) {
  return {
    ticketId: crypto.randomUUID(),
    callId,
    source: "orderly-voice-agent",
    createdAt: new Date().toISOString(),
    lineItems: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      modifiers: item.modifiers,
      unitPrice: item.price,
      lineTotal: Number((item.price * item.quantity).toFixed(2)),
    })),
    notes: order.notes,
    total: Number(orderTotal(order).toFixed(2)),
  };
}

/**
 * Delivers a confirmed order to the restaurant's ticketing system. Prefers a
 * direct webhook push (lowest latency); if the configured sync mode is
 * "polling", or the webhook attempt fails, falls back to queuing the ticket
 * for the POS's own poller to pick up — so a transient webhook outage never
 * loses an order, only delays it.
 */
async function syncOrderToPos({ callId, order }) {
  const ticket = toTicket({ callId, order });

  if (config.pos.syncMode === "polling") {
    enqueueForPolling(ticket);
    return { ticket, delivery: "polling" };
  }

  try {
    await sendTicketWebhook(ticket);
    return { ticket, delivery: "webhook" };
  } catch (err) {
    logger.warn("Webhook delivery failed, falling back to polling queue", { err: String(err) }, callId);
    enqueueForPolling(ticket);
    return { ticket, delivery: "polling-fallback" };
  }
}

module.exports = { toTicket, syncOrderToPos };
