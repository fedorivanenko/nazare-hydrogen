import { defineCapability, defineCarcass, defineProvider } from "./schema";

export const collectEmailSubscribersDefinition = defineCapability({
	id: "capability.collect-email-subscribers",
	kind: "capability",
	intent: "Collect visitor email addresses for future marketing communication",
	keywords: ["email", "newsletter", "subscriber", "signup", "marketing"],
	surfaces: [{ type: "surface", id: "carcass.section.hero" }],
	providers: [
		{ type: "provider", id: "provider.resend", action: "contacts.create" },
	],
	policies: [
		{
			id: "valid-email",
			description: "Only accept syntactically valid email addresses",
		},
	],
	evidence: [
		{
			id: "contact-created",
			type: "runtime",
			description: "Resend confirms that the contact was created",
		},
	],
	bindings: [
		{
			id: "binding.route.root.hero-email-signup",
			kind: "route-action",
			sourceFile: "app/root.tsx",
			surface: "carcass.section.hero",
			handler: "export async function action",
			invocation: "collectEmailSubscribers.execute(email, context.env)",
			inputs: [
				{
					name: "email",
					evidence: 'formData.get("email")',
				},
			],
		},
	],
	sourceFiles: [
		"app/nazare/registry/definitions.ts",
		"app/nazare/capabilities/collect-email-subscribers.ts",
		"app/nazare/carcass/sections/Hero.tsx",
		"app/nazare/connectors/resend.server.ts",
		"app/root.tsx",
	],
	mutationFiles: [
		"app/nazare/registry/definitions.ts",
		"app/nazare/capabilities/collect-email-subscribers.ts",
		"app/nazare/carcass/sections/Hero.tsx",
		"app/nazare/connectors/resend.server.ts",
		"app/root.tsx",
	],
	mutationTargets: [
		{
			file: "app/nazare/registry/definitions.ts",
			symbols: ["collectEmailSubscribersDefinition"],
		},
		{
			file: "app/nazare/capabilities/collect-email-subscribers.ts",
			symbols: ["policyImplementations", "collectEmailSubscribers"],
		},
		{
			file: "app/nazare/carcass/sections/Hero.tsx",
			symbols: ["Hero"],
		},
		{
			file: "app/nazare/connectors/resend.server.ts",
			symbols: ["createResendContact"],
		},
		{
			file: "app/root.tsx",
			symbols: ["action", "App"],
		},
	],
});

export const heroDefinition = defineCarcass({
	id: "carcass.section.hero",
	kind: "carcass",
	carcassKind: "section",
	intent: "Introduce the primary message and action for a page",
	keywords: ["hero", "headline", "landing", "banner"],
	props: ["eyebrow", "heading", "body", "emailCapture"],
	constraints: ["heading-required"],
	sourceFiles: [
		"app/nazare/registry/definitions.ts",
		"app/nazare/carcass/sections/Hero.tsx",
	],
});

export const resendDefinition = defineProvider({
	id: "provider.resend",
	kind: "provider",
	intent: "Email delivery and audience management through Resend",
	keywords: ["resend", "email", "contacts", "audience"],
	actions: [
		{
			id: "contacts.create",
			intent: "Create a contact in Resend",
		},
	],
	sourceFiles: [
		"app/nazare/registry/definitions.ts",
		"app/nazare/connectors/resend.server.ts",
	],
});
