export type WeeklyCash = { inflowMinor: number; outflowMinor: number };
export type VendorTerms = { monthlyPriceMinor: number; annualPriceMinor: number; monthlyChargeWeeks?: number[] };
export type Projection = { option: 'monthly' | 'annual'; balancesMinor: number[]; breachWeek: number | null; minimumBalanceMinor: number };
export type TreasuryDecision = { monthly: Projection; annual: Projection; recommendation: 'monthly' | 'annual' | 'defer'; reasons: string[] };

function project(option: Projection['option'], currentBalanceMinor: number, weeks: WeeklyCash[], reserveFloorMinor: number, terms: VendorTerms): Projection {
  let balance = currentBalanceMinor;
  const balancesMinor: number[] = [];
  const monthlyWeeks = terms.monthlyChargeWeeks ?? [1, 5, 9];
  weeks.forEach((week, index) => {
    balance += week.inflowMinor - week.outflowMinor;
    if (option === 'annual' && index === 0) balance -= terms.annualPriceMinor;
    if (option === 'monthly' && monthlyWeeks.includes(index + 1)) balance -= terms.monthlyPriceMinor;
    balancesMinor.push(balance);
  });
  const breachIndex = balancesMinor.findIndex((value) => value < reserveFloorMinor);
  return { option, balancesMinor, breachWeek: breachIndex === -1 ? null : breachIndex + 1, minimumBalanceMinor: Math.min(...balancesMinor) };
}

export function decideTreasury(input: { currentBalanceMinor: number; weeks: WeeklyCash[]; reserveFloorMinor: number; terms: VendorTerms }): TreasuryDecision {
  if (input.weeks.length !== 12) throw new Error('Treasury projection requires exactly 12 weeks');
  const monthly = project('monthly', input.currentBalanceMinor, input.weeks, input.reserveFloorMinor, input.terms);
  const annual = project('annual', input.currentBalanceMinor, input.weeks, input.reserveFloorMinor, input.terms);
  const reasons: string[] = [];
  let recommendation: TreasuryDecision['recommendation'];
  if (annual.breachWeek === null) {
    recommendation = 'annual';
    reasons.push('Annual billing is cheaper and never crosses the reserve floor.');
  } else if (monthly.breachWeek === null) {
    recommendation = 'monthly';
    reasons.push(`Annual billing breaches the reserve floor in week ${annual.breachWeek}; monthly preserves cash and optionality.`);
  } else {
    recommendation = 'defer';
    reasons.push('Both payment options breach the reserve floor within the projection window.');
  }
  return { monthly, annual, recommendation, reasons };
}
