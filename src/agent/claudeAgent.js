const Anthropic = require("@anthropic-ai/sdk");
const config = require("../config");
const { renderMenuAsText, MENU } = require("../data/menu");
const { applyOrderAction, orderTotal } = require("./orderParser");
const logger = require("../utils/logger");

const client = new Anthropic({ apiKey: config.claude.apiKey });

const ORDER_TOOLS = [
  {
    name: "add_item",
    description: "Add one menu item to the caller's order.",
    input_schema: {
      type: "object",
      properties: {
        itemName: { type: "string", description: "Menu item name, e.g. 'Carne Asada Burrito'" },
        quantity: { type: "integer", minimum: 1, default: 1 },
        modifiers: { type: "array", items: { type: "string" }, description: "e.g. ['no onion', 'add guac']" },
      },
      required: ["itemName"],
    },
  },
  {
    name: "remove_item",
    description: "Remove a previously added item from the order.",
    input_schema: {
      type: "object",
      properties: { itemName: { type: "string" } },
      required: ["itemName"],
    },
  },
  {
    name: "add_note",
    description: "Attach a free-text kitchen note to the order (e.g. allergy, pickup time).",
    input_schema: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
    },
  },
  {
    name: "clear_order",
    description: "Discard all items and start the order over, at the caller's request.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "confirm_order",
    description:
      "Move the call into order confirmation: read back the full order and total, and wait for explicit caller yes/no.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "end_call",
    description: "End the call after the order is confirmed (or the caller hangs up / cancels).",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", enum: ["confirmed", "caller_cancelled", "no_further_help"] } },
      required: ["reason"],
    },
  },
];

function systemPrompt(languageState, dialogueState) {
  const lang = languageState.current === "es" ? "Spanish" : "English";
  return `You are Orderly, a phone ordering agent for ${MENU.restaurantName}, a restaurant located at ${MENU.address} (hours: ${MENU.hours}).

You are currently speaking ${lang}. If the caller switches language mid-call, mirror them naturally — the platform detects the switch and will tell you when it happens.

Menu:
${renderMenuAsText()}

Conversation stage: ${dialogueState.current}.

Rules:
- Only offer items that are on the menu above. If asked about something not on the menu, say it's unavailable and suggest the closest alternative.
- Keep responses short and conversational — this is a live phone call, not a chat window.
- Use the provided tools to record every item add/remove, not just prose. The kitchen ticket is generated only from tool calls, never from your spoken text.
- Before ending the call, you must call confirm_order and get explicit confirmation, then call end_call.
- If the caller asks for something ambiguous, ask one short clarifying question rather than guessing.`;
}

/**
 * Runs one turn of the conversation: given the running transcript, produces
 * the agent's spoken reply plus any order-mutating tool calls, applies those
 * tool calls to the order, and returns everything the call loop needs.
 */
async function runTurn({ messages, order, languageState, dialogueState }) {
  const response = await client.messages.create({
    model: config.claude.model,
    max_tokens: 512,
    system: systemPrompt(languageState, dialogueState),
    tools: ORDER_TOOLS,
    messages,
  });

  let nextOrder = order;
  const toolResults = [];
  let requestedConfirm = false;
  let requestedEnd = null;
  const spokenText = [];

  for (const block of response.content) {
    if (block.type === "text") {
      spokenText.push(block.text);
    } else if (block.type === "tool_use") {
      if (block.name === "confirm_order") {
        requestedConfirm = true;
        toolResults.push({ tool_use_id: block.id, content: summarizeOrder(nextOrder) });
        continue;
      }
      if (block.name === "end_call") {
        requestedEnd = block.input?.reason ?? "confirmed";
        toolResults.push({ tool_use_id: block.id, content: "call_ended" });
        continue;
      }

      const { order: updated, error } = applyOrderAction(nextOrder, {
        type: block.name,
        ...block.input,
      });
      nextOrder = updated;
      if (error) logger.warn("order action error", { action: block.name, error });
      toolResults.push({ tool_use_id: block.id, content: error ?? "ok" });
    }
  }

  return {
    reply: spokenText.join(" ").trim(),
    order: nextOrder,
    toolResults,
    requestedConfirm,
    requestedEnd,
    rawResponse: response,
  };
}

function summarizeOrder(order) {
  if (order.items.length === 0) return "The order is currently empty.";
  const lines = order.items.map(
    (i) => `${i.quantity}x ${i.name}${i.modifiers.length ? ` (${i.modifiers.join(", ")})` : ""} — $${(i.price * i.quantity).toFixed(2)}`
  );
  return `${lines.join("\n")}\nTotal: $${orderTotal(order).toFixed(2)}`;
}

module.exports = { runTurn, summarizeOrder, ORDER_TOOLS, systemPrompt };
