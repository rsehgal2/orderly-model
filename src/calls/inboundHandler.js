const crypto = require("crypto");
const { inboundStreamTwiml } = require("../telephony/twilioClient");
const logger = require("../utils/logger");

/** Twilio webhook: POST /voice/inbound, hit on every incoming call. */
function inboundVoiceWebhook(req, res) {
  const callId = req.body.CallSid || crypto.randomUUID();
  logger.info("Inbound call received", { from: req.body.From }, callId);

  res.type("text/xml");
  res.send(inboundStreamTwiml({ callId }));
}

module.exports = { inboundVoiceWebhook };
