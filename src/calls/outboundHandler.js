const { placeOutboundCall, inboundStreamTwiml } = require("../telephony/twilioClient");
const logger = require("../utils/logger");

/**
 * REST endpoint the restaurant's back office (or an internal ops tool) hits
 * to trigger an outbound call — e.g. "order ready for pickup" or a callback
 * after a dropped call.
 * POST /voice/outbound/initiate { toNumber, callId? }
 */
async function initiateOutboundCall(req, res) {
  const { toNumber, callId } = req.body;
  if (!toNumber) return res.status(400).json({ error: "toNumber is required" });

  const resolvedCallId = callId || `outbound-${Date.now()}`;
  try {
    const call = await placeOutboundCall({ toNumber, callId: resolvedCallId });
    res.json({ status: "dialing", sid: call.sid, callId: resolvedCallId });
  } catch (err) {
    logger.error("Failed to place outbound call", { err: String(err) }, resolvedCallId);
    res.status(502).json({ error: "failed to place call" });
  }
}

/** Twilio webhook once the outbound call is answered: connect to the same media-stream pipeline. */
function outboundConnectWebhook(req, res) {
  const callId = req.query.callId;
  res.type("text/xml");
  res.send(inboundStreamTwiml({ callId }));
}

module.exports = { initiateOutboundCall, outboundConnectWebhook };
