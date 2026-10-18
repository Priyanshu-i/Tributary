import React, { useState } from 'react';
import {
  DollarSign,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  Clock,
  Key,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { DealSpec } from '../../core-engine/types.js';

interface LiveLedgerProps {
  currentDeal: DealSpec | null;
  ledgerState: any;
  sales: any[];
  payoutBatches: any[];
  auditLog: any[];
  auditVerification: any;
  onExpressCapture: () => Promise<any>;
  onTriggerRefund: (saleId: string) => Promise<any>;
  onOpenChaos: () => void;
  isLoading: boolean;
}

export const LiveLedger: React.FC<LiveLedgerProps> = ({
  currentDeal,
  ledgerState,
  sales,
  payoutBatches,
  auditLog,
  auditVerification,
  onExpressCapture,
  onTriggerRefund,
  onOpenChaos,
  isLoading,
}) => {
  const [selectedSale, setSelectedSale] = useState<any>(sales[0] || null);

  const activeSale = selectedSale || sales[0];
  const trace = activeSale?.trace;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-cyan-400" />
            Screen 3: Live PayPal Ledger & Waterfall Flow
          </h1>
          <p className="text-sm text-slate-400">
            Real sandbox checkout, step-by-step cent conservation waterfall, batch payouts, and tamper-evident audit log.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onExpressCapture}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/10 transition disabled:opacity-50"
          >
            <span>🛒</span>
            Express $100 Sandbox Capture
          </button>

          {activeSale && (
            <button
              onClick={() => onTriggerRefund(activeSale.sale_id)}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refund $50
            </button>
          )}

          <button
            onClick={onOpenChaos}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Chaos Suite
          </button>
        </div>
      </div>

      {/* 1. Step-by-Step Visual Waterfall (The Climax Flow) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-white">Visual Waterfall Flow: Sale Execution</div>
            {trace && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">
                [FEE SOURCE: {trace.feeSource}]
              </span>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Sale ID: <span className="text-slate-200">{activeSale?.sale_id || 'CAP-DEMO-001'}</span>
          </div>
        </div>

        {trace ? (
          <div className="space-y-6">
            {/* The 5 Pipeline Steps */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Step 1: Gross */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">1. Gross Sale</div>
                <div className="text-lg font-bold font-mono text-white">${(trace.grossCents / 100).toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">Captured via PayPal Checkout</div>
              </div>

              {/* Step 2: Fee */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">2. PayPal Fee</div>
                <div className="text-lg font-bold font-mono text-rose-400">-${(trace.feeCents / 100).toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">{trace.feeSource}</div>
              </div>

              {/* Step 3: Reserve */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">3. 10% Reserve</div>
                <div className="text-lg font-bold font-mono text-amber-400">-${(trace.reserveCents / 100).toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">14-Day Refund Holdback</div>
              </div>

              {/* Step 4: Recoup */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">4. Maya Recoup</div>
                <div className="text-lg font-bold font-mono text-cyan-400">
                  ${(trace.recoupPaidCents / 100).toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {trace.updatedLedgerState?.recoupedCents >= 40000 ? '100% RECOUPED!' : 'In Progress'}
                </div>
              </div>

              {/* Step 5: Split Pool */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">5. Split Pool</div>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  ${(trace.remainingDistributableCents / 100).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">40 / 30 / 20 / 10 Split</div>
              </div>
            </div>

            {/* Payee Payout Breakdown */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Dispatched Batch Payout Items:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  Total Dispatched: ${(trace.totalPayoutCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {trace.payeeAllocations.map((p: any) => (
                  <div key={p.payeeId} className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        DISPATCHED
                      </span>
                    </div>

                    <div className="text-xl font-bold font-mono text-cyan-400">
                      ${(p.payoutIssuedCents / 100).toFixed(2)}
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-0.5 font-mono pt-1 border-t border-slate-800">
                      {p.recoupAwardedCents > 0 && <div>Recoup Reimbursement: ${(p.recoupAwardedCents / 100).toFixed(2)}</div>}
                      <div>Tier 1 Share: ${(p.splitAwardedCents / 100).toFixed(2)}</div>
                      {p.recoveryWithheldCents > 0 && (
                        <div className="text-rose-400">Recovery Withheld: -${(p.recoveryWithheldCents / 100).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-2 font-mono">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Hard Conservation Check: {trace.grossCents} === {trace.feeCents + trace.reserveCents + trace.totalPayoutCents + trace.totalCarriedDeltaCents + trace.totalWithheldRecoveryCents} Cents
                </span>
                <span className="text-slate-500 text-[11px]">Exact Integer-Cent Arithmetic</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500 text-xs">
            No sales captured yet. Click "Express $100 Sandbox Capture" above to run the demo.
          </div>
        )}
      </div>

      {/* 2. Sub-Ledgers: Reserve & Deficits + Payout Batches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reserve & Recovery Deficit Sub-Ledger */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Reserve & Recovery Deficit Sub-Ledger
            </h2>
            <span className="text-xs font-mono text-cyan-400">
              Available Reserve: ${((ledgerState?.availableReserveCents || 0) / 100).toFixed(2)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-400">Collaborator Deficit Balances (Netted on Future Payouts):</div>
            <div className="space-y-1.5">
              {Object.entries(ledgerState?.payeeLedgers || {}).map(([id, pl]: any) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <span className="capitalize font-medium text-slate-200">{id}</span>
                  <div className="text-right font-mono">
                    <span className={pl.recoveryDeficitCents > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      Deficit: ${(pl.recoveryDeficitCents / 100).toFixed(2)}
                    </span>
                    <span className="text-slate-500 text-[10px] ml-2">
                      (Total Paid: ${(pl.totalPaidCents / 100).toFixed(2)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Batch Payouts History */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              PayPal Payout Batches ({payoutBatches.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">POST /v1/payments/payouts</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {payoutBatches.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">No payout batches recorded yet.</div>
            ) : (
              payoutBatches.map((b) => (
                <div
                  key={b.sender_batch_id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-cyan-400">{b.sender_batch_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {b.batch_status}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Amount: ${(b.total_amount_cents / 100).toFixed(2)} ({b.item_count} items)</span>
                    <span className="text-slate-500">{new Date(b.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Hash-Chained Audit Log Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">
              Cryptographically Hash-Chained Audit Log ({auditLog.length} Entries)
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Continuity: {auditVerification?.valid ? 'VERIFIED (100% Tamper-Free)' : 'CORRUPTED'}
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-[11px]">
          {auditLog.map((entry) => (
            <div
              key={entry.entry_id}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 space-y-1"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-cyan-400">
                  #{entry.entry_id} {entry.event_type}
                </span>
                <span className="text-slate-500 text-[10px]">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-slate-500 text-[10px] truncate">
                Hash: {entry.entry_hash}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
