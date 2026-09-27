const { findItemByName } = require("../data/menu");

function createOrder() {
  return { items: [], notes: [], status: "open" };
}

function orderTotal(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Applies a single structured tool-call action (emitted by Claude, see
 * agent/claudeAgent.js tool definitions) to the running order. Kept separate
 * from the LLM call so it's independently unit-testable and so a malformed
 * or hallucinated item name can never silently reach the kitchen — it's
 * validated against the real menu here.
 */
function applyOrderAction(order, action) {
  switch (action.type) {
    case "add_item": {
      const menuItem = findItemByName(action.itemName);
      if (!menuItem) {
        return { order, error: `"${action.itemName}" is not on the menu` };
      }
      const quantity = Math.max(1, action.quantity ?? 1);
      const modifiers = action.modifiers ?? [];
      const nextOrder = {
        ...order,
        items: [
          ...order.items,
          {
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity,
            modifiers,
          },
        ],
      };
      return { order: nextOrder, error: null };
    }

    case "remove_item": {
      const idx = order.items.findIndex(
        (i) => i.name.toLowerCase() === action.itemName.toLowerCase()
      );
      if (idx === -1) {
        return { order, error: `"${action.itemName}" is not currently in the order` };
      }
      const nextItems = [...order.items];
      nextItems.splice(idx, 1);
      return { order: { ...order, items: nextItems }, error: null };
    }

    case "add_note": {
      return { order: { ...order, notes: [...order.notes, action.note] }, error: null };
    }

    case "clear_order": {
      return { order: createOrder(), error: null };
    }

    default:
      return { order, error: `Unknown order action: ${action.type}` };
  }
}

module.exports = { createOrder, orderTotal, applyOrderAction };
