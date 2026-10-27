import { describe, expect, it } from 'vitest';
import { mapRestAuthorization } from './mapper.js';

describe('Airwallex status mapper', () => {
  it('treats CLEARING as accepted', () => {
    expect(mapRestAuthorization({ type: 'CLEARING' }).accepted).toBe(true);
  });

  it('preserves failure reasons as declines', () => {
    const result = mapRestAuthorization({ process_result: 'DECLINED', failure_reason: 'LIMIT_EXCEEDED' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('LIMIT_EXCEEDED');
  });
});
