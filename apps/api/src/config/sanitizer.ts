/**
 * Recursively strips NoSQL injection operator keys (keys starting with '$' or containing '.')
 * protecting MongoDB queries and object operations from parameter injection attacks.
 */
export function sanitizeNoSql<T = unknown>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(sanitizeNoSql) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue; // Discard operator injection like {"$gt": ""}
      }
      clean[key] = sanitizeNoSql(value);
    }
    return clean as T;
  }
  return input;
}
