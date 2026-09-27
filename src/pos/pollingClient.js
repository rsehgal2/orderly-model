const fetch = require("node-fetch");
const config = require("../config");
const logger = require("../utils/logger");

// In-memory outbox used as the fallback path when a POS integration doesn't
// support inbound webhooks (common with older/on-prem POS systems). Tickets
// queue here and the POS's own polling agent drains `/pos/tickets/pending`
// (see pos/mockPos.js) on its own interval.
const pendingQueue = [];

function enqueueForPolling(ticket) {
  pendingQueue.push(ticket);
  logger.info("Ticket queued for POS polling pickup", { ticketId: ticket.ticketId }, ticket.callId);
}

function drainQueue() {
  const drained = pendingQueue.splice(0, pendingQueue.length);
  return drained;
}

function peekQueue() {
  return [...pendingQueue];
}

/**
 * Actively polls a POS's status endpoint for ticket acknowledgement — used
 * when Orderly needs to confirm a ticket was picked up by the kitchen (e.g.
 * to retry or alert staff if a ticket sits un-acked past a threshold).
 */
async function pollTicketStatus(ticketId) {
  const response = await fetch(`${config.pos.pollUrl}?ticketId=${encodeURIComponent(ticketId)}`);
  if (!response.ok) throw new Error(`POS poll failed (${response.status})`);
  return response.json();
}

module.exports = { enqueueForPolling, drainQueue, peekQueue, pollTicketStatus };
