// Simple, explicit state machine for a call. The LLM decides *what* to say
// and *what* the caller wants, but *when a call is allowed to end* or *move
// to confirmation* is enforced here — keeping those transitions
// deterministic instead of trusting free-form model output.

const STATES = Object.freeze({
  GREETING: "greeting",
  ORDERING: "ordering",
  CONFIRMING: "confirming",
  CLOSING: "closing",
  ENDED: "ended",
});

const TRANSITIONS = {
  [STATES.GREETING]: [STATES.ORDERING],
  [STATES.ORDERING]: [STATES.ORDERING, STATES.CONFIRMING],
  [STATES.CONFIRMING]: [STATES.ORDERING, STATES.CLOSING],
  [STATES.CLOSING]: [STATES.ENDED],
  [STATES.ENDED]: [],
};

function createDialogueState() {
  return { current: STATES.GREETING, history: [STATES.GREETING] };
}

function canTransition(state, next) {
  return TRANSITIONS[state.current]?.includes(next) ?? false;
}

function transition(state, next) {
  if (!canTransition(state, next)) {
    throw new Error(`Invalid transition: ${state.current} -> ${next}`);
  }
  return { current: next, history: [...state.history, next] };
}

module.exports = { STATES, createDialogueState, canTransition, transition };
