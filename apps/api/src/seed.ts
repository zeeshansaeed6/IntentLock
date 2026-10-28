import { loadCompanySeed } from './seed/loader.js';
import { env } from './config/env.js';
import { getGateway } from './integrations/airwallex/gateway.js';
import { store } from './store/memory.js';

async function main() {
  const seed = loadCompanySeed();
  store.reset();

  console.log(`[Seed] Loaded company configuration: ${seed.companyName}`);
  console.log(`[Seed] Balance: $${seed.currentBalanceMinor / 100} | Floor: $${seed.reserveFloorMinor / 100}`);
  console.log(`[Seed] Dept Budget: $${seed.departmentBudgetRemainingMinor / 100} | Approval Threshold: $${seed.approvalThresholdMinor / 100}`);

  const gateway = getGateway();
  if (gateway.mode === 'live') {
    console.log('[Seed] Live mode active: ensuring funded sandbox account in Airwallex...');
    try {
      const fundRes = await gateway.ensureFundedAccount();
      console.log(`[Seed] Sandbox Global Account ready: ${fundRes.globalAccountId}`);
    } catch (err) {
      console.warn(`[Seed] Sandbox funding warning: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log('[Seed] Scripted mode: in-memory mock treasury loaded.');
  }

  console.log('[Seed] Ready for agent transactions.');
}

main().catch((err) => {
  console.error('[Seed Error]', err);
  process.exitCode = 1;
});
