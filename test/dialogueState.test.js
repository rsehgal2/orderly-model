const { test } = require("node:test");
const assert = require("node:assert/strict");
const { STATES, createDialogueState, canTransition, transition } = require("../src/agent/dialogueState");

test("starts in greeting", () => {
  const state = createDialogueState();
  assert.equal(state.current, STATES.GREETING);
});

test("allows the happy-path flow through to ended", () => {
  let state = createDialogueState();
  state = transition(state, STATES.ORDERING);
  state = transition(state, STATES.CONFIRMING);
  state = transition(state, STATES.CLOSING);
  state = transition(state, STATES.ENDED);
  assert.equal(state.current, STATES.ENDED);
});

test("allows looping back from confirming to ordering (caller changes order)", () => {
  let state = createDialogueState();
  state = transition(state, STATES.ORDERING);
  state = transition(state, STATES.CONFIRMING);
  state = transition(state, STATES.ORDERING);
  assert.equal(state.current, STATES.ORDERING);
});

test("rejects skipping straight from greeting to confirming", () => {
  const state = createDialogueState();
  assert.equal(canTransition(state, STATES.CONFIRMING), false);
  assert.throws(() => transition(state, STATES.CONFIRMING));
});

test("ended state has no further transitions", () => {
  let state = createDialogueState();
  state = transition(state, STATES.ORDERING);
  state = transition(state, STATES.CONFIRMING);
  state = transition(state, STATES.CLOSING);
  state = transition(state, STATES.ENDED);
  assert.equal(canTransition(state, STATES.ORDERING), false);
});
