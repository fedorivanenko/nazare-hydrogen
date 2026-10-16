import {
  createResendContact,
  type ResendConnectorEnv,
} from "../connectors/resend.server";

const EARLY_ACCESS_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEarlyAccessEmail(email: string) {
  return EARLY_ACCESS_EMAIL_PATTERN.test(email);
}

export async function collectEarlyAccessApplicant(
  email: string,
  env: ResendConnectorEnv,
) {
  if (!validateEarlyAccessEmail(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  await createResendContact(email, env);
  return { ok: true as const };
}
