// Sample restaurant menu used for Q&A grounding and order-item validation.
// In production this would be fetched from the restaurant's POS/menu API per location.

const MENU = {
  restaurantName: "El Camino Taqueria",
  currency: "USD",
  categories: [
    {
      name: "Tacos",
      items: [
        { id: "taco-carnitas", name: "Carnitas Taco", price: 3.75, modifiers: ["no onion", "no cilantro", "extra salsa"] },
        { id: "taco-al-pastor", name: "Al Pastor Taco", price: 3.75, modifiers: ["no onion", "no cilantro", "extra pineapple"] },
        { id: "taco-veggie", name: "Veggie Taco", price: 3.25, modifiers: ["no onion", "no cilantro", "add cheese"] },
      ],
    },
    {
      name: "Burritos",
      items: [
        { id: "burrito-carne-asada", name: "Carne Asada Burrito", price: 11.5, modifiers: ["no rice", "no beans", "no sour cream", "add guac (+$1.50)"] },
        { id: "burrito-chicken", name: "Chicken Burrito", price: 10.5, modifiers: ["no rice", "no beans", "no sour cream", "add guac (+$1.50)"] },
      ],
    },
    {
      name: "Sides",
      items: [
        { id: "side-chips-salsa", name: "Chips & Salsa", price: 4.0, modifiers: [] },
        { id: "side-chips-guac", name: "Chips & Guacamole", price: 6.5, modifiers: [] },
        { id: "side-rice-beans", name: "Rice & Beans", price: 3.5, modifiers: [] },
      ],
    },
    {
      name: "Drinks",
      items: [
        { id: "drink-horchata", name: "Horchata", price: 3.0, modifiers: ["small", "large"] },
        { id: "drink-jarritos", name: "Jarritos (assorted flavors)", price: 2.5, modifiers: [] },
        { id: "drink-fountain", name: "Fountain Soda", price: 2.25, modifiers: ["small", "large"] },
      ],
    },
  ],
  hours: "Mon–Sun 10:00 AM – 10:00 PM",
  address: "1200 Mission St, San Francisco, CA",
};

function flattenItems() {
  return MENU.categories.flatMap((cat) =>
    cat.items.map((item) => ({ ...item, category: cat.name }))
  );
}

function findItemByName(name) {
  const normalized = name.trim().toLowerCase();
  return flattenItems().find(
    (item) =>
      item.name.toLowerCase() === normalized ||
      item.name.toLowerCase().includes(normalized) ||
      normalized.includes(item.name.toLowerCase())
  );
}

function renderMenuAsText() {
  return MENU.categories
    .map((cat) => {
      const lines = cat.items
        .map((i) => `  - ${i.name}: $${i.price.toFixed(2)}${i.modifiers.length ? ` (options: ${i.modifiers.join(", ")})` : ""}`)
        .join("\n");
      return `${cat.name}:\n${lines}`;
    })
    .join("\n\n");
}

module.exports = { MENU, flattenItems, findItemByName, renderMenuAsText };
