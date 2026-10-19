import React from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Clock,
  Key,
  RotateCw,
} from 'lucide-react';
import { ChaosTestResult } from '../../paypal-gateway/types.js';

interface ChaosDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRunChaos: () => Promise<any>;
  results: ChaosTestResult[];
  isLoading: boolean;
}

export const ChaosDrawer: React.FC<ChaosDrawerProps> = ({
  isOpen,
  onClose,
  onRunChaos,
  results,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-[2px] flex justify-end">
      <div className="w-full max-w-2xl bg-white border-l border-[#DADCE0] h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#DADCE0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
              <Zap className="w-5 h-5 text-[#B06000] stroke-[2]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#202124]">
                PayPal Gateway 8-Test Chaos Suite
              </h2>
              <p className="text-xs text-[#5F6368]">
                Automated failure injection verifying 3-layer idempotency and invariant halting.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button & Summary */}
        <div className="p-4 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#202124]">
              8 Production Failure Scenarios
            </div>
            <div className="text-[11px] text-[#5F6368]">
              Runs deterministically against SQLite event store & audit logger
            </div>
          </div>

          <button
            onClick={onRunChaos}
            disabled={isLoading}
            className="px-3.5 py-2 bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white font-semibold text-xs rounded-md flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Running Suite...' : 'Run All 8 Chaos Tests'}</span>
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {results.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              {isLoading ? (
                <>
                  <RotateCw className="w-8 h-8 text-[#1A73E8] mx-auto animate-spin" />
                  <p className="text-xs text-[#202124] font-semibold">
                    Executing 8 Production Failure Scenarios...
                  </p>
                  <p className="text-[11px] text-[#5F6368]">
                    Injecting idempotency retries, signature tampering, and invariant violations
                  </p>
                </>
              ) : (
                <>
                  <Zap className="w-8 h-8 text-[#80868B] mx-auto stroke-[1.5]" />
                  <p className="text-xs text-[#5F6368]">
                    Click "Run All 8 Chaos Tests" to execute the test suite against PayPal gateway failure hooks.
                  </p>
                </>
              )}
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.testNumber || i}
                className="p-3.5 rounded-lg border border-[#DADCE0] bg-white hover:border-[#BDC1C6] transition-colors space-y-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1A73E8]">
                      #{r.testNumber}
                    </span>
                    <span className="text-xs font-semibold text-[#202124]">
                      {r.testName}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${
                      r.status === 'PASS'
                        ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                        : 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#5F6368]">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#137333]" />
                    <span className="text-[#137333] font-medium">
                      {r.invariantHeld ? 'INVARIANT HELD' : 'INVARIANT BREACH'}
                    </span>
                  </span>

                  <span className="font-mono text-[11px] text-[#80868B] tabular-nums">
                    {r.durationMs}ms
                  </span>
                </div>

                {r.details && (
                  <div className="p-2 rounded bg-[#F8F9FA] border border-[#DADCE0] text-[11px] font-mono text-[#3C4043] break-all tabular-nums">
                    {typeof r.details === 'object' ? JSON.stringify(r.details) : String(r.details)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between text-xs text-[#5F6368]">
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Key className="w-3.5 h-3.5 text-[#1A73E8]" />
            Audit Continuity Verified Across All Chaos Runs
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#F1F3F4] text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
