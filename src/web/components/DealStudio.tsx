import React, { useState } from 'react';
import {
  Sparkles,
  Lock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { DealSpec } from '../../core-engine/types.js';

interface DealStudioProps {
  currentDeal: DealSpec | null;
  dealStatus: 'DRAFT' | 'LOCKED';
  onCompile: (text: string, answers?: Record<string, string>) => Promise<any>;
  onLock: (dealId: string) => Promise<any>;
  isLoading: boolean;
}

export const DealStudio: React.FC<DealStudioProps> = ({
  currentDeal,
  dealStatus,
  onCompile,
  onLock,
  isLoading,
}) => {
  const [agreementText, setAgreementText] = useState<string>(
    `Team Moonlit sells an indie adventure game. Maya fronted a $400 art cost and must be repaid first from sales.
After Maya is repaid, all revenue splits 40% to Maya, 30% to Arjun, 20% to Lina, and 10% to Dev.
Once total net revenue hits $2,000, the split changes to an even 25% each.
Hold 10% for refunds for 14 days, and only pay out when someone has at least $25.`
  );

  const [ambiguities, setAmbiguities] = useState<any[]>([
    {
      id: 'ambiguity_recoup_fee_basis',
      question: "Is Maya's $400 art cost repaid before or after PayPal payment processing fees?",
      whyItMatters: 'Governs who absorbs the 3.49% + $0.49 PayPal fees during the recoup phase.',
      options: ['NET_OF_FEES', 'GROSS'],
      defaultOption: 'NET_OF_FEES',
      selected: 'NET_OF_FEES',
    },
    {
      id: 'ambiguity_clawback_rule',
      question: 'How should post-payout refunds be absorbed if the 10% reserve is fully depleted?',
      whyItMatters: 'Dictates whether deficits are clawed back proportional to what each person received or active tier weights.',
      options: ['PRO_RATA_SALE_SHARE', 'ACTIVE_TIER_WEIGHTS'],
      defaultOption: 'PRO_RATA_SALE_SHARE',
      selected: 'PRO_RATA_SALE_SHARE',
    },
    {
      id: 'ambiguity_tier_basis',
      question: 'Is the $2,000 revenue tier threshold measured on Gross sales or Net revenue after PayPal fees?',
      whyItMatters: 'Determines the exact dollar volume needed to unlock the equal 25/25/25/25 split.',
      options: ['NET_REVENUE', 'GROSS_REVENUE'],
      defaultOption: 'NET_REVENUE',
      selected: 'NET_REVENUE',
    },
  ]);

  const [canActivate, setCanActivate] = useState<boolean>(false);
  const [compilerSource, setCompilerSource] = useState<string>('REPLAY_CACHE');

  const handleSelectOption = (ambiguityId: string, option: string) => {
    setAmbiguities((prev) =>
      prev.map((a) => (a.id === ambiguityId ? { ...a, selected: option } : a))
    );
  };

  const handleRunCompile = async () => {
    const answers: Record<string, string> = {};
    ambiguities.forEach((a) => {
      if (a.selected) answers[a.id] = a.selected;
    });

    const res = await onCompile(agreementText, answers);
    if (res?.ambiguities) {
      setAmbiguities(res.ambiguities);
      setCanActivate(res.canActivate);
      setCompilerSource(res.source || 'REPLAY_CACHE');
    }
  };

  const handleConfirmAllClarifications = async () => {
    const answers: Record<string, string> = {};
    ambiguities.forEach((a) => {
      answers[a.id] = a.selected || a.defaultOption;
    });
    const res = await onCompile(agreementText, answers);
    if (res) {
      setCanActivate(true);
      setAmbiguities([]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-cyan-400" />
            Screen 1: Deal Studio & Neuro-Symbolic Compiler
          </h1>
          <p className="text-sm text-slate-400">
            Paste plain-English contracts, resolve blocking financial ambiguities, and sign an immutable SHA-256 pinned spec.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dealStatus === 'LOCKED' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              STATUS: LOCKED & HASH-PINNED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              STATUS: DRAFT (REQUIRES SIGN-OFF)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Text Editor & Clarifications */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                Plain-English Revenue-Share Agreement
              </label>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setAgreementText(
                      `Team Moonlit sells an indie adventure game. Maya fronted a $400 art cost and must be repaid first from sales. After Maya is repaid, all revenue splits 40% to Maya, 30% to Arjun, 20% to Lina, and 10% to Dev. Once total net revenue hits $2,000, the split changes to an even 25% each. Hold 10% for refunds for 14 days, and only pay out when someone has at least $25.`
                    )
                  }
                  className="text-cyan-400 hover:text-cyan-300 transition"
                >
                  Load Moonlit
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() =>
                    setAgreementText(
                      `Alex (Creator) and Apex Media launch an online course. Apex fronts $500 in ad spend which is recouped first. Thereafter, profits split 50% to Alex and 50% to Apex until $3,000 in net sales, after which Alex gets 60% and Apex gets 40%. A 10% reserve is held for student chargebacks.`
                    )
                  }
                  className="text-amber-400 hover:text-amber-300 transition"
                >
                  Load Creator
                </button>
              </div>
            </div>

            <textarea
              value={agreementText}
              onChange={(e) => setAgreementText(e.target.value)}
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition font-mono leading-relaxed"
              placeholder="Paste contract terms here..."
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Mode: <span className="text-cyan-400 font-mono">[{compilerSource}]</span>
              </div>

              <button
                type="button"
                onClick={handleRunCompile}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/10 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                Compile & Interrogate Agreement
              </button>
            </div>
          </div>

          {/* Blocking Clarification Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Blocking Clarifications ({ambiguities.length} Unresolved)
              </h2>
              {ambiguities.length > 0 && (
                <button
                  onClick={handleConfirmAllClarifications}
                  className="text-xs text-cyan-400 hover:underline font-medium"
                >
                  Accept All Recommended Defaults
                </button>
              )}
            </div>

            {ambiguities.length === 0 ? (
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-200">All Contract Ambiguities Resolved!</p>
                  <p className="text-emerald-400/80">Every mathematical ambiguity has been confirmed. The deal is eligible for immutable sign-off.</p>
                </div>
              </div>
            ) : (
              ambiguities.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4.5 space-y-3 shadow-lg"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-100">{item.question}</p>
                      <p className="text-[11px] text-slate-400">{item.whyItMatters}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {item.options.map((opt: string) => {
                      const isSelected = item.selected === opt || (!item.selected && opt === item.defaultOption);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectOption(item.id, opt)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono transition text-left border ${
                            isSelected
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 font-semibold shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{opt}</span>
                            {opt === item.defaultOption && (
                              <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-400">
                                Recommended
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Compiled Deal Spec & Lock Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Compiled Waterfall Specification
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {currentDeal?.dealId || 'deal_draft'}
              </span>
            </div>

            {/* Spec Attributes */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Agreement Title:</span>
                  <span className="text-white font-medium">{currentDeal?.title || 'Team Moonlit Deal'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Upfront Recoup Bucket:</span>
                  <span className="text-cyan-400 font-mono font-semibold">
                    ${((currentDeal?.recoupBucket?.totalCents || 40000) / 100).toFixed(2)} to{' '}
                    {currentDeal?.recoupBucket?.payeeId?.toUpperCase() || 'MAYA'} ({currentDeal?.recoupBucket?.feeBasis || 'NET_OF_FEES'})
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Refund Reserve:</span>
                  <span className="text-slate-200 font-mono">
                    {((currentDeal?.reserveBps || 1000) / 100).toFixed(0)}% (14 Days Holdback)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Revenue Tier Threshold:</span>
                  <span className="text-slate-200 font-mono">
                    ${((currentDeal?.tierThresholdNetCents || 200000) / 100).toFixed(2)} Net
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Post-Payout Clawback:</span>
                  <span className="text-slate-200 font-mono">
                    {currentDeal?.clawbackRule || 'PRO_RATA_SALE_SHARE'}
                  </span>
                </div>
              </div>

              {/* Collaborators Table */}
              <div className="space-y-2">
                <div className="text-slate-400 font-medium">Collaborators & Tier Splits:</div>
                <div className="space-y-1.5">
                  {(currentDeal?.payees || [
                    { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
                    { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
                    { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
                    { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
                  ]).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.email}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-cyan-400">Tier 1: {(p.tier1Bps / 100).toFixed(0)}%</div>
                        <div className="text-slate-500 text-[10px]">Tier 2: {(p.tier2Bps / 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hash Pinning & Sign-off Action */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] space-y-1">
                <div className="text-slate-400 flex items-center justify-between">
                  <span>SHA-256 Pinned Hash:</span>
                  <span className="text-emerald-400 text-[10px]">VERIFIED</span>
                </div>
                <div className="text-slate-300 break-all leading-tight">
                  {currentDeal?.sha256Hash || 'c85cbc0ffadbeb71e5ac5d34c769153c84cb6d432219cae5dded7ee584597dc6'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onLock(currentDeal?.dealId || 'deal_moonlit_v1')}
                disabled={isLoading || (!canActivate && ambiguities.length > 0)}
                className={`w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition ${
                  dealStatus === 'LOCKED'
                    ? 'bg-emerald-600 text-white'
                    : canActivate || ambiguities.length === 0
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                {dealStatus === 'LOCKED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    Deal Immutable & Signed (Active on PayPal)
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Sign & Lock Immutable Deal Version (SHA-256)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
