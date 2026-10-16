/**
 * Email eligibility for the storefront's two signup flows.
 * Both currently use the same normalization and email validation contract.
 */
function acceptedEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function newsletterEmail(value: string): string | null {
  return acceptedEmail(value);
}

export function earlyAccessEmail(value: string): string | null {
  return acceptedEmail(value);
}
