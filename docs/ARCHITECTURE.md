# Architecture

## Call flow (inbound)

```
Caller dials Twilio number
        │
        ▼
POST /voice/inbound  ──────────────► TwiML: <Connect><Stream url=".../media-stream"/>
        │
        ▼
Twilio opens a WebSocket to /media-stream, streams 8kHz mu-law audio frames
        │
        ▼
mediaStreamHandler.js
  ├─ forwards audio ──► Deepgram live transcription (asr/deepgramClient.js)
  │                          │
  │                          ▼
  │                   transcript + detected language + confidence
  │                          │
  ▼                          ▼
CallSession.observeTranscript()   (agent/language.js — debounced language switch)
CallSession.handleUtterance(text) (calls/callSession.js)
        │
        ▼
Claude dialogue turn (agent/claudeAgent.js)
  ├─ spoken reply (text)
  └─ tool calls: add_item / remove_item / add_note / clear_order / confirm_order / end_call
        │                          │
        ▼                          ▼
orderParser.applyOrderAction   dialogueState.transition (agent/dialogueState.js)
  (validates against src/data/menu.js)
        │
        ▼
reply text ──► ElevenLabs TTS (tts/elevenLabsClient.js, mu-law 8kHz output)
        │
        ▼
audio streamed back to Twilio over the same WebSocket
        │
        ▼
(on end_call with reason="confirmed")
        ▼
posSyncService.syncOrderToPos ──► webhook (pos/webhookSender.js)
                                     └─ on failure ──► polling queue (pos/pollingClient.js)
```

## Why the dialogue pipeline is decoupled from telephony

`CallSession` (src/calls/callSession.js) only deals in plain text turns in
and text-plus-order-state out. It has no knowledge of Twilio, WebSockets, or
audio encoding. That's what lets `scripts/demo-call.js` exercise the *exact*
same Claude → order-parser → POS-sync path as a real phone call, just by
feeding it scripted strings instead of Deepgram output — useful for
development, tests, and demoing the system without live telephony
infrastructure.

## Bilingual handling

Deepgram's multi-language model tags every transcript chunk with a detected
language and confidence. `agent/language.js` only commits to a language
switch after two consecutive same-language detections above a confidence
threshold, and only that committed value flows into:

1. The Claude system prompt (dialogue continues in the new language)
2. The ElevenLabs voice selection (`ELEVENLABS_VOICE_ID_EN` / `_ES`)

This debounce exists because raw per-utterance language detection is noisy
enough (proper nouns, short utterances, code-switched phrases) that acting on
a single detection would cause audible voice/language flapping mid-call.

## POS/KDS integration shape

Real-world restaurant POS systems vary in what they support: some expose a
webhook receiver, many older or on-prem systems only support the POS polling
*out* to a partner's queue. `posSyncService.js` models both:

- **webhook mode** (default): ticket is POSTed directly to the POS's
  endpoint, signed with an HMAC (`pos/webhookSender.js`) so the receiver can
  verify it came from Orderly.
- **polling mode / webhook failure fallback**: ticket is placed on an
  in-memory outbox (`pos/pollingClient.js`) that the POS's own poller drains
  via `GET /pos/tickets/pending`.

`src/pos/mockPos.js` implements both sides of that contract as a tiny
Express app, standing in for the restaurant's real POS/KDS in local
development.
