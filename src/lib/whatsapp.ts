// WhatsApp click-to-chat only (no API automation). Normalises Nigerian numbers.
export function normalizeNgPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('234')) { /* already international */ }
  else if (d.startsWith('0')) d = '234' + d.slice(1);
  else if (d.length === 10) d = '234' + d;
  return /^234\d{10}$/.test(d) ? d : null;
}

export function isValidNgPhone(input: string | null | undefined): boolean {
  return normalizeNgPhone(input) !== null;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const n = normalizeNgPhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export interface MsgCtx {
  customer: string; business: string; event: string; total: number; paid: number; balance: number;
  dueDate?: string | null; quoteNumber?: string; portalUrl?: string; eventDate?: string;
}
const n = (v: number) => '₦' + v.toLocaleString('en-NG');

export const templates = {
  confirmation: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nThank you for choosing ${c.business}.\n\nYour booking for ${c.event} has been confirmed.\n\nTotal: ${n(c.total)}\nPaid: ${n(c.paid)}\nBalance: ${n(c.balance)}\n\nWe look forward to making your day special.`,
  quote: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nHere is your quotation${c.quoteNumber ? ' (' + c.quoteNumber + ')' : ''} from ${c.business} for ${c.event}.\n\nTotal: ${n(c.total)}\n${c.portalUrl ? '\nView it here: ' + c.portalUrl + '\n' : ''}\nPlease let us know if you would like any changes.`,
  reminder: (c: MsgCtx) =>
    `Hello ${c.customer},\n\nA gentle reminder from ${c.business} about ${c.event}.\n\nTotal: ${n(c.total)}\nPaid: ${n(c.paid)}\nBalance: ${n(c.balance)}${c.dueDate ? '\nDue: ' + c.dueDate : ''}\n\nThank you ❤️`,
  update: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nAn update on ${c.event} from ${c.business}.${c.portalUrl ? '\n\nYou can follow everything here: ' + c.portalUrl : ''}`,
  ready: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nGood news from ${c.business}: everything for ${c.event} is ready.`,
  portal: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nYour private event page for ${c.event} is ready. See your event journey, details and payment summary here:\n${c.portalUrl ?? ''}\n\n— ${c.business}`,
  thanks: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nThank you for trusting ${c.business} with ${c.event}. It was a pleasure serving you.`,
  feedback: (c: MsgCtx) =>
    `Hello ${c.customer},\n\nWe hope ${c.event} was wonderful. We would love your feedback on our service. Just reply to this message.\n\n— ${c.business}`,
  review: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nIf you enjoyed our service for ${c.event}, a short review would mean a lot to ${c.business}. Thank you!`,
  photos: (c: MsgCtx) =>
    `Hello ${c.customer} ❤️\n\nMay ${c.business} share a few photos from ${c.event}? Please reply with yes or no.`,
  followUp: (c: MsgCtx) =>
    `Hello ${c.customer},\n\nJust checking in from ${c.business}. Do you have another occasion coming up? We would love to help.`,
};
