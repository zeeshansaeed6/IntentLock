import React from 'react';
import { motion } from 'framer-motion';
import { Play, SkipForward, CheckCircle, Scale } from 'lucide-react';
import { useStore } from '../state/useStore';
import { triggerScenario } from '../lib/api';

const SCENARIO_STEPS = [
  { name: 'pass', title: 'Step 1/7: Valid SaaS Purchase', narration: 'Authorized request cleared within bound limit and allowed MCC.' },
  { name: 'limit', title: 'Step 2/7: Per-Tx Limit Exceeded', narration: 'Transaction declined by Policy Engine: amount exceeds contract limit.' },
  { name: 'mcc', title: 'Step 3/7: Unauthorized MCC', narration: 'Declined: Merchant category 5812 (Dining) is outside allowed SaaS MCC.' },
  { name: 'currency', title: 'Step 4/7: Currency Mismatch', narration: 'Declined: EUR currency rejected against USD-only contract.' },
  { name: 'redteam', title: 'Step 5/7: Prompt Injection Defense', narration: 'Hostile vendor terms safely parsed; limits and merchant locked.' },
  { name: 'pricehike', title: 'Step 6/7: Post-Approval Price Hike', narration: 'Secondary surcharge detected; card frozen immediately.' },
  { name: 'judge', title: 'Step 7/7: Full Verification Suite', narration: 'All 7 tracks verified against real Airwallex sandbox cards.' },
];

export const JudgeBar: React.FC = () => {
  const judge = useStore((state) => state.judge);
  const setJudge = useStore((state) => state.setJudge);
  const loadAll = useStore((state) => state.loadAll);
  const addToast = useStore((state) => state.addToast);

  const [isRunning, setIsRunning] = React.useState(false);

  const runStep = async (stepIndex: number) => {
    const stepData = SCENARIO_STEPS[stepIndex];
    if (!stepData) return;

    setIsRunning(true);
    setJudge({
      isActive: true,
      step: stepIndex + 1,
      totalSteps: SCENARIO_STEPS.length,
      scenarioName: stepData.name,
      narration: stepData.narration,
    });

    try {
      await triggerScenario(stepData.name);
      await loadAll();
      addToast(`${stepData.title} completed`, 'green');
    } catch {
      addToast(`Scenario ${stepData.name} execution failed`, 'rose');
    } finally {
      setIsRunning(false);
    }
  };

  const handleNext = () => {
    const nextStep = judge.step < SCENARIO_STEPS.length ? judge.step : 0;
    runStep(nextStep);
  };

  const handleRunFullJudge = () => {
    runStep(6); // Step 7: judge
  };

  const progressPercent = Math.min(100, Math.round((judge.step / (judge.totalSteps || 7)) * 100));

  return (
    <div className="judge-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Scale size={14} color="#a5b4fc" />
        <strong>Judge Mode:</strong>
        <span style={{ color: '#cbd5e1' }}>
          {judge.step > 0 ? `Step ${judge.step}/${judge.totalSteps}: ${judge.narration}` : 'Evaluate 7 runtime enforcement tracks against real Airwallex sandbox.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        <div className="judge-progress" style={{ width: 100, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: 'linear-gradient(90deg, #818cf8, #22d3ee)' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <button
          onClick={handleNext}
          disabled={isRunning}
          style={{
            background: 'rgba(99,102,241,0.2)',
            border: '1px solid rgba(99,102,241,0.4)',
            color: '#c7d2fe',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <SkipForward size={11} />
          <span>{isRunning ? 'Running…' : 'Next Step'}</span>
        </button>

        <button
          onClick={handleRunFullJudge}
          disabled={isRunning}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            border: 0,
            color: '#fff',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Play size={11} fill="#fff" />
          <span>Run All</span>
        </button>
      </div>
    </div>
  );
};
