import type { ReactNode } from "react";
import {
	Links,
	Meta,
	Scripts,
	ScrollRestoration,
	useActionData,
} from "react-router";
import { collectEmailSubscribers } from "./nazare/capabilities/collect-email-subscribers";
import { Hero } from "./nazare/carcass/sections/Hero";
import type { ResendConnectorEnv } from "./nazare/connectors/resend.server";

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
	const firstName = String(formData.get("firstName") ?? "").trim();

	try {
		return await collectEmailSubscribers.execute(email, context.env, firstName);
	} catch (error) {
		console.error(error);
		return { ok: false as const, error: "Could not subscribe right now." };
	}
}

export default function App() {
	const result = useActionData<typeof action>();

	return (
		<Hero
			eyebrow="Nazare"
			heading="Commerce, operable."
			body="A minimal Carcass section with a business capability attached through a connector."
			emailCapture={{ buttonLabel: "Join the list" }}
			message={
				result?.ok ? "Subscribed." : result?.error ? result.error : undefined
			}
		/>
	);
}
