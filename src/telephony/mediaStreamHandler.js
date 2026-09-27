const { openLiveTranscription } = require("../asr/deepgramClient");
const { synthesizeSpeech } = require("../tts/elevenLabsClient");
const { CallSession } = require("../calls/callSession");
const logger = require("../utils/logger");

const CHUNK_SIZE_BYTES = 320; // 20ms of 8kHz mu-law, Twilio's expected frame size

/**
 * Wires one Twilio Media Stream WebSocket connection to Deepgram (ASR),
 * the CallSession/Claude dialogue pipeline, and ElevenLabs (TTS). This is
 * the only place raw Twilio audio-stream framing is handled — everything
 * downstream deals in plain text turns.
 */
function handleMediaStream(ws, { callId }) {
  let streamSid = null;
  let session = null;
  let closed = false;
  let utteranceBuffer = "";

  const asr = openLiveTranscription({
    callId,
    onTranscript: async ({ transcript, isFinal, language, confidence }) => {
      if (!transcript.trim()) return;

      if (session) session.observeTranscript({ language, confidence });

      if (!isFinal) {
        utteranceBuffer = transcript;
        return;
      }

      utteranceBuffer = "";
      try {
        const result = await session.handleUtterance(transcript);
        await speak(result.reply, result.language);
        if (result.ended) {
          ws.close();
        }
      } catch (err) {
        logger.error("Turn handling failed", { err: String(err) }, callId);
      }
    },
    onError: (err) => logger.error("ASR error", { err: String(err) }, callId),
  });

  async function speak(text, language) {
    if (!text) return;
    try {
      const audio = await synthesizeSpeech(text, language, callId);
      streamAudioToTwilio(audio);
    } catch (err) {
      logger.error("TTS/playback failed", { err: String(err) }, callId);
    }
  }

  function streamAudioToTwilio(audioBuffer) {
    if (!streamSid || closed) return;
    for (let offset = 0; offset < audioBuffer.length; offset += CHUNK_SIZE_BYTES) {
      const chunk = audioBuffer.subarray(offset, offset + CHUNK_SIZE_BYTES);
      ws.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: chunk.toString("base64") },
        })
      );
    }
  }

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.event) {
      case "start":
        streamSid = msg.start.streamSid;
        session = new CallSession({ callId, direction: "inbound" });
        logger.info("Media stream started", { streamSid }, callId);
        speak("Thanks for calling El Camino Taqueria, what can I get started for you?", "en");
        break;

      case "media":
        asr.sendAudio(Buffer.from(msg.media.payload, "base64"));
        break;

      case "stop":
        logger.info("Media stream stopped", null, callId);
        closed = true;
        asr.close();
        break;

      default:
        break;
    }
  });

  ws.on("close", () => {
    closed = true;
    asr.close();
  });
}

module.exports = { handleMediaStream };
