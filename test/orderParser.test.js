const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createOrder, orderTotal, applyOrderAction } = require("../src/agent/orderParser");

test("add_item validates against the real menu and rejects unknown items", () => {
  const order = createOrder();
  const { order: next, error } = applyOrderAction(order, {
    type: "add_item",
    itemName: "Flying Spaghetti Monster",
  });
  assert.equal(error, '"Flying Spaghetti Monster" is not on the menu');
  assert.equal(next.items.length, 0);
});

test("add_item adds a known menu item with quantity and modifiers", () => {
  const order = createOrder();
  const { order: next, error } = applyOrderAction(order, {
    type: "add_item",
    itemName: "Carnitas Taco",
    quantity: 2,
    modifiers: ["no onion"],
  });
  assert.equal(error, null);
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].quantity, 2);
  assert.deepEqual(next.items[0].modifiers, ["no onion"]);
});

test("remove_item removes a matching item by name", () => {
  let order = createOrder();
  order = applyOrderAction(order, { type: "add_item", itemName: "Horchata" }).order;
  const { order: next, error } = applyOrderAction(order, { type: "remove_item", itemName: "Horchata" });
  assert.equal(error, null);
  assert.equal(next.items.length, 0);
});

test("remove_item errors when the item isn't in the order", () => {
  const order = createOrder();
  const { error } = applyOrderAction(order, { type: "remove_item", itemName: "Horchata" });
  assert.match(error, /not currently in the order/);
});

test("orderTotal sums price * quantity across items", () => {
  let order = createOrder();
  order = applyOrderAction(order, { type: "add_item", itemName: "Carnitas Taco", quantity: 2 }).order; // 3.75 * 2
  order = applyOrderAction(order, { type: "add_item", itemName: "Horchata" }).order; // 3.00
  assert.equal(orderTotal(order), 10.5);
});

test("clear_order resets to an empty order", () => {
  let order = createOrder();
  order = applyOrderAction(order, { type: "add_item", itemName: "Horchata" }).order;
  const { order: cleared } = applyOrderAction(order, { type: "clear_order" });
  assert.deepEqual(cleared.items, []);
});
