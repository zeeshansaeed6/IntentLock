import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { formatMoney } from '../lib/formatters';
import type { CompanyConfig } from '../lib/api';

export interface RunwayChartProps {
  company?: CompanyConfig | null;
}

export const RunwayChart: React.FC<RunwayChartProps> = ({ company }) => {
  // Plots the deterministic treasury engine's projection; the browser does no cash math of its own.
  const reserveFloor = company?.reserveFloorMinor ?? 0;
  const projection = company?.projection;
  const breachWeek = projection?.annual.breachWeek ?? null;
  const breachValue = breachWeek && projection ? projection.annual.balancesMinor[breachWeek - 1] : null;

  const data = (projection?.monthly.balancesMinor ?? []).map((monthly, i) => ({
    week: `W${i + 1}`,
    weekNum: i + 1,
    Monthly: Math.round(monthly / 100),
    Annual: Math.round((projection?.annual.balancesMinor[i] ?? 0) / 100),
    ReserveFloor: Math.round(reserveFloor / 100),
  }));
  const dollars = (minor?: number) => (minor === undefined ? '' : `$${Math.round(minor / 100).toLocaleString()}`);
  const monthlyLabel = company?.vendorTerms ? `Monthly (${dollars(company.vendorTerms.monthlyPriceMinor)}/mo)` : 'Monthly';
  const annualLabel = company?.vendorTerms ? `Annual (${dollars(company.vendorTerms.annualPriceMinor)} upfront)` : 'Annual';

  const reserveFloorDollars = Math.round(reserveFloor / 100);

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span className="panel-kicker">TREASURY CASH RUNWAY</span>
          <h2 style={{ margin: '4px 0 0', fontSize: 16 }}>12-Week Cash Projection</h2>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, background: 'var(--chart-4, #00DA92)', display: 'inline-block', borderRadius: 1 }} />
            <span style={{ color: '#94a3b8' }}>{monthlyLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, background: 'var(--chart-2, #7466F6)', borderTop: '1px dashed var(--chart-2, #7466F6)', display: 'inline-block' }} />
            <span style={{ color: '#94a3b8' }}>{annualLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 1, background: 'var(--chart-3, #FF7A00)', display: 'inline-block' }} />
            <span style={{ color: 'var(--chart-3, #FF7A00)' }}>Reserve Floor</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="week" stroke="#64748b" fontSize={9} tickLine={false} />
            <YAxis
              stroke="#64748b"
              fontSize={9}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(21, 21, 23, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
              formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
            />
            <ReferenceLine
              y={reserveFloorDollars}
              stroke="var(--chart-3, #FF7A00)"
              strokeDasharray="4 4"
              label={{
                value: `Floor: $${(reserveFloorDollars / 1000).toFixed(0)}k`,
                fill: 'var(--chart-3, #FF7A00)',
                fontSize: 9,
                position: 'insideTopRight',
              }}
            />
            {breachWeek && breachValue && (
              React.createElement(ReferenceDot as any, {
                x: `W${breachWeek}`,
                y: Math.round(breachValue / 100),
                r: 5,
                fill: 'var(--chart-5, #E10B05)',
                stroke: '#fff',
                strokeWidth: 2,
              })
            )}
            <Line
              type="monotone"
              dataKey="Monthly"
              stroke="var(--chart-4, #00DA92)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="Annual"
              stroke="var(--chart-2, #7466F6)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(52,211,153,0.06)',
          border: '1px solid rgba(52,211,153,0.18)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
        }}
      >
        <div style={{ color: '#6ee7b7' }}>
          <strong>Treasury Intelligence:</strong> {projection ? projection.reasons[0] : 'Waiting for the treasury projection…'}
        </div>
        <div style={{ color: '#22d3ee', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
          RECOMMENDATION: {(projection?.recommendation ?? '—').toUpperCase()}
        </div>
      </div>
    </div>
  );
};
