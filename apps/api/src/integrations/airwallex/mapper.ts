export type NormalizedAuthorization = {
  accepted: boolean;
  reason?: string;
  sourceStatus: string;
};

/** REST uses process_result/type; MCP uses different status names. */
export function mapRestAuthorization(input: { process_result?: string; type?: string; failure_reason?: string }): NormalizedAuthorization {
  return {
    accepted: input.type === 'CLEARING' || input.process_result === 'APPROVED',
    reason: input.failure_reason,
    sourceStatus: input.type ?? input.process_result ?? 'UNKNOWN',
  };
}
