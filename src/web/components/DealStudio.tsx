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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#DADCE0] gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#202124]">Deal Studio</h1>
          <p className="text-xs text-[#5F6368] mt-0.5">
            Compile natural language revenue-share contracts into verified, executable integer-cent specifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider border ${
              dealStatus === 'LOCKED'
                ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                : 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]'
            }`}
          >
            {dealStatus === 'LOCKED' ? 'LOCKED & PINNED' : 'DRAFT MODE'}
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-medium bg-[#F1F3F4] text-[#3C4043] border border-[#DADCE0]">
            Source: {compilerSource}
          </span>
        </div>
      </div>

      {/* Main Grid: Left Editor + Right Spec */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Natural Language Input & Clarifications */}
        <div className="lg:col-span-6 space-y-5">
          {/* Editor Box */}
          <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1A73E8]" />
                <span className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
                  Revenue-Share Agreement Draft
                </span>
              </div>
              <span className="text-[11px] text-[#5F6368]">Plain English or Legal Terms</span>
            </div>

            <div className="p-4">
              <textarea
                value={agreementText}
                onChange={(e) => setAgreementText(e.target.value)}
                rows={7}
                placeholder="Paste natural language revenue agreement here..."
                className="w-full p-3 text-xs text-[#202124] bg-white border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] font-sans leading-relaxed resize-none transition-colors"
              />

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-[#5F6368]">
                  Strict Air-Gap: AI extracts structured rules; engine enforces all math.
                </div>
                <button
                  onClick={handleRunCompile}
                  disabled={isLoading}
                  className="px-4 py-2 bg-[#1A73E8] text-white hover:bg-[#1557B0] active:bg-[#174EA6] rounded-md text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
                  <span>{isLoading ? 'Compiling...' : 'Compile Agreement'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Ambiguities & Clarification Chips */}
          {ambiguities.length > 0 && (
            <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-[#FEF7E0] border-b border-[#FEEFC3] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B06000]" />
                  <span className="text-xs font-semibold text-[#B06000] uppercase tracking-wider">
                    Contract Clarifications Required ({ambiguities.length})
                  </span>
                </div>
                <span className="text-[11px] text-[#B06000] font-medium">Pre-execution alignment</span>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-xs text-[#5F6368]">
                  Tributary identified ambiguous clauses in your agreement. Choose terms to guarantee deterministic payout execution:
                </p>

                {ambiguities.map((a, idx) => (
                  <div
                    key={a.id || idx}
                    className="p-3.5 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-[#1A73E8] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#202124]">{a.question}</div>
                        <div className="text-[11px] text-[#5F6368] mt-0.5">{a.whyItMatters}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 pl-6">
                      {a.options.map((opt: string) => {
                        const isSelected = (a.selected || a.defaultOption) === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelectOption(a.id, opt)}
                            className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all border ${
                              isSelected
                                ? 'bg-[#E8F0FE] text-[#1967D2] border-[#1A73E8] shadow-sm font-semibold'
                                : 'bg-white text-[#5F6368] border-[#DADCE0] hover:bg-[#F1F3F4] hover:text-[#202124]'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleConfirmAllClarifications}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#137333] text-white hover:bg-[#0D5C26] rounded-md text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                  <span>Confirm All Clarifications & Unlock Agreement</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Executable Deal Spec */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white border border-[#DADCE0] rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#137333]" />
                <span className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
                  Executable Deal Specification
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#5F6368]">
                ID: {currentDeal?.dealId || 'deal_moonlit_demo'}
              </span>
            </div>

            <div className="p-5 space-y-5">
              {/* SHA-256 Hash Display */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#5F6368]">Cryptographic Deal Hash (SHA-256)</span>
                  <span className="text-[11px] text-[#137333] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Immutable
                  </span>
                </div>
                <div className="p-2.5 bg-[#F8F9FA] rounded border border-[#DADCE0] font-mono text-xs text-[#202124] break-all select-all tabular-nums">
                  {currentDeal?.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </div>
              </div>

              {/* Payees Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#202124] uppercase tracking-wider">
                  Payees & Waterfall Split Tiers
                </div>
                <div className="border border-[#DADCE0] rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FA] text-[#5F6368] font-medium border-b border-[#DADCE0]">
                      <tr>
                        <th className="py-2.5 px-3">Payee</th>
                        <th className="py-2.5 px-3">PayPal Email</th>
                        <th className="py-2.5 px-3 text-right">Tier 1 (&lt;$2k)</th>
                        <th className="py-2.5 px-3 text-right">Tier 2 (&ge;$2k)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DADCE0] text-[#202124]">
                      {(currentDeal?.payees || [
                        { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
                        { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
                        { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
                        { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
                      ]).map((p) => (
                        <tr key={p.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-2.5 px-3 font-medium text-[#202124]">{p.name}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#5F6368]">{p.email}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-[#202124] tabular-nums">
                            {(p.tier1Bps / 100).toFixed(0)}% <span className="text-[#80868B] text-[10px]">({p.tier1Bps} bps)</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-[#202124] tabular-nums">
                            {(p.tier2Bps / 100).toFixed(0)}% <span className="text-[#80868B] text-[10px]">({p.tier2Bps} bps)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Invariants & Parameters Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                  <div className="text-[11px] text-[#5F6368] font-medium">Recoup Priority</div>
                  <div className="text-sm font-bold text-[#202124] font-mono tabular-nums">
                    ${((currentDeal?.recoupBucket?.totalCents ?? 40000) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#137333] font-medium">
                    {currentDeal?.recoupBucket?.payeeId || 'Maya'} ({currentDeal?.recoupBucket?.feeBasis || 'NET_OF_FEES'})
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                  <div className="text-[11px] text-[#5F6368] font-medium">Tier Boundary</div>
                  <div className="text-sm font-bold text-[#202124] font-mono tabular-nums">
                    ${((currentDeal?.tierThresholdNetCents ?? 200000) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#5F6368]">
                    Cumulative Net Revenue
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                  <div className="text-[11px] text-[#5F6368] font-medium">Refund Holdback</div>
                  <div className="text-sm font-bold text-[#202124] font-mono tabular-nums">
                    {((currentDeal?.reserveBps ?? 1000) / 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-[#5F6368]">
                    {currentDeal?.holdbackDays ?? 14} days rolling reserve
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                  <div className="text-[11px] text-[#5F6368] font-medium">Min Payout Threshold</div>
                  <div className="text-sm font-bold text-[#202124] font-mono tabular-nums">
                    ${((currentDeal?.minPayoutCents ?? 2500) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#5F6368]">
                    Carried forward until reached
                  </div>
                </div>
              </div>

              {/* Lock Button */}
              {dealStatus !== 'LOCKED' ? (
                <button
                  onClick={() => onLock(currentDeal?.dealId || 'deal_moonlit_demo')}
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#137333] text-white hover:bg-[#0D5C26] active:bg-[#0A471D] rounded-md text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 stroke-[2]" />
                  <span>Lock & Cryptographically Pin Agreement</span>
                </button>
              ) : (
                <div className="w-full py-2.5 rounded-md text-xs font-semibold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                  <span>Agreement Signed & Pinned (Active for Settlement)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
