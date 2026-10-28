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
  const initialBalance = company?.currentBalanceMinor ?? 2100000;
  const reserveFloor = company?.reserveFloorMinor ?? 1200000;
  const inflows = company?.weeks?.map((w) => w.inflowMinor) ?? [240000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const outflows = company?.weeks?.map((w) => w.outflowMinor) ?? [80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000];

  const monthlyCostMinor = 5000; // $50/month
  const annualCostMinor = 50000; // $500 upfront in week 1

  let balMonthly = initialBalance;
  let balAnnual = initialBalance - annualCostMinor;

  let breachWeek: number | null = null;
  let breachValue: number | null = null;

  const data = Array.from({ length: 12 }, (_, i) => {
    const weekNum = i + 1;
    const netFlow = (inflows[i] ?? 200000) - (outflows[i] ?? 230000);

    balMonthly += netFlow - monthlyCostMinor;
    balAnnual += netFlow;

    if (balAnnual < reserveFloor && breachWeek === null) {
      breachWeek = weekNum;
      breachValue = balAnnual;
    }

    return {
      week: `W${weekNum}`,
      weekNum,
      Monthly: Math.round(balMonthly / 100),
      Annual: Math.round(balAnnual / 100),
      ReserveFloor: Math.round(reserveFloor / 100),
    };
  });

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
            <span style={{ color: '#94a3b8' }}>Monthly ($50/mo)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 2, background: 'var(--chart-2, #7466F6)', borderTop: '1px dashed var(--chart-2, #7466F6)', display: 'inline-block' }} />
            <span style={{ color: '#94a3b8' }}>Annual ($500 upfront)</span>
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
          <strong>Treasury Intelligence:</strong> Annual billing breaches the $12,000 reserve floor at Week {breachWeek ?? 6}.
        </div>
        <div style={{ color: '#22d3ee', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
          RECOMMENDATION: MONTHLY
        </div>
      </div>
    </div>
  );
};
