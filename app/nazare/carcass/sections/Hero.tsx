import { Form } from "react-router";
import { defineCarcass } from "../../registry/schema";

export const heroContract = defineCarcass({
	id: "carcass.section.hero",
	kind: "carcass",
	carcassKind: "section",
	intent: "Introduce the primary message and action for a page",
	keywords: ["hero", "headline", "landing", "banner"],
	props: ["eyebrow", "heading", "body", "emailCapture"],
	constraints: ["heading-required"],
	sourceFiles: ["app/nazare/carcass/sections/Hero.tsx"],
});

type HeroProps = {
	eyebrow?: string;
	heading: string;
	body?: string;
	emailCapture?: {
		placeholder?: string;
		buttonLabel?: string;
	};
	message?: string;
};

export function Hero({
	eyebrow,
	heading,
	body,
	emailCapture,
	message,
}: HeroProps) {
	return (
		<section style={{ maxWidth: 720, margin: "12vh auto", padding: 24 }}>
			{eyebrow ? <p>{eyebrow}</p> : null}
			<h1 style={{ fontSize: "clamp(3rem, 8vw, 6rem)", lineHeight: 0.95 }}>
				{heading}
			</h1>
			{body ? <p style={{ fontSize: 20, maxWidth: 560 }}>{body}</p> : null}

			{emailCapture ? (
				<Form method="post" style={{ display: "flex", gap: 8, marginTop: 32 }}>
					<input
						type="email"
						name="email"
						required
						placeholder={emailCapture.placeholder ?? "you@example.com"}
						aria-label="Email address"
						style={{ flex: 1, padding: 12 }}
					/>
					<button type="submit" style={{ padding: "12px 18px" }}>
						{emailCapture.buttonLabel ?? "Subscribe"}
					</button>
				</Form>
			) : null}

			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
