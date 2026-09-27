const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const config = require("../config");
const logger = require("../utils/logger");

/**
 * Opens a Deepgram live-transcription websocket tuned for inbound telephony
 * audio (8kHz mu-law, as sent by Twilio Media Streams). Uses Deepgram's
 * multi-language detection so a single stream serves both English and
 * Spanish callers without pre-selecting a locale.
 *
 * @param {object} opts
 * @param {(result: { transcript: string, isFinal: boolean, language: string, confidence: number }) => void} opts.onTranscript
 * @param {(err: Error) => void} opts.onError
 */
function openLiveTranscription({ onTranscript, onError, callId }) {
  const deepgram = createClient(config.deepgram.apiKey);

  const connection = deepgram.listen.live({
    model: "nova-2-general",
    language: "multi", // multi-language detection (e.g. en/es code-switching)
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    smart_format: true,
    interim_results: true,
    endpointing: 300,
    punctuate: true,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    logger.info("Deepgram stream opened", null, callId);
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt || !alt.transcript) return;

    onTranscript({
      transcript: alt.transcript,
      isFinal: Boolean(data.is_final),
      language: data.channel?.detected_language ?? "en",
      confidence: alt.confidence ?? 0,
    });
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    logger.error("Deepgram stream error", { err: String(err) }, callId);
    onError?.(err);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    logger.info("Deepgram stream closed", null, callId);
  });

  return {
    sendAudio: (chunk) => connection.send(chunk),
    close: () => connection.requestClose(),
  };
}

module.exports = { openLiveTranscription };
