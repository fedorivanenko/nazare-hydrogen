import { Form } from "react-router";

export { heroDefinition as heroContract } from "../../registry/definitions";

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
