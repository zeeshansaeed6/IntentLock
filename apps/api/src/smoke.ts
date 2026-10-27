import { airwallex } from './integrations/airwallex/client.js';

function idFrom(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id === 'string') return candidate.id;
  if (typeof candidate.cardholder_id === 'string') return candidate.cardholder_id;
  if (typeof candidate.card_id === 'string') return candidate.card_id;
  if (candidate.data) return idFrom(candidate.data);
  return undefined;
}

const main = async () => {
  if (!airwallex.configured) {
    throw new Error('Set AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY in .env before running the sandbox smoke test.');
  }
  await airwallex.login();
  const accounts = await airwallex.listGlobalAccounts();
  const accountList = Array.isArray(accounts) ? accounts : ((accounts as { global_accounts?: unknown[]; data?: unknown[] })?.global_accounts ?? (accounts as { data?: unknown[] })?.data ?? []);
  let accountId = accountList.map(idFrom).find(Boolean);
  if (!accountId) accountId = idFrom(await airwallex.createGlobalAccount({ countryCode: 'US', currency: 'USD', transferMethod: 'LOCAL' }));
  if (!accountId) throw new Error('Sandbox did not return a Global Account ID');
  await airwallex.simulateDeposit({ globalAccountId: accountId, amountMajor: 25000, payerName: 'IntentLock smoke funding' });
  const cardholder = await airwallex.createCardholder(`intentlock-smoke-${Date.now()}@example.test`);
  const cardholderId = idFrom(cardholder);
  if (!cardholderId) throw new Error('Sandbox did not return a cardholder ID');
  const card = await airwallex.createVirtualCard({ cardholderId, maxPerTransactionMinor: 5000, maxTotalMinor: 5000, allowedMcc: ['5734'], allowedCurrencies: ['USD'], activeFrom: new Date().toISOString(), activeTo: new Date(Date.now() + 86400000).toISOString() });
  const cardId = idFrom(card);
  if (!cardId) throw new Error('Sandbox did not return a card ID');
  const transaction = await airwallex.simulateIssuing({ cardId, amountMinor: 100, currency: 'USD', mcc: '5734', merchant: 'IntentLock smoke', singlePhase: true });
  console.log(JSON.stringify({ login: 'ok', globalAccount: 'ok', funding: 'ok', card: 'ok', authorization: 'ok', maskedCard: (transaction as { masked_card_number?: string }).masked_card_number ?? 'redacted' }));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Sandbox smoke test failed');
  process.exitCode = 1;
});
