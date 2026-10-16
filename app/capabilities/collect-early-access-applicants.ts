import {
  createResendContact,
  addResendContactToEarlyAccess,
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
    return { ok: false as const, signupKind: "early-access" as const, error: "Enter a valid email address." };
  }

  const contact = await createResendContact(email, env);
  await addResendContactToEarlyAccess(contact.id, env);
  return { ok: true as const, signupKind: "early-access" as const };
}
