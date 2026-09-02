import { z } from 'zod';

export interface PasswordRequirements {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecialChar: boolean;
  isAllSatisfied: boolean;
}

export function getNewPasswordRequirements(password: string): PasswordRequirements {
  const p = password || '';
  const hasMinLength = p.length >= 10;
  const hasUppercase = /[A-Z]/.test(p);
  const hasLowercase = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  // Special character: any non-letter, non-number, and non-whitespace character in Unicode (symbols, punctuation, emoji)
  const hasSpecialChar = /[^\p{L}\p{N}\s]/u.test(p);

  const isAllSatisfied =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasDigit &&
    hasSpecialChar;

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasDigit,
    hasSpecialChar,
    isAllSatisfied,
  };
}

export function validateNewPassword(password: string): boolean {
  return getNewPasswordRequirements(password).isAllSatisfied;
}

export const emailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Enter a valid email address');

// New-password policy for creation / setting:
// Min 10 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character.
// Does NOT disallow any character class (symbols, spaces, punctuation, unicode are allowed).
export const passwordCreationSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(validateNewPassword, {
    message: 'Please complete all password requirements.',
  });

// Password policy for sign-in: presence validation only.
// Sign In MUST NOT enforce signup complexity rules so existing legacy accounts remain able to log in.
export const passwordSignInSchema = z
  .string()
  .min(1, 'Password is required');

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSignInSchema,
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordCreationSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
