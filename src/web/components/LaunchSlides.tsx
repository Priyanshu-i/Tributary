import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  DollarSign,
  ArrowRight,
  Lock,
  Zap,
  Layers,
  Sparkles,
  RefreshCw,
  Terminal,
} from 'lucide-react';

interface LaunchSlidesProps {
  slide: 'hook' | 'architecture';
  onNavigateToApp?: () => void;
}

export const LaunchSlides: React.FC<LaunchSlidesProps> = ({ slide, onNavigateToApp }) => {
  const [chatStep, setChatStep] = useState<number>(0);

  // Progressive message reveal for the Hook scene
  useEffect(() => {
    if (slide !== 'hook') return;
    const timers = [
      setTimeout(() => setChatStep(1), 800),
      setTimeout(() => setChatStep(2), 2400),
      setTimeout(() => setChatStep(3), 4500),
      setTimeout(() => setChatStep(4), 7000),
      setTimeout(() => setChatStep(5), 9500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [slide]);

  if (slide === 'hook') {
    return (
      <div className="min-h-screen w-full bg-[#F8F9FA] text-[#202124] flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden font-sans">
        {/* Subtle Engineering Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#DADCE0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

        {/* Close Button when rendered as modal */}
        {onNavigateToApp && (
          <button
            onClick={onNavigateToApp}
            className="absolute top-6 right-6 z-30 p-2 rounded-full bg-white border border-[#DADCE0] text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] shadow-sm transition-colors"
            title="Return to Live App"
          >
            ✕
          </button>
        )}

        {/* Top Floating Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DADCE0] shadow-sm text-xs text-[#5F6368] z-10 animate-in fade-in duration-500">
          <span className="w-2 h-2 rounded-full bg-[#1A73E8] animate-pulse" />
          <span className="font-semibold text-[#202124]">TRIBUTARY</span>
          <span className="text-[#DADCE0]">·</span>
          <span>DETERMINISTIC REVENUE-SHARE INFRASTRUCTURE</span>
        </div>

        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
          {/* Left Column: Group Chat "First Sale Fight" */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white border border-[#DADCE0] rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-left duration-700">
              {/* Chat Header */}
              <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">M</span>
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-[#137333] text-white text-[10px] font-bold flex items-center justify-center">A</span>
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-[#B06000] text-white text-[10px] font-bold flex items-center justify-center">L</span>
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-[#5F6368] text-white text-[10px] font-bold flex items-center justify-center">D</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#202124]">Moonlit Game Launch Sync</div>
                    <div className="text-[10px] text-[#5F6368]">4 collaborators · Steam & PayPal checkout</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#137333] bg-[#E6F4EA] px-2 py-0.5 rounded border border-[#CEEAD6]">
                  LIVE CHAT
                </span>
              </div>

              {/* Chat Messages */}
              <div className="p-4 space-y-3 min-h-[320px] bg-white flex flex-col justify-end">
                {chatStep >= 1 && (
                  <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#5F6368] text-white text-[10px] font-bold flex items-center justify-center shrink-0">D</div>
                    <div className="bg-[#F1F3F4] rounded-lg rounded-tl-none p-2.5 max-w-[85%] text-xs text-[#202124]">
                      <div className="font-semibold text-[10px] text-[#5F6368]">Dev Patel · 2:14 PM</div>
                      🚀 We just made our first customer sales on itch & web store!! $100.00 gross captured!
                    </div>
                  </div>
                )}

                {chatStep >= 2 && (
                  <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#B06000] text-white text-[10px] font-bold flex items-center justify-center shrink-0">L</div>
                    <div className="bg-[#F1F3F4] rounded-lg rounded-tl-none p-2.5 max-w-[85%] text-xs text-[#202124]">
                      <div className="font-semibold text-[10px] text-[#5F6368]">Lina Chen · 2:15 PM</div>
                      Amazing!! Let's disburse the revenue share to everyone's PayPal right now!
                    </div>
                  </div>
                )}

                {chatStep >= 3 && (
                  <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center shrink-0">M</div>
                    <div className="bg-[#FEF7E0] border border-[#FEEFC3] rounded-lg rounded-tl-none p-2.5 max-w-[85%] text-xs text-[#202124]">
                      <div className="font-semibold text-[10px] text-[#B06000] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-[#B06000]" />
                        <span>Maya Lin · 2:16 PM (Upfront Art Funder)</span>
                      </div>
                      Wait—did we deduct the $3.98 PayPal fee before or after my $400 art recoup? Our agreement says "recoup from net revenue", but the spreadsheet deducted fees from profit split!
                    </div>
                  </div>
                )}

                {chatStep >= 4 && (
                  <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-6 h-6 rounded-full bg-[#C5221F] text-white text-[10px] font-bold flex items-center justify-center shrink-0">A</div>
                    <div className="bg-[#FCE8E6] border border-[#FAD2CF] rounded-lg rounded-tl-none p-2.5 max-w-[85%] text-xs text-[#202124]">
                      <div className="font-semibold text-[10px] text-[#C5221F] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-[#C5221F]" />
                        <span>Arjun Rao · 2:17 PM (Lead Dev)</span>
                      </div>
                      And a customer just requested a $50 refund on yesterday's sale. We already disbursed payouts to everyone's personal accounts. Who owes what back?!
                    </div>
                  </div>
                )}

                {chatStep >= 5 && (
                  <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#DADCE0] text-center text-xs text-[#5F6368] font-mono animate-in fade-in duration-500">
                    ⚠️ Split halt: Ambiguous legal wording + post-payout clawback deficit = Broken collaboration.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Hero Solution Lockup */}
          <div className="lg:col-span-6 space-y-6 animate-in fade-in slide-in-from-right duration-700">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#E8F0FE] text-[#1967D2] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>THE EXECUTABLE REVENUE-SHARE ENGINE</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-[#202124] tracking-tight leading-tight">
                Tributary
              </h1>
              <p className="text-xl sm:text-2xl font-semibold text-[#1A73E8]">
                Your revenue-share agreement, now executable.
              </p>
              <p className="text-sm text-[#5F6368] leading-relaxed pt-1">
                AI proposes and interrogates contract ambiguities. Deterministic, integer-cent code verifies and executes batch payouts on PayPal. Zero floating-point loss. Zero money hallucinated.
              </p>
            </div>

            {/* 3 Core Pillars */}
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-lg bg-white border border-[#DADCE0] shadow-sm flex items-start gap-3">
                <div className="p-2 rounded bg-[#E8F0FE] text-[#1967D2] shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">Strict AI Air-Gap Architecture</div>
                  <div className="text-[11px] text-[#5F6368] mt-0.5">
                    LLMs only draft and clarify terms. Zero access to PayPal API secrets, zero execution authority, zero float math.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#DADCE0] shadow-sm flex items-start gap-3">
                <div className="p-2 rounded bg-[#E6F4EA] text-[#137333] shrink-0 mt-0.5">
                  <DollarSign className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">Live PayPal Orders v2 & Payouts v1 Settlement</div>
                  <div className="text-[11px] text-[#5F6368] mt-0.5">
                    One customer checkout triggers multi-party batch payouts, priority recoupment, and rolling refund holdbacks automatically.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-white border border-[#DADCE0] shadow-sm flex items-start gap-3">
                <div className="p-2 rounded bg-[#FEF7E0] text-[#B06000] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">100% Mathematical Conservation Invariant</div>
                  <div className="text-[11px] text-[#5F6368] mt-0.5 font-mono">
                    Fee ($3.98) + Reserve ($9.60) + Recoup ($30.00) + Split ($56.42) === Gross ($100.00) | DELTA = 0 CENTS
                  </div>
                </div>
              </div>
            </div>

            {onNavigateToApp && (
              <div className="pt-2">
                <button
                  onClick={onNavigateToApp}
                  className="px-5 py-2.5 bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs rounded-md shadow flex items-center gap-2 transition-colors"
                >
                  <span>Launch Live Platform Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // slide === 'architecture'
  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] text-[#202124] flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#DADCE0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      {/* Close Button when rendered as modal */}
      {onNavigateToApp && (
        <button
          onClick={onNavigateToApp}
          className="absolute top-6 right-6 z-30 p-2 rounded-full bg-white border border-[#DADCE0] text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] shadow-sm transition-colors"
          title="Return to Live App"
        >
          ✕
        </button>
      )}

      <div className="max-w-5xl w-full space-y-6 z-10 animate-in fade-in duration-500">
        {/* Slide Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2] text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>FINANCIAL SAFETY ARCHITECTURE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#202124] tracking-tight">
            The Strict AI Air-Gap
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] max-w-2xl mx-auto">
            Untrusted AI natural language interpretation is strictly separated from deterministic integer monetary execution by an immutable SHA-256 cryptographic boundary.
          </p>
        </div>

        {/* 3-Layer Visual Architecture Diagram */}
        <div className="bg-white border border-[#DADCE0] rounded-xl shadow-lg p-6 space-y-6">
          {/* Top Plane: Untrusted AI Compiler Plane */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-[#B06000] flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#B06000]" />
                Untrusted AI Compiler Plane (Zero PayPal Secrets / Zero Float Math)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FEF7E0] text-[#B06000] font-mono text-[11px] font-semibold">
                PROPOSAL & INTERROGATION
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#202124] block">1. Plain-English Deal</span>
                <span className="text-[11px] text-[#5F6368] block">Natural language contract uploaded by creators</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#1A73E8] block">2. Gemini 2.5 Flash</span>
                <span className="text-[11px] text-[#5F6368] block">Structured clause extraction into JSON schema</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#B06000] block">3. Ambiguity Interrogator</span>
                <span className="text-[11px] text-[#5F6368] block">Blocks activation until 3 ambiguities resolved</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#137333] block">4. Citation Verifier</span>
                <span className="text-[11px] text-[#5F6368] block">Allowlist regex regex verifies every dollar figure</span>
              </div>
            </div>
          </div>

          {/* Middle: Hard Air-Gap Barrier Line */}
          <div className="p-3.5 rounded-lg bg-[#E6F4EA] border-2 border-[#137333] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#137333]" />
              <span className="font-bold text-[#137333] uppercase tracking-wider">
                Hard Air-Gap Boundary:
              </span>
              <span className="font-mono text-[#137333] font-semibold text-[11px]">
                SHA-256 Hash Lock + 1,000 fast-check Property Proofs
              </span>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#137333] text-white font-mono font-bold text-[11px]">
              F + R + ΣPayouts + ΣCarried === Gross (DELTA = 0¢)
            </span>
          </div>

          {/* Bottom Plane: Deterministic Monetary Execution Plane */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-[#1A73E8] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#1A73E8]" />
                Deterministic Monetary Execution Plane (Zero LLMs / Pure Integer Math)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#E8F0FE] text-[#1967D2] font-mono text-[11px] font-semibold">
                EXECUTION & SETTLEMENT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#202124] block">1. PayPal Orders v2</span>
                <span className="text-[11px] text-[#5F6368] block">Captures exact gross & seller receivable fee</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#1A73E8] block">2. Webhook Deduplicator</span>
                <span className="text-[11px] text-[#5F6368] block">3-layer idempotency checks prevent double credit</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#137333] block">3. Waterfall Engine</span>
                <span className="text-[11px] text-[#5F6368] block">Largest-Remainder integer cent distribution</span>
              </div>
              <div className="p-3 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] space-y-1">
                <span className="font-bold text-[#137333] block">4. Batch Payouts v1</span>
                <span className="text-[11px] text-[#5F6368] block">Immediate PayPal Sandbox disbursements</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Impact Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-white border border-[#DADCE0] shadow-sm space-y-1">
            <div className="text-[11px] text-[#5F6368] font-medium uppercase tracking-wider">Property Testing</div>
            <div className="text-xl font-bold font-mono text-[#137333] tabular-nums">100 / 100 PASS</div>
            <div className="text-xs text-[#5F6368]">fast-check conservation proof on random sale volumes</div>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#DADCE0] shadow-sm space-y-1">
            <div className="text-[11px] text-[#5F6368] font-medium uppercase tracking-wider">Adversarial Torture</div>
            <div className="text-xl font-bold font-mono text-[#1A73E8] tabular-nums">8 / 8 SCENARIOS</div>
            <div className="text-xs text-[#5F6368]">Tampered signatures, duplicate deliveries, & replayed payouts halted</div>
          </div>

          <div className="p-4 rounded-lg bg-white border border-[#DADCE0] shadow-sm space-y-1">
            <div className="text-[11px] text-[#5F6368] font-medium uppercase tracking-wider">PayPal Integration</div>
            <div className="text-xl font-bold font-mono text-[#202124] tabular-nums">APIMatic REST SDK</div>
            <div className="text-xs text-[#5F6368]">Orders v2, Payouts v1, Captures Refund v2, & Webhook Verify</div>
          </div>
        </div>

        {/* Impact Closing Callout */}
        <div className="p-4 rounded-lg bg-white border border-[#DADCE0] text-center space-y-1 shadow-sm">
          <div className="text-sm font-semibold text-[#202124]">
            "AI proposes and explains. Deterministic code verifies and executes. Every cent is accounted for."
          </div>
          <div className="text-xs text-[#5F6368]">
            Tributary · Built on the PayPal Developer Platform · Open Source MIT License
          </div>
        </div>
      </div>
    </div>
  );
};
