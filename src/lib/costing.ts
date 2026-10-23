// Catering & small-chops costing maths (pure).
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CateringInput {
  guests: number;
  ingredients: { name: string; quantity: number; unit_cost: number }[];
  labour: number; gas: number; packaging: number; transport: number; other: number;
  selling_price: number;
}
export function cateringResult(i: CateringInput) {
  const ingredientCost = i.ingredients.reduce((s, x) => s + (x.quantity || 0) * (x.unit_cost || 0), 0);
  const total = r2(ingredientCost + i.labour + i.gas + i.packaging + i.transport + i.other);
  const guests = Math.max(i.guests, 0);
  const profit = r2(i.selling_price - total);
  return {
    ingredientCost: r2(ingredientCost), totalCost: total,
    costPerGuest: guests ? r2(total / guests) : 0,
    sellingPrice: r2(i.selling_price), profit,
    profitPerGuest: guests ? r2(profit / guests) : 0,
    margin: i.selling_price > 0 ? Math.round((profit / i.selling_price) * 1000) / 10 : 0,
  };
}

export interface ChopsItem { name: string; per_guest: number; unit_cost: number; override_qty?: number | null }
export interface ChopsInput {
  guests: number; items: ChopsItem[]; packaging: number; labour: number; transport: number; other: number;
  markup_percent: number; wastage_percent?: number;
}
/** Production quantity per item = guests × per-guest quantity, plus optional wastage buffer (rounded up). A manual override_qty wins. */
export function chopsResult(i: ChopsInput) {
  const waste = 1 + (i.wastage_percent ?? 0) / 100;
  const lines = i.items.map((it) => {
    const qty = it.override_qty != null && it.override_qty >= 0 ? Math.round(it.override_qty) : Math.ceil(i.guests * it.per_guest * waste);
    return { name: it.name, quantity: qty, cost: r2(qty * it.unit_cost) };
  });
  const itemsCost = lines.reduce((s, l) => s + l.cost, 0);
  const total = r2(itemsCost + i.packaging + i.labour + i.transport + i.other);
  const selling = r2(total * (1 + i.markup_percent / 100));
  const profit = r2(selling - total);
  return {
    lines, totalCost: total, costPerGuest: i.guests ? r2(total / i.guests) : 0,
    suggestedPrice: selling, profit, profitPerGuest: i.guests ? r2(profit / i.guests) : 0,
    margin: selling > 0 ? Math.round((profit / selling) * 1000) / 10 : 0,
  };
}
