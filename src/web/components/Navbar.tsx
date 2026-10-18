import React from 'react';
import {
  ShieldAlert,
  Cpu,
  Layers,
  PlayCircle,
  RotateCcw,
  Zap,
  Power,
  FileCode2,
  Sliders,
  DollarSign,
  UserCheck,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'deal-studio' | 'simulator' | 'ledger' | 'statements';
  setActiveTab: (tab: 'deal-studio' | 'simulator' | 'ledger' | 'statements') => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onLoadMoonlitPreset: () => void;
  onLoadCreatorPreset: () => void;
  onRunBoundarySale: () => void;
  onRunRefund: () => void;
  onOpenChaos: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isPaused,
  onTogglePause,
  onLoadMoonlitPreset,
  onLoadCreatorPreset,
  onRunBoundarySale,
  onRunRefund,
  onOpenChaos,
  isLoading,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      {/* 1. Top Honesty & Sandbox Banner */}
      <div className="bg-slate-950 px-4 py-1.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            PAYPAL SANDBOX ONLY — NO REAL MONEY
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Cpu className="w-3.5 h-3.5" />
            AI AIR-GAP: ACTIVE (INTEGER MATH BY ENGINE)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            FEE SOURCE: PAYPAL ACTUAL (FALLBACK: 3.49% + $0.49)
          </span>
        </div>

        <button
          onClick={onTogglePause}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-medium transition ${
            isPaused
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {isPaused ? 'PAYOUTS SUSPENDED (PAUSED)' : 'PAUSE PAYOUTS SWITCH'}
        </button>
      </div>

      {/* 2. Main Brand & Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center font-black text-cyan-400 text-lg">
              T
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">Tributary</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono border border-blue-500/30">
                v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Your revenue-share agreement, now executable on PayPal</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('deal-studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'deal-studio'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            1. Deal Studio
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'simulator'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            2. Simulator
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'ledger'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            3. Live Ledger
          </button>
          <button
            onClick={() => setActiveTab('statements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'statements'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            4. Statements
          </button>
        </nav>
      </div>

      {/* 3. 1-Click Judge Quick-Load Action Bar */}
      <div className="bg-slate-900 border-t border-slate-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Judge 1-Click Demo Bar:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onLoadMoonlitPreset}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
              Preset 1: Moonlit Game ($370/$400 Recouped)
            </button>

            <button
              onClick={onLoadCreatorPreset}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
              Preset 2: Creator + Ad Agency
            </button>

            <button
              onClick={onRunBoundarySale}
              disabled={isLoading || isPaused}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
            >
              <span>🛒</span>
              Run $100 Boundary Sale
            </button>

            <button
              onClick={onRunRefund}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refund $50 Post-Payout
            </button>

            <button
              onClick={onOpenChaos}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Run 8 Chaos Tests
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
