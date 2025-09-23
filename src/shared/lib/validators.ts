import { api } from './api';

export function validateEmailFormat(email: string): boolean {
  const v = email.trim();
  if (!v) return false;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return ok;
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const { data } = await api.get<{
    ok: boolean;
    available: boolean;
    error?: string;
  }>('/users/validate-email', { params: { email } });
  console.log('data', data);
  if (!data.ok) return false;
  return data.available;
}

export async function validateEmailField(
  email: string,
): Promise<{ valid: boolean; error: string | null }> {
  const fmt = validateEmailFormat(email);
  if (!fmt) return { valid: false, error: 'Invalid email format' };
  const available = await checkEmailAvailable(email);
  return {
    valid: available,
    error: available ? null : 'Email already in use',
  };
}

export function validatePasswordFormat(password: string): {
  valid: boolean;
  error: string | null;
} {
  if (typeof password !== 'string') return { valid: false, error: null };

  const minLen = /.{8,}/;
  const hasUpper = /[A-Z]/;
  const hasNumber = /\d/;
  // special = any punctuation/symbol (not letters, numbers, or space)
  const hasSpecial = /[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]/;

  const validPassword =
    minLen.test(password) &&
    hasUpper.test(password) &&
    hasNumber.test(password) &&
    hasSpecial.test(password);

  return {
    valid: validPassword,
    error: validPassword
      ? null
      : '8+ chars, 1+ uppercase, 1+ number, 1+ special',
  };
}

export function validateVerifyPasswordField(
  password: string,
  verifyPassword: string,
): { valid: boolean; error: string | null } {
  return {
    valid: password === verifyPassword,
    error: password === verifyPassword ? null : 'Passwords do not match',
  };
}

export async function validateUsernameField(username: string): Promise<{
  valid: boolean;
  error: string | null;
}> {
  const { data } = await api.get<{
    ok: boolean;
    available: boolean;
    error?: string;
  }>('/users/validate-username', { params: { username } });
  if (!data.available)
    return { valid: false, error: 'Username already in use' };
  return { valid: data.available, error: null };
}
