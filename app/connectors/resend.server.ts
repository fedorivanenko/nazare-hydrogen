export type ResendConnectorEnv = {
	RESEND_API_KEY?: string;
	RESEND_EARLY_ACCESS_SEGMENT_ID?: string;
};

export async function createResendContact(
	email: string,
	env: ResendConnectorEnv,
) {
	if (!env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	const response = await fetch("https://api.resend.com/contacts", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: email.trim(),
			unsubscribed: false,
		}),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(
			`Resend contact creation failed: ${response.status} ${details}`,
		);
	}

	return response.json() as Promise<{ id: string }>;
}

export async function addResendContactToEarlyAccess(
  contactId: string,
  env: ResendConnectorEnv,
) {
  if (!env.RESEND_API_KEY || !env.RESEND_EARLY_ACCESS_SEGMENT_ID) {
    throw new Error("Early-access Resend segment is not configured");
  }
  const response = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(env.RESEND_EARLY_ACCESS_SEGMENT_ID)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Resend segment assignment failed: ${response.status}`);
  }
}
