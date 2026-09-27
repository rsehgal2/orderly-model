const { createOrder } = require("../agent/orderParser");
const { createDialogueState, transition, STATES } = require("../agent/dialogueState");
const { createLanguageState, updateLanguage } = require("../agent/language");
const { runTurn } = require("../agent/claudeAgent");
const { syncOrderToPos } = require("../pos/posSyncService");
const metrics = require("../utils/metrics");
const logger = require("../utils/logger");

/**
 * Owns all per-call state and drives it forward one caller utterance at a
 * time. This is the seam between telephony/ASR/TTS (I/O) and the LLM +
 * order/POS logic (decisioning) — the media-stream handler and the demo CLI
 * both talk to a CallSession the same way, so the dialogue pipeline is
 * exercised identically whether audio is real or simulated.
 */
class CallSession {
  constructor({ callId, direction = "inbound", initialLanguage = "en" }) {
    this.callId = callId;
    this.direction = direction;
    this.order = createOrder();
    this.dialogueState = createDialogueState();
    this.languageState = createLanguageState(initialLanguage);
    this.messages = [];
    this.ended = false;
    metrics.recordCallStart();
  }

  /** Feed a caller ASR result in; may trigger a language switch. */
  observeTranscript({ language, confidence }) {
    const result = updateLanguage(this.languageState, { language, confidence });
    this.languageState = result.state;
    if (result.switched) {
      metrics.recordLanguageSwitch();
      logger.info("Language switched", { to: result.language }, this.callId);
    }
    return result;
  }

  async handleUtterance(callerText) {
    if (this.ended) return { reply: "", ended: true };

    this.messages.push({ role: "user", content: callerText });

    if (this.dialogueState.current === STATES.GREETING) {
      this.dialogueState = transition(this.dialogueState, STATES.ORDERING);
    }

    const turn = await runTurn({
      messages: this.messages,
      order: this.order,
      languageState: this.languageState,
      dialogueState: this.dialogueState,
    });

    this.order = turn.order;
    this.messages.push({ role: "assistant", content: turn.reply || "(order updated)" });

    if (turn.requestedConfirm && this.dialogueState.current === STATES.ORDERING) {
      this.dialogueState = transition(this.dialogueState, STATES.CONFIRMING);
    }

    if (turn.requestedEnd) {
      await this._finalize(turn.requestedEnd);
    }

    return { reply: turn.reply, ended: this.ended, order: this.order, language: this.languageState.current };
  }

  async _finalize(reason) {
    if (this.dialogueState.current === STATES.CONFIRMING) {
      this.dialogueState = transition(this.dialogueState, STATES.CLOSING);
    }
    this.dialogueState = transition(this.dialogueState, STATES.ENDED);
    this.ended = true;

    const confirmed = reason === "confirmed" && this.order.items.length > 0;
    metrics.recordOrderOutcome(confirmed ? "confirmed" : "abandoned");
    metrics.recordCallEnd({ completed: confirmed });
    metrics.recordLanguage(this.languageState.current);

    if (confirmed) {
      const start = Date.now();
      try {
        await syncOrderToPos({ callId: this.callId, order: this.order });
        metrics.recordTicketLatency(Date.now() - start);
      } catch (err) {
        logger.error("POS sync failed", { err: String(err) }, this.callId);
      }
    }
  }
}

module.exports = { CallSession };
