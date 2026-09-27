const fetch = require("node-fetch");
const config = require("../config");
const logger = require("../utils/logger");

const ELEVENLABS_TTS_URL = (voiceId) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`;

/**
 * Synthesizes speech for `text` in the given language, requesting mu-law
 * 8kHz output directly from ElevenLabs so it can be streamed back into a
 * Twilio Media Stream with no re-encoding step. Voice is language-routed:
 * a Spanish-speaking caller hears a Spanish ElevenLabs voice, not an
 * English voice reading translated text.
 *
 * @param {string} text
 * @param {"en"|"es"} language
 * @returns {Promise<Buffer>} raw mu-law audio bytes
 */
async function synthesizeSpeech(text, language = "en", callId) {
  const voiceId = config.elevenLabs.voiceIds[language] ?? config.elevenLabs.voiceIds.en;

  const response = await fetch(ELEVENLABS_TTS_URL(voiceId), {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenLabs.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/basic",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("ElevenLabs TTS request failed", { status: response.status, body }, callId);
    throw new Error(`ElevenLabs TTS failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

module.exports = { synthesizeSpeech };
