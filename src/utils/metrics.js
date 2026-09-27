// In-memory metrics tracker for the demo. In production this would emit to a
// real metrics backend (Datadog/Prometheus/etc.) keyed by restaurant + call.

const state = {
  callsStarted: 0,
  callsCompleted: 0,
  ordersConfirmed: 0,
  ordersAbandoned: 0,
  transcriptionCorrections: 0,
  languageSwitches: 0,
  byLanguage: { en: 0, es: 0 },
  ticketLatenciesMs: [],
};

function recordCallStart() {
  state.callsStarted += 1;
}

function recordCallEnd({ completed }) {
  state.callsCompleted += completed ? 1 : 0;
}

function recordOrderOutcome(outcome) {
  if (outcome === "confirmed") state.ordersConfirmed += 1;
  if (outcome === "abandoned") state.ordersAbandoned += 1;
}

function recordLanguage(lang) {
  if (state.byLanguage[lang] === undefined) state.byLanguage[lang] = 0;
  state.byLanguage[lang] += 1;
}

function recordLanguageSwitch() {
  state.languageSwitches += 1;
}

function recordTicketLatency(ms) {
  state.ticketLatenciesMs.push(ms);
}

function snapshot() {
  const completionRate = state.callsStarted
    ? state.callsCompleted / state.callsStarted
    : 0;
  const orderAccuracy =
    state.ordersConfirmed + state.ordersAbandoned
      ? state.ordersConfirmed / (state.ordersConfirmed + state.ordersAbandoned)
      : 0;
  const avgTicketLatencyMs = state.ticketLatenciesMs.length
    ? state.ticketLatenciesMs.reduce((a, b) => a + b, 0) / state.ticketLatenciesMs.length
    : 0;

  return {
    ...state,
    completionRate: Number(completionRate.toFixed(3)),
    orderAccuracy: Number(orderAccuracy.toFixed(3)),
    avgTicketLatencyMs: Math.round(avgTicketLatencyMs),
  };
}

module.exports = {
  recordCallStart,
  recordCallEnd,
  recordOrderOutcome,
  recordLanguage,
  recordLanguageSwitch,
  recordTicketLatency,
  snapshot,
};
