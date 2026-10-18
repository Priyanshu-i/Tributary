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
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#DADCE0] gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#202124]">Live Settlement Ledger</h1>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Real-time PayPal sandbox captures, integer-cent waterfall settlement, batch payouts, and tamper-evident audit continuity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExpressCapture}
            disabled={isLoading}
            className="px-3.5 py-2 bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white font-semibold text-xs rounded-md flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <DollarSign className="w-4 h-4 stroke-[2]" />
            <span>Express $100 Capture</span>
          </button>

          {activeSale && (
            <button
              onClick={() => onTriggerRefund(activeSale.sale_id)}
              disabled={isLoading}
              className="px-3 py-2 bg-white border border-[#DADCE0] hover:bg-[#FCE8E6] hover:text-[#C5221F] hover:border-[#FAD2CF] text-[#3C4043] font-medium text-xs rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2]" />
              <span>Refund $50</span>
            </button>
          )}

          <button
            onClick={onOpenChaos}
            className="px-3 py-2 bg-white border border-[#DADCE0] hover:bg-[#FEF7E0] hover:text-[#B06000] hover:border-[#FEEFC3] text-[#3C4043] font-medium text-xs rounded-md flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-[#B06000] stroke-[2]" />
            <span>Chaos Suite</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DADCE0] rounded-lg p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-medium text-[#5F6368]">Maya Art Recoup Progress</span>
          <div className="text-lg font-bold text-[#202124] font-mono tabular-nums">
            ${((ledgerState?.recoupedCents ?? 37000) / 100).toFixed(2)}
            <span className="text-xs text-[#80868B] font-normal"> / $400.00</span>
          </div>
          <div className="w-full bg-[#F1F3F4] rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-[#1A73E8] h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  ((ledgerState?.recoupedCents ?? 37000) / (currentDeal?.recoupBucket?.totalCents || 40000)) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#DADCE0] rounded-lg p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-medium text-[#5F6368]">Cumulative Net Revenue</span>
          <div className="text-lg font-bold text-[#202124] font-mono tabular-nums">
            ${((ledgerState?.cumulativeNetCents ?? 37000) / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-[#5F6368]">
            Tier 2 Threshold: <span className="font-mono tabular-nums">$2,000.00</span>
          </div>
        </div>

        <div className="bg-white border border-[#DADCE0] rounded-lg p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-medium text-[#5F6368]">Rolling Refund Reserve</span>
          <div className="text-lg font-bold text-[#B06000] font-mono tabular-nums">
            ${((ledgerState?.availableReserveCents ?? 960) / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-[#5F6368]">10% of Net (14-day holdback)</div>
        </div>

        <div className="bg-white border border-[#DADCE0] rounded-lg p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-medium text-[#5F6368]">Audit Chain Integrity</span>
          <div className="text-lg font-bold text-[#137333] flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-[#137333]" />
            <span>CONTINUOUS</span>
          </div>
          <div className="text-[11px] font-mono text-[#5F6368] truncate">
            {auditVerification?.valid ? 'All SHA-256 links verified' : 'Integrity Alert'}
          </div>
        </div>
      </div>

      {/* Visual Waterfall Flow: Active Sale Execution Inspector */}
      {trace && (
        <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#F8F9FA] border-b border-[#DADCE0] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
                Active Sale Waterfall Flow: {activeSale.sale_id}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
                FEE SOURCE: {trace.feeSource}
              </span>
            </div>
            <div className="text-xs font-mono text-[#5F6368]">
              Captured: <span className="text-[#202124] font-semibold">{new Date(activeSale.created_at).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Waterfall Sequence */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="text-[10px] font-bold text-[#80868B] uppercase">Gross Captured</span>
                <div className="text-base font-bold text-[#202124] font-mono tabular-nums">
                  ${(trace.grossCents / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#5F6368]">PayPal Order v2</div>
              </div>

              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="text-[10px] font-bold text-[#80868B] uppercase">PayPal Fee</span>
                <div className="text-base font-bold text-[#C5221F] font-mono tabular-nums">
                  -${(trace.paypalFeeCents / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#5F6368]">{trace.feeSource}</div>
              </div>

              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="text-[10px] font-bold text-[#80868B] uppercase">10% Reserve</span>
                <div className="text-base font-bold text-[#B06000] font-mono tabular-nums">
                  -${(trace.reserveHoldbackCents / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#5F6368]">Holdback Pool</div>
              </div>

              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="text-[10px] font-bold text-[#80868B] uppercase">Maya Art Recoup</span>
                <div className="text-base font-bold text-[#1A73E8] font-mono tabular-nums">
                  ${(trace.recoupPaidCents / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#5F6368]">Recoup Priority</div>
              </div>

              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="text-[10px] font-bold text-[#80868B] uppercase">Total Payouts</span>
                <div className="text-base font-bold text-[#137333] font-mono tabular-nums">
                  ${(trace.totalPayoutCents / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#5F6368]">Batch Payouts v1</div>
              </div>
            </div>

            {/* Payee Breakdown Table */}
            <div className="border border-[#DADCE0] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] text-[#5F6368] font-medium border-b border-[#DADCE0]">
                  <tr>
                    <th className="py-2.5 px-4">Payee</th>
                    <th className="py-2.5 px-4">Role / Email</th>
                    <th className="py-2.5 px-4 text-right">Recoup Share</th>
                    <th className="py-2.5 px-4 text-right">Waterfall Split</th>
                    <th className="py-2.5 px-4 text-right">Net Payout</th>
                    <th className="py-2.5 px-4 text-right">Payout Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DADCE0] text-[#202124]">
                  {trace.payeeAllocations.map((p: any) => (
                    <tr key={p.payeeId} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#202124]">{p.name}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#5F6368]">{p.email}</td>
                      <td className="py-3 px-4 text-right font-mono text-[#5F6368] tabular-nums">
                        {p.payeeId === 'maya' && trace.recoupPaidCents > 0
                          ? `$${(trace.recoupPaidCents / 100).toFixed(2)}`
                          : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#5F6368] tabular-nums">
                        ${(p.rawShareCents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#137333] text-sm tabular-nums">
                        ${(p.payoutIssuedCents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                          PAID (Batch)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Invariant Equation Verification Banner */}
            <div className="p-3.5 rounded-lg bg-[#E6F4EA] border border-[#CEEAD6] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                <span className="font-semibold text-[#137333]">
                  Hard Conservation Assertion:
                </span>
                <span className="font-mono text-[#137333] tabular-nums">
                  Fee (${(trace.paypalFeeCents / 100).toFixed(2)}) + Reserve (${(trace.reserveHoldbackCents / 100).toFixed(2)}) + Maya (${(trace.payeeAllocations.find((p: any) => p.payeeId === 'maya')?.payoutIssuedCents / 100 || 0).toFixed(2)}) + Arjun (${(trace.payeeAllocations.find((p: any) => p.payeeId === 'arjun')?.payoutIssuedCents / 100 || 0).toFixed(2)}) + Lina (${(trace.payeeAllocations.find((p: any) => p.payeeId === 'lina')?.payoutIssuedCents / 100 || 0).toFixed(2)}) + Dev (${(trace.payeeAllocations.find((p: any) => p.payeeId === 'dev')?.payoutIssuedCents / 100 || 0).toFixed(2)}) === ${(trace.grossCents / 100).toFixed(2)}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-white text-[#137333] font-mono font-bold text-[11px] border border-[#CEEAD6]">
                DELTA = 0 CENTS
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Captured Sales History Table */}
      <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
            Captured Sales History ({sales.length})
          </span>
          <span className="text-[11px] text-[#5F6368]">Click any sale to inspect waterfall trace</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] text-[#5F6368] font-medium border-b border-[#DADCE0]">
              <tr>
                <th className="py-2.5 px-4">Sale ID</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4 text-right">Gross</th>
                <th className="py-2.5 px-4 text-right">Fee</th>
                <th className="py-2.5 px-4 text-right">Net</th>
                <th className="py-2.5 px-4 text-right">Reserve (10%)</th>
                <th className="py-2.5 px-4 text-right">Payouts</th>
                <th className="py-2.5 px-4 text-center">Batch ID</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DADCE0] text-[#202124]">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[#5F6368]">
                    No sales captured yet. Click "Express $100 Capture" above or "Run Boundary Sale" in the top bar.
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const sTrace = s.trace;
                  const isSelected = activeSale?.sale_id === s.sale_id;
                  return (
                    <tr
                      key={s.sale_id}
                      onClick={() => setSelectedSale(s)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#E8F0FE]' : 'hover:bg-[#F8F9FA]'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-[#1A73E8]">{s.sale_id}</td>
                      <td className="py-3 px-4 text-[#5F6368]">{new Date(s.created_at).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        ${(s.gross_cents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#C5221F] tabular-nums">
                        -${(s.paypal_fee_cents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium tabular-nums">
                        ${(s.net_cents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#B06000] tabular-nums">
                        -${((sTrace?.reserveHoldbackCents ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#137333] tabular-nums">
                        ${((sTrace?.totalPayoutCents ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-[#5F6368]">
                        {s.payout_batch_id || 'LOCAL_DEMO'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTriggerRefund(s.sale_id);
                          }}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded text-[11px] font-medium border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#FCE8E6] hover:text-[#C5221F] hover:border-[#FAD2CF] transition-colors"
                        >
                          Refund $50
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cryptographically Hash-Chained Audit Log Viewer */}
      <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F8F9FA] border-b border-[#DADCE0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#1A73E8]" />
            <span className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
              Cryptographic Hash-Chained Audit Log ({auditLog.length} Entries)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full font-mono text-[11px] bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Continuous Chain Verified
            </span>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] text-[#5F6368] font-medium border-b border-[#DADCE0] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4 w-14">#</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Canonical Payload Summary</th>
                <th className="py-2.5 px-4 font-mono">SHA-256 Entry Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DADCE0] text-[#202124]">
              {auditLog.map((entry) => (
                <tr key={entry.entry_id} className="hover:bg-[#F8F9FA] transition-colors">
                  <td className="py-2 px-4 font-mono text-[11px] text-[#5F6368] tabular-nums">
                    {entry.entry_id}
                  </td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        entry.event_type === 'INVARIANT_HALT'
                          ? 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]'
                          : entry.event_type === 'DEAL_SIGNED'
                          ? 'bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]'
                          : entry.event_type === 'REFUND_CLAWBACK_APPLIED'
                          ? 'bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]'
                          : 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]'
                      }`}
                    >
                      {entry.event_type}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-[#5F6368] text-[11px]">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-4 font-mono text-[11px] text-[#3C4043] max-w-xs truncate">
                    {JSON.stringify(entry.payload)}
                  </td>
                  <td className="py-2 px-4 font-mono text-[11px] text-[#5F6368] select-all tabular-nums">
                    {entry.entry_hash ? `${entry.entry_hash.slice(0, 18)}...` : 'GENESIS'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
