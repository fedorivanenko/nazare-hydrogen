import type { ReactNode } from "react";
import {
	Form,
	Links,
	Meta,
	Scripts,
	ScrollRestoration,
	useActionData,
} from "react-router";
import { collectEarlyAccessApplicant } from "./capabilities/collect-early-access-applicants";
import { collectEmailSubscribers } from "./capabilities/collect-email-subscribers";
import { Hero } from "./carcass/sections/Hero";
import type { ResendConnectorEnv } from "./connectors/resend.server";

export function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body style={{ margin: 0, fontFamily: "Arial, sans-serif" }}>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

type ActionContext = { env: ResendConnectorEnv };

export async function action({
	request,
	context,
}: {
	request: Request;
	context: ActionContext;
}) {
	const formData = await request.formData();
	const email = String(formData.get("email") ?? "").trim();
	const signupKind = String(formData.get("signupKind") ?? "newsletter");

	try {
		if (signupKind === "early-access") {
			return await collectEarlyAccessApplicant(email, context.env);
		}
		return await collectEmailSubscribers.execute(email, context.env);
	} catch (error) {
		console.error(error);
		return { ok: false as const, error: "Could not subscribe right now." };
	}
}

export default function App() {
	const result = useActionData<typeof action>();

	return (
		<>
		<Hero
			eyebrow="Nazare"
			heading="Commerce, operable."
			body="A minimal Carcass section with a business capability attached through a connector."
			emailCapture={{ buttonLabel: "Join the list" }}
			message={
				result?.ok ? "Subscribed." : result?.error ? result.error : undefined
			}
		/>
		<section style={{ maxWidth: 720, margin: "0 auto 8vh", padding: 24 }}>
			<h2>Request early access</h2>
			<Form method="post" style={{ display: "flex", gap: 8 }}>
				<input type="hidden" name="signupKind" value="early-access" />
				<input type="email" name="email" required aria-label="Early access email" placeholder="you@example.com" />
				<button type="submit">Join early access</button>
			</Form>
		</section>
		</>
	);
}
