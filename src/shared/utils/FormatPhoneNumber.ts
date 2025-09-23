export function formatPhoneUS(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10); // keep 0-9 only, max 10
  const len = digits.length;

  if (len <= 3) return digits;
  if (len <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// validate the dashed form
export function isPhoneUSDashed(value: string): boolean {
  return /^\d{3}-\d{3}-\d{4}$/.test(value);
}

// get just digits if you ever need it
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}
