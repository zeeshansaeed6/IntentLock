import { randomUUID } from 'node:crypto';

export type CardControls = {
  cardholderId: string;
  maxPerTransactionMinor: number;
  maxTotalMinor: number;
  allowedMcc: string[];
  allowedCurrencies: string[];
  activeFrom: string;
  activeTo: string;
  clientData?: string;
  maxTransactions?: number;
};

const toMajorUnits = (minor: number): number => {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Money must be a non-negative safe integer in minor units');
  return minor / 100;
};

/** The only card-create payload builder. Keep Airwallex field mapping here. */
export function buildVirtualCardPayload(input: CardControls) {
  return {
    request_id: randomUUID(),
    cardholder_id: input.cardholderId,
    created_by: 'IntentLock',
    form_factor: 'VIRTUAL',
    is_personalized: false,
    program: { purpose: 'COMMERCIAL', type: 'PREPAID' },
    authorization_controls: {
      allowed_transaction_count: input.maxTransactions === 1 ? 'SINGLE' : 'MULTIPLE',
      transaction_limits: {
        currency: 'USD',
        limits: [
          { interval: 'PER_TRANSACTION', amount: toMajorUnits(input.maxPerTransactionMinor) },
          { interval: 'ALL_TIME', amount: toMajorUnits(input.maxTotalMinor) },
        ],
      },
      allowed_currencies: input.allowedCurrencies,
      allowed_merchant_categories: input.allowedMcc,
      active_from: input.activeFrom,
      active_to: input.activeTo,
    },
    activate_on_issue: true,
    client_data: input.clientData,
    metadata: { product: 'intentlock', scope: 'intent-bound' },
  };
}

export function buildCardholderPayload(email: string) {
  return {
    email,
    type: 'DELEGATE',
    individual: {
      name: { first_name: 'IntentLock', last_name: 'Delegate' },
      date_of_birth: '1990-01-01',
      express_consent_obtained: 'yes',
      address: { line1: '1 Sandbox Way', city: 'San Francisco', state: 'CA', postcode: '94105', country: 'US' },
    },
  };
}

export function buildIssuingSimulationPayload(input: {
  cardId: string;
  amountMinor: number;
  currency: string;
  mcc: string;
  merchant: string;
  singlePhase?: boolean;
}) {
  return {
    card_id: input.cardId,
    transaction_amount: toMajorUnits(input.amountMinor),
    transaction_currency: input.currency,
    merchant_category_code: input.mcc,
    merchant_info: input.merchant,
    single_phase: input.singlePhase ?? false,
  };
}
