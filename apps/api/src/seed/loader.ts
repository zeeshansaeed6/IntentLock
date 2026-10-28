import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export type CompanySeed = {
  companyName: string;
  currentBalanceMinor: number;
  reserveFloorMinor: number;
  departmentBudgetRemainingMinor: number;
  approvalThresholdMinor: number;
  weeks: Array<{ week: number; inflowMinor: number; outflowMinor: number }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadCompanySeed(): CompanySeed {
  try {
    const filePath = join(__dirname, 'company.json');
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content) as CompanySeed;
  } catch {
    // Robust fallback if file path differs in bundle
    return {
      companyName: 'Northstar Labs Inc.',
      currentBalanceMinor: 2100000,
      reserveFloorMinor: 1200000,
      departmentBudgetRemainingMinor: 250000,
      approvalThresholdMinor: 30000,
      weeks: Array.from({ length: 12 }, (_, i) => ({
        week: i + 1,
        inflowMinor: i === 0 ? 240000 : 0,
        outflowMinor: 80000,
      })),
    };
  }
}

export const getCompanyConfig = loadCompanySeed;

