const twilio = require("twilio");
const config = require("../config");
const logger = require("../utils/logger");

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * TwiML for an inbound call: opens a bidirectional Media Stream to our
 * websocket endpoint so audio flows through Deepgram (in) and ElevenLabs
 * (out) instead of using Twilio's built-in <Say>/<Gather>.
 */
function inboundStreamTwiml({ callId }) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const connect = response.connect();
  connect.stream({
    url: `${config.publicBaseUrl.replace(/^http/, "ws")}/media-stream?callId=${callId}`,
  });
  return response.toString();
}

/**
 * Places an outbound call (e.g. order-ready confirmation, or a
 * restaurant-initiated callback) and points it at the same media-stream
 * pipeline used for inbound calls.
 */
async function placeOutboundCall({ toNumber, callId }) {
  const call = await client.calls.create({
    to: toNumber,
    from: config.twilio.phoneNumber,
    url: `${config.publicBaseUrl}/voice/outbound-connect?callId=${callId}`,
  });
  logger.info("Outbound call placed", { sid: call.sid, toNumber }, callId);
  return call;
}

module.exports = { client, inboundStreamTwiml, placeOutboundCall };
