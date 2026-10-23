// Pure money logic. Balances are always calculated, never stored.
export interface LineItem { quantity: number; unit_price: number }
export interface Adjustments { discount?: number; additional_charges?: number; delivery_fee?: number; service_fee?: number }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function subtotal(items: LineItem[]): number {
  return r2(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0));
}

export function grandTotal(items: LineItem[], adj: Adjustments = {}): number {
  const t = subtotal(items) - (adj.discount ?? 0) + (adj.additional_charges ?? 0) + (adj.delivery_fee ?? 0) + (adj.service_fee ?? 0);
  return r2(Math.max(t, 0));
}

export type PaymentStatus = 'awaiting_payment' | 'partially_paid' | 'paid_in_full';

export function paymentSummary(total: number, payments: { amount: number }[]) {
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const balance = r2(total - paid);
  const status: PaymentStatus = paid <= 0 ? 'awaiting_payment' : paid >= total ? 'paid_in_full' : 'partially_paid';
  return { total: r2(total), paid, balance, status };
}

/** Returns an error message if the payment is invalid, otherwise null. */
export function validatePayment(amount: number, balance: number, allowOverpayment = false): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.';
  if (!allowOverpayment && amount > balance + 0.005) return 'This payment is more than the remaining balance.';
  return null;
}

export function profit(revenue: number, costs: number) {
  const p = r2(revenue - costs);
  const margin = revenue > 0 ? Math.round((p / revenue) * 1000) / 10 : 0; // one decimal, percent
  return { revenue: r2(revenue), costs: r2(costs), profit: p, margin };
}

export function formatNaira(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const neg = v < 0;
  const s = Math.abs(v).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${neg ? '-' : ''}₦${s}`;
}
