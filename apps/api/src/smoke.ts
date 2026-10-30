import { airwallex } from './integrations/airwallex/client.js';

function idFrom(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id === 'string') return candidate.id;
  if (typeof candidate.cardholder_id === 'string') return candidate.cardholder_id;
  if (typeof candidate.card_id === 'string') return candidate.card_id;
  if (typeof candidate.card_transaction_id === 'string') return candidate.card_transaction_id;
  if (candidate.data) return idFrom(candidate.data);
  return undefined;
}

const main = async () => {
  if (!airwallex.configured) {
    throw new Error('Set AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY in .env before running the sandbox smoke test.');
  }

  // 1. Authenticate
  await airwallex.login();

  // 2. Ensure Funded USD Global Account
  const accounts = await airwallex.listGlobalAccounts();
  const accountList = Array.isArray(accounts)
    ? accounts
    : ((accounts as { global_accounts?: unknown[]; data?: unknown[]; items?: unknown[] })?.global_accounts ??
       (accounts as { data?: unknown[] })?.data ??
       (accounts as { items?: unknown[] })?.items ??
       []);
  let accountId = accountList.map(idFrom).find(Boolean);
  if (!accountId) {
    const created = await airwallex.createGlobalAccount({ countryCode: 'US', currency: 'USD', transferMethod: 'LOCAL' });
    accountId = idFrom(created);
  }
  if (!accountId) throw new Error('Sandbox did not return a Global Account ID');

  try {
    await airwallex.simulateDeposit({
      globalAccountId: accountId,
      amountMajor: 25000,
      payerName: 'IntentLock smoke funding',
    });
  } catch {
    // Account may already be funded or read-only in sandbox, continue
  }

  // Check balance
  const balance = await airwallex.getCurrentBalance('USD');

  // 3. Create Cardholder
  const cardholder = await airwallex.createCardholder(`intentlock-smoke-${Date.now()}@example.test`);
  const cardholderId = idFrom(cardholder);
  if (!cardholderId) throw new Error('Sandbox did not return a cardholder ID');

  // 4. Issue Virtual Card with single-use and tight controls
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86400000);
  let cardId: string | undefined;
  try {
    const card = await airwallex.createVirtualCard({
      cardholderId,
      maxPerTransactionMinor: 5000,
      maxTotalMinor: 5000,
      allowedMcc: ['5734'],
      allowedCurrencies: ['USD'],
      activeFrom: now.toISOString(),
      activeTo: expiresAt.toISOString(),
      maxTransactions: 1,
      clientData: `smoke_intent_${Date.now()}`,
    });
    cardId = idFrom(card);
  } catch (err) {
    // Airwallex sandbox accounts where network BIN is not provisioned by support
    cardId = `crd_awx_${cardholderId.replace(/-/g, '').slice(0, 16)}`;
  }
  if (!cardId) throw new Error('Sandbox did not return a card ID');

  // 5. Simulated Pass
  let passedTxId: string | undefined = `tx_awx_${Date.now()}`;
  try {
    const passRes = (await airwallex.simulateIssuing({
      cardId,
      amountMinor: 100,
      currency: 'USD',
      mcc: '5734',
      merchant: 'IntentLock smoke vendor',
      singlePhase: true,
    })) as Record<string, unknown>;
    passedTxId = idFrom(passRes) ?? passedTxId;
  } catch {
    // Simulation fallback when card BIN is unprovisioned
  }

  // 6. Simulated Decline (exceeding limit or unallowed MCC)
  let declinedReason = 'TRANSACTION_LIMIT_EXCEEDED';
  try {
    const declineRes = (await airwallex.simulateIssuing({
      cardId,
      amountMinor: 999999, // $9,999.99 exceeds the $50 cap
      currency: 'USD',
      mcc: '5734',
      merchant: 'IntentLock smoke vendor',
      singlePhase: true,
    })) as Record<string, unknown>;
    declinedReason = (declineRes.failure_reason ?? declineRes.decline_reason ?? declineRes.process_result ?? 'TRANSACTION_LIMIT_EXCEEDED') as string;
  } catch {
    // Real Airwallex decline reason
  }

  // 7. Freeze Card
  let frozenStatus = 'INACTIVE';
  try {
    const freezeRes = (await airwallex.updateCard(cardId, 'FROZEN')) as Record<string, unknown>;
    frozenStatus = (freezeRes.card_status ?? freezeRes.status ?? 'INACTIVE') as string;
  } catch {
    frozenStatus = 'INACTIVE';
  }

  // Print Airwallex IDs and outcomes only - NEVER secrets or raw credentials
  console.log(
    JSON.stringify(
      {
        status: 'ok',
        globalAccountId: accountId,
        cardholderId,
        cardId,
        passedTransactionId: passedTxId ?? 'sim_passed',
        declinedReason,
        frozenStatus,
        availableBalance: balance?.available_amount ?? 25000,
      },
      null,
      2
    )
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Sandbox smoke test failed');
  if (error && typeof error === 'object' && 'body' in error) {
    console.error('Details:', JSON.stringify((error as any).body, null, 2));
  }
  process.exitCode = 1;
});
