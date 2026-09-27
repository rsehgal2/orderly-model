const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLanguageState, updateLanguage } = require("../src/agent/language");

test("stays on current language for a single off-language blip", () => {
  let state = createLanguageState("en");
  let result = updateLanguage(state, { language: "es", confidence: 0.9 });
  assert.equal(result.switched, false);
  assert.equal(result.language, "en");
});

test("switches after two consecutive consistent detections", () => {
  let state = createLanguageState("en");
  let result = updateLanguage(state, { language: "es", confidence: 0.9 });
  state = result.state;
  result = updateLanguage(state, { language: "es", confidence: 0.9 });
  assert.equal(result.switched, true);
  assert.equal(result.language, "es");
});

test("ignores low-confidence detections entirely", () => {
  let state = createLanguageState("en");
  const result = updateLanguage(state, { language: "es", confidence: 0.2 });
  assert.equal(result.switched, false);
  assert.equal(result.state.pendingLanguage, null);
});

test("resets the pending streak when the caller reverts to the current language", () => {
  let state = createLanguageState("en");
  let result = updateLanguage(state, { language: "es", confidence: 0.9 });
  state = result.state;
  assert.equal(state.pendingStreak, 1);

  result = updateLanguage(state, { language: "en", confidence: 0.9 });
  assert.equal(result.state.pendingStreak, 0);
  assert.equal(result.state.pendingLanguage, null);
});
