# Orderly

Conversational voice ordering agent for restaurants. Handles inbound and outbound
phone calls end-to-end — greeting, menu Q&A, order building, confirmation, and
kitchen ticket delivery — with real-time bilingual (English/Spanish) support.

**Stack:** Twilio (telephony) · Deepgram (streaming ASR) · ElevenLabs (TTS) ·
Claude API (dialogue management + order parsing) · Node.js/Express

## What it does

- Answers inbound restaurant calls over Twilio Media Streams, transcribes the
  caller in real time with Deepgram, and responds with ElevenLabs speech —
  no hold music, no IVR menu tree.
- Uses Claude, via tool calling, to hold the conversation *and* build a
  structured order at the same time: every item add/remove/note is a
  validated tool call, not a guess parsed out of prose.
- Detects language mid-call (English/Spanish) from ASR output and switches
  the agent's dialogue context and TTS voice to match, so a caller can
  code-switch without restarting the call.
- Converts a confirmed order into a POS/KDS-ready ticket and pushes it via
  webhook, with an automatic fallback to a polling queue if the webhook is
  unreachable — so a transient POS outage delays a ticket instead of losing it.
- Can also place outbound calls (e.g. "your order is ready") through the same
  pipeline.

## Project layout

```
src/
  agent/         Claude dialogue loop, order parser, dialogue state machine, language detection
  asr/           Deepgram live-transcription client
  tts/           ElevenLabs speech synthesis client
  telephony/     Twilio TwiML + Media Stream WebSocket handling
  calls/         Per-call session state, inbound/outbound Twilio webhooks
  pos/           Order -> ticket translation, webhook sender, polling fallback, mock POS/KDS
  data/          Sample restaurant menu
  utils/         Logging, in-memory metrics
scripts/
  demo-call.js   Simulated end-to-end call (no phone/API keys required beyond Claude)
test/            Unit tests for order parsing, dialogue state, and language switching
```

## Running it

### 1. Try it without any telephony setup

The dialogue pipeline (Claude + order parsing + POS sync) is fully decoupled
from Twilio/Deepgram/ElevenLabs, so you can run a full simulated call with
just an Anthropic API key:

```bash
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY at minimum
npm run demo           # English ordering scenario
npm run demo:es        # Bilingual scenario: starts in English, caller switches to Spanish
```

To see the confirmed order actually land on a "kitchen", run the mock POS/KDS
server in another terminal first:

```bash
npm run mock-pos
```

### 2. Run the full voice pipeline

Requires accounts/keys for Twilio, Deepgram, ElevenLabs, and Anthropic (see
`.env.example`), plus a public URL for Twilio to reach your server (e.g. via
ngrok in development).

```bash
npm install
cp .env.example .env   # fill in all keys + PUBLIC_BASE_URL
npm start
```

Then point a Twilio phone number's "A call comes in" webhook at
`POST {PUBLIC_BASE_URL}/voice/inbound`.

To trigger an outbound call:

```bash
curl -X POST http://localhost:3000/voice/outbound/initiate \
  -H 'Content-Type: application/json' \
  -d '{"toNumber": "+15555550123"}'
```

### Tests

```bash
npm test
```

Covers order validation against the menu, dialogue state transitions, and the
language-switch debounce logic — the parts of the system that don't require
live API calls to verify.

## Design notes

- **Tool calls are the only source of truth for the order.** Claude's spoken
  text and the order it builds are deliberately decoupled — the kitchen
  ticket is generated only from `add_item`/`remove_item`/etc. tool calls, so
  a conversational aside can never leak into the ticket.
- **Dialogue-stage transitions (greeting → ordering → confirming → closing)
  are enforced in code, not left to the model** — see
  [`src/agent/dialogueState.js`](src/agent/dialogueState.js) — so the call
  can't be ended without an explicit confirmation step.
- **Language switching debounces on two consecutive detections** above a
  confidence threshold (see [`src/agent/language.js`](src/agent/language.js))
  so a single misheard word doesn't flip the whole call's language.
- **POS delivery prefers a webhook push, falling back to a polling queue**
  (see [`src/pos/posSyncService.js`](src/pos/posSyncService.js)) to match how
  restaurant POS/KDS integrations vary in practice — some accept inbound
  webhooks, older or on-prem systems often only support polling.

## License

MIT
