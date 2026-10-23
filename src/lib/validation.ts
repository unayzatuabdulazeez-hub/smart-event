import { isValidNgPhone } from './whatsapp';

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const optionalPhoneError = (s: string): string | null => (!s.trim() || isValidNgPhone(s) ? null : 'Enter a valid Nigerian phone number, e.g. 0803 123 4567.');
export const optionalEmailError = (s: string): string | null => (!s.trim() || isEmail(s) ? null : 'Enter a valid email address.');
export const money = (s: string): number => { const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
export const moneyError = (s: string, { allowZero = true } = {}): string | null => {
  if (s === '' ) return allowZero ? null : 'Enter an amount.';
  const n = money(s);
  if (Number.isNaN(n)) return 'Enter a valid amount.';
  if (n < 0) return 'Amount cannot be negative.';
  if (!allowZero && n === 0) return 'Amount must be more than zero.';
  return null;
};
