require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  port: Number(required('PORT', 3000)),
  publicBaseUrl: required('PUBLIC_BASE_URL', 'http://localhost:3000'),

  claude: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: required('CLAUDE_MODEL', 'claude-sonnet-5'),
  },

  twilio: {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    phoneNumber: required('TWILIO_PHONE_NUMBER'),
  },

  deepgram: {
    apiKey: required('DEEPGRAM_API_KEY'),
  },

  elevenLabs: {
    apiKey: required('ELEVENLABS_API_KEY'),
    voiceIds: {
      en: required('ELEVENLABS_VOICE_ID_EN', '21m00Tcm4TlvDq8ikWAM'),
      es: required('ELEVENLABS_VOICE_ID_ES', 'EXAVITQu4vr4xnSDxMaL'),
    },
  },

  pos: {
    webhookUrl: required('POS_WEBHOOK_URL', 'http://localhost:4000/webhooks/tickets'),
    pollUrl: required('POS_POLL_URL', 'http://localhost:4000/pos/tickets/pending'),
    webhookSecret: required('POS_WEBHOOK_SECRET', 'change-me'),
    syncMode: required('POS_SYNC_MODE', 'webhook'), // 'webhook' | 'polling'
  },

  mockPos: {
    port: Number(required('MOCK_POS_PORT', 4000)),
  },
};
