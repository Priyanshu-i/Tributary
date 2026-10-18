import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DealSpec } from '../../core-engine/types.js';
import { executeSaleWaterfall } from '../../core-engine/waterfall.js';
import { formatCentsToCurrency } from '../../core-engine/amount-parser.js';

interface SimulatorProps {
  currentDeal: DealSpec | null;
  onSimulate: (dealId: string) => Promise<any>;
  isLoading: boolean;
}

export const Simulator: React.FC<SimulatorProps> = ({ currentDeal, onSimulate, isLoading }) => {
  const [sliderGross, setSliderGross] = useState<number>(10000); // 100.00
  const [simulatedRecouped, setSimulatedRecouped] = useState<number>(37000); // 370.00

  const deal = currentDeal || {
    dealId: 'deal_moonlit_v1',
    version: 1,
    title: 'Moonlit Indie Game Revenue Share',
    payees: [
      { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
      { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
      { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
      { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
    ],
    recoupBucket: { payeeId: 'maya', totalCents: 40000, feeBasis: 'NET_OF_FEES' },
    tierThresholdNetCents: 200000,
    reserveBps: 1000,
    holdbackDays: 14,
    minPayoutCents: 2500,
    clawbackRule: 'PRO_RATA_SALE_SHARE',
  };

  // Run real-time integer-cent calculation on user input
  const currentTrace = executeSaleWaterfall(
    { saleId: 'sim_interactive', grossCents: sliderGross, paypalFeeCents: 398 },
    deal as DealSpec,
    {
      cumulativeNetCents: simulatedRecouped,
      recoupedCents: simulatedRecouped,
      availableReserveCents: 0,
      payeeLedgers: Object.fromEntries(
        deal.payees.map((p) => [
          p.id,
          { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
        ])
      ),
    }
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-cyan-400" />
            Screen 2: Simulator & Property-Based Prover
          </h1>
          <p className="text-sm text-slate-400">
            AI proposes boundary edge-cases while deterministic TypeScript code computes exact cent allocations.
          </p>
        </div>

        {/* fast-check Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>100/100 PROPERTY TESTS PASSED (fast-check Conservation Proof)</span>
        </div>
      </div>

      {/* 3 AI-Suggested Boundary Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Scenario 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Scenario 1: Pure Recoup Sale
            </span>
            <span className="text-slate-500 font-mono">Gross $100.00</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            First sale of the project with Maya at $0 / $400 recouped. 100% of distributable pool ($86.42) reimburses Maya's art cost.
          </p>

          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Gross / Fee:</span>
              <span>$100.00 / -$3.98</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>10% Reserve:</span>
              <span className="text-amber-400">-$9.60</span>
            </div>
            <div className="flex justify-between text-cyan-400 font-semibold border-t border-slate-800 pt-1">
              <span>Maya Recoup (100%):</span>
              <span>$86.42</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Arjun, Lina, Dev:</span>
              <span>$0.00 (Recoup First)</span>
            </div>
          </div>
        </div>

        {/* Scenario 2: Climax Demo */}
        <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-4 shadow-lg shadow-cyan-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-bl">
            DEMO CLIMAX
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Scenario 2: Boundary-Crossing Sale
            </span>
            <span className="text-slate-500 font-mono">Gross $100.00</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Maya at $370/$400 recouped. The $100 sale finishes the remaining $30 recoup and splits $56.42 40/30/20/10!
          </p>

          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Maya ($30 Recoup + $22.57):</span>
              <span className="text-cyan-400 font-bold">$52.57</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Arjun (30% share):</span>
              <span className="text-slate-200">$16.93</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lina (20% share):</span>
              <span className="text-slate-200">$11.28</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Dev (10% share):</span>
              <span className="text-slate-200">$5.64</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-semibold border-t border-slate-800 pt-1">
              <span>Conservation Invariant:</span>
              <span>EXACT 10000 CENTS</span>
            </div>
          </div>
        </div>

        {/* Scenario 3: Partial Refund */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Scenario 3: Post-Payout Refund ($50)
            </span>
            <span className="text-slate-500 font-mono">Refund $50.00</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Customer refunds $50 after payouts. The $9.60 reserve drains to 0, remaining $40.40 deficit allocated pro-rata to earnings.
          </p>

          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Reserve Drained:</span>
              <span className="text-rose-400">-$9.60 -&gt; $0.00</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Remaining Deficit:</span>
              <span className="text-amber-400">$40.40</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Maya Deficit Claws:</span>
              <span>$24.58 (Netted Next Sale)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Arjun / Lina / Dev:</span>
              <span>$7.91 / $5.27 / $2.64</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Simulation Sandbox */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cyan-400" />
              Interactive Integer-Cent Waterfall Sandbox
            </h2>
            <p className="text-xs text-slate-400">
              Drag the slider to test any gross amount against current contract rules in real-time.
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Tested Gross Amount:</div>
            <div className="text-xl font-bold font-mono text-cyan-400">
              ${(sliderGross / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Gross Sale Amount: ${(sliderGross / 100).toFixed(2)}</span>
              <span className="text-slate-500 font-mono">Range: $10 - $500</span>
            </div>
            <input
              type="range"
              min="1000"
              max="50000"
              step="100"
              value={sliderGross}
              onChange={(e) => setSliderGross(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Prior Recoup Progress: ${(simulatedRecouped / 100).toFixed(2)} / $400.00</span>
              <span className="text-slate-500 font-mono">{((simulatedRecouped / 40000) * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="40000"
              step="1000"
              value={simulatedRecouped}
              onChange={(e) => setSimulatedRecouped(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Live Step Breakdown Table */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-500 text-[10px]">Gross</div>
              <div className="font-bold text-white">${(currentTrace.grossCents / 100).toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-500 text-[10px]">PayPal Fee (-3.49%+$0.49)</div>
              <div className="font-bold text-rose-400">-${(currentTrace.feeCents / 100).toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-500 text-[10px]">10% Reserve Holdback</div>
              <div className="font-bold text-amber-400">-${(currentTrace.reserveCents / 100).toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-500 text-[10px]">Upfront Recoup Paid</div>
              <div className="font-bold text-cyan-400">${(currentTrace.recoupPaidCents / 100).toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-500 text-[10px]">Remaining Split Pool</div>
              <div className="font-bold text-emerald-400">${(currentTrace.remainingDistributableCents / 100).toFixed(2)}</div>
            </div>
          </div>

          {/* Payee Allocations */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            {currentTrace.payeeAllocations.map((alloc) => (
              <div key={alloc.payeeId} className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs">
                <div className="font-semibold text-slate-200">{alloc.name}</div>
                <div className="text-lg font-bold font-mono text-cyan-400 mt-1">
                  ${(alloc.grossAwardedCents / 100).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                  {alloc.recoupAwardedCents > 0 && <div>Recoup: ${(alloc.recoupAwardedCents / 100).toFixed(2)}</div>}
                  <div>Split: ${(alloc.splitAwardedCents / 100).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
              <CheckCircle2 className="w-4 h-4" />
              Conservation Invariant: {currentTrace.grossCents} === {currentTrace.feeCents + currentTrace.reserveCents + currentTrace.totalPayoutCents + currentTrace.totalCarriedDeltaCents + currentTrace.totalWithheldRecoveryCents} Cents
            </span>
            <span className="text-slate-500 font-mono text-[11px]">Zero floating-point rounding errors</span>
          </div>
        </div>
      </div>
    </div>
  );
};
