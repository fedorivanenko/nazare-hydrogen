// Compatibility entrypoint retained for the existing OAuth gateway.
// Wind Tunnel v1 separates the short-lived MCP control plane from the Railway worker service.
await import('./control.ts');
