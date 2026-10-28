export function maskSecrets(input: string): string {
  if (typeof input !== 'string') return input;
  let output = input;

  // Mask Bearer tokens
  output = output.replace(/Bearer\s+([^\s]+)/gi, 'Bearer ***REDACTED***');

  // Mask JSON sensitive key values
  output = output.replace(
    /"(api[_-]?key|client[_-]?secret|password|secret|token|cvv|pan)"\s*:\s*"[^"]+"/gi,
    '"$1":"***REDACTED***"'
  );

  // Mask query/env assignments
  output = output.replace(
    /(AIRWALLEX_API_KEY|AIRWALLEX_CLIENT_ID|AIRWALLEX_WEBHOOK_SECRET|LLM_API_KEY|INTENT_HMAC_SECRET|MONGODB_URI)=([^\s&]+)/gi,
    '$1=***REDACTED***'
  );

  // Mask PAN card numbers (13 to 19 consecutive digits)
  output = output.replace(/\b\d{13,19}\b/g, '***REDACTED***');

  return output;
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'test' && !process.env.DEBUG) return;
    const sanitized = maskSecrets(typeof message === 'string' ? message : JSON.stringify(message));
    console.log(`[INFO] ${sanitized}`, ...args.map((a) => maskSecrets(typeof a === 'string' ? a : JSON.stringify(a))));
  },
  warn: (message: string, ...args: any[]) => {
    const sanitized = maskSecrets(typeof message === 'string' ? message : JSON.stringify(message));
    console.warn(`[WARN] ${sanitized}`, ...args.map((a) => maskSecrets(typeof a === 'string' ? a : JSON.stringify(a))));
  },
  error: (message: string, ...args: any[]) => {
    const sanitized = maskSecrets(typeof message === 'string' ? message : JSON.stringify(message));
    console.error(`[ERROR] ${sanitized}`, ...args.map((a) => maskSecrets(typeof a === 'string' ? a : JSON.stringify(a))));
  },
};
