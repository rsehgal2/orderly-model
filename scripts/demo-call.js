#!/usr/bin/env node
// Simulates a full inbound call as a scripted sequence of caller
// utterances, driven through the exact same CallSession -> Claude ->
// order-parser -> POS-sync pipeline the real Twilio media stream uses —
// just with canned text standing in for Deepgram ASR output and console
// logs standing in for ElevenLabs playback.
//
// Requires ANTHROPIC_API_KEY. POS delivery will fall back to the polling
// queue automatically if `npm run mock-pos` isn't running in another
// terminal.
//
// Usage:
//   npm run demo            # English ordering scenario
//   npm run demo:es         # Bilingual (English -> Spanish mid-call) scenario

const { CallSession } = require("../src/calls/callSession");
const metrics = require("../src/utils/metrics");

const SCENARIOS = {
  english: {
    initialLanguage: "en",
    turns: [
      { text: "Hi, can I get two carnitas tacos and a horchata?", language: "en", confidence: 0.95 },
      { text: "Actually make the horchata a large, and add chips and guac too.", language: "en", confidence: 0.95 },
      { text: "That's everything, go ahead and place it.", language: "en", confidence: 0.95 },
      { text: "Yes that's correct, thank you.", language: "en", confidence: 0.95 },
    ],
  },
  spanish: {
    initialLanguage: "en",
    turns: [
      { text: "Hi, I'd like to place an order.", language: "en", confidence: 0.95 },
      // Caller switches to Spanish; two consecutive Spanish detections trigger the language switch.
      { text: "Quiero dos burritos de pollo, por favor.", language: "es", confidence: 0.9 },
      { text: "Y también un refresco de jarritos, sin arroz en los burritos.", language: "es", confidence: 0.92 },
      { text: "Sí, eso es todo, confirma la orden.", language: "es", confidence: 0.9 },
      { text: "Sí, correcto.", language: "es", confidence: 0.92 },
    ],
  },
};

async function main() {
  const scenarioArg = process.argv.find((a) => a.startsWith("--scenario="));
  const scenarioName = scenarioArg ? scenarioArg.split("=")[1] : "english";
  const scenario = SCENARIOS[scenarioName];

  if (!scenario) {
    console.error(`Unknown scenario "${scenarioName}". Available: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY (see .env.example) before running the demo.");
    process.exit(1);
  }

  console.log(`\n=== Orderly demo call — scenario: ${scenarioName} ===\n`);

  const session = new CallSession({
    callId: `demo-${scenarioName}-${Date.now()}`,
    initialLanguage: scenario.initialLanguage,
  });

  console.log("Orderly: Thanks for calling El Camino Taqueria, what can I get started for you?\n");

  for (const turn of scenario.turns) {
    console.log(`Caller: ${turn.text}`);
    session.observeTranscript({ language: turn.language, confidence: turn.confidence });

    const result = await session.handleUtterance(turn.text);
    console.log(`Orderly [${result.language}]: ${result.reply}\n`);

    if (result.ended) {
      console.log("--- call ended ---\n");
      break;
    }
  }

  console.log("Final order:", JSON.stringify(session.order, null, 2));
  console.log("\nMetrics snapshot:", JSON.stringify(metrics.snapshot(), null, 2));
}

main().catch((err) => {
  console.error("Demo call failed:", err);
  process.exit(1);
});
