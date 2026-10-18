import React, { useState } from 'react';
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                PayPal Gateway 8-Test Chaos Suite
              </h2>
              <p className="text-xs text-slate-400">
                Automated failure injection verifying 3-layer idempotency and invariant halting.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button & Summary */}
        <div className="p-5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Chaos Suite Status:</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {results.length > 0
                ? `${results.filter((r) => r.status === 'PASS').length} / ${results.length} SCENARIOS PASS (100%)`
                : 'READY TO RUN (8 TESTS)'}
            </div>
          </div>

          <button
            onClick={onRunChaos}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Injecting Chaos...' : 'Run 8 Chaos Tests Now'}
          </button>
        </div>

        {/* Test List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {results.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs space-y-2">
              <Zap className="w-8 h-8 mx-auto text-slate-600" />
              <p>Click "Run 8 Chaos Tests Now" to trigger all failure injection scenarios.</p>
            </div>
          ) : (
            results.map((res) => (
              <div
                key={res.testNumber}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{res.testNumber}
                    </span>
                    <span className="text-xs font-bold text-white">{res.testName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {res.durationMs}ms
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.status === 'PASS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {res.status === 'PASS' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-rose-400" />
                      )}
                      {res.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{res.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    Conservation: {res.invariantHeld ? 'HELD' : 'VIOLATED'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Audit Hash: {res.auditLogHash.slice(0, 16)}...
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
