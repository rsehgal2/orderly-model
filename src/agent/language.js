// Bilingual call handling: tracks the caller's detected language per call and
// decides when to switch dialogue context + TTS voice. Deepgram's Nova-2
// multi-language model tags each transcript with a detected language and
// confidence; we require a short run of consistent detections before
// switching, so a single misheard word doesn't flip the whole call.

const SUPPORTED_LANGUAGES = ["en", "es"];
const SWITCH_CONFIDENCE_THRESHOLD = 0.6;
const CONSECUTIVE_DETECTIONS_TO_SWITCH = 2;

function createLanguageState(initialLanguage = "en") {
  return {
    current: initialLanguage,
    pendingLanguage: null,
    pendingStreak: 0,
    history: [{ language: initialLanguage, source: "default" }],
  };
}

/**
 * @param {object} state - result of createLanguageState()
 * @param {{ language: string, confidence: number }} detection - per-utterance ASR language detection
 * @returns {{ state: object, switched: boolean, language: string }}
 */
function updateLanguage(state, detection) {
  if (!detection || !SUPPORTED_LANGUAGES.includes(detection.language)) {
    return { state, switched: false, language: state.current };
  }
  if (detection.confidence < SWITCH_CONFIDENCE_THRESHOLD) {
    return { state, switched: false, language: state.current };
  }
  if (detection.language === state.current) {
    return { state: { ...state, pendingLanguage: null, pendingStreak: 0 }, switched: false, language: state.current };
  }

  const streak = detection.language === state.pendingLanguage ? state.pendingStreak + 1 : 1;

  if (streak >= CONSECUTIVE_DETECTIONS_TO_SWITCH) {
    const nextState = {
      current: detection.language,
      pendingLanguage: null,
      pendingStreak: 0,
      history: [...state.history, { language: detection.language, source: "asr-detection" }],
    };
    return { state: nextState, switched: true, language: detection.language };
  }

  return {
    state: { ...state, pendingLanguage: detection.language, pendingStreak: streak },
    switched: false,
    language: state.current,
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  createLanguageState,
  updateLanguage,
};
