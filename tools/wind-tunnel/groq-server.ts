// Compatibility entrypoint for the OAuth gateway.
// The custom Groq/tool-call harness has been retired; Pi is the only agent runtime.
await import('./server-v2.ts');
