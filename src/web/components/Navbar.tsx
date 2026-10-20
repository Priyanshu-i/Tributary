import React from 'react';
import {
  ShieldAlert,
  Cpu,
  RotateCcw,
  Zap,
  Power,
  FileCode2,
  Sliders,
  DollarSign,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Layers,
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
  onOpenOverview?: () => void;
  onOpenArchitecture?: () => void;
  isLoading: boolean;
  apiConnected: boolean;
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
  onOpenOverview,
  onOpenArchitecture,
  isLoading,
  apiConnected,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#DADCE0] shadow-sm">
      {/* 1. Global Header Bar */}
      <div className="h-14 px-6 flex items-center justify-between">
        {/* Left: Brand, Subtitle & Status Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#1A73E8] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              T
            </div>
            <div>
              <span className="font-bold text-base text-[#202124] tracking-tight">Tributary</span>
              <span className="text-xs text-[#5F6368] hidden md:inline ml-2 font-normal">
                Enterprise Revenue-Share Settlement
              </span>
            </div>
          </div>

          {/* Overview & Architecture Ghost Buttons */}
          <div className="flex items-center gap-1 ml-1 pl-3 border-l border-[#DADCE0]">
            <button
              onClick={onOpenOverview}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#E8F0FE] active:bg-[#D2E3FC] transition-colors"
              title="Open Launch Hook Overview Modal"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1A73E8]" />
              <span>Overview</span>
            </button>
            <button
              onClick={onOpenArchitecture}
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#5F6368] hover:text-[#137333] hover:bg-[#E6F4EA] active:bg-[#CEEAD6] transition-colors"
              title="Open Strict AI Air-Gap Architecture Modal"
            >
              <Layers className="w-3.5 h-3.5 text-[#137333]" />
              <span>Architecture</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-[#DADCE0]">
            {/* Sandbox Mode Pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B06000]" />
              PayPal Sandbox Live
            </span>

            {/* AI Air-Gap Pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
              <Cpu className="w-3.5 h-3.5 text-[#137333]" />
              AI Air-Gap Verified
            </span>

            {/* API Connection Indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                apiConnected
                  ? 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
                  : 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  apiConnected ? 'bg-[#137333] animate-pulse' : 'bg-[#C5221F]'
                }`}
              />
              {apiConnected ? 'API Connected (Live)' : 'API Disconnected'}
            </span>
          </div>
        </div>

        {/* Right: Judge Action Bar & Emergency Pause */}
        <div className="flex items-center gap-2">
          {/* Quick Preset: Moonlit */}
          <button
            onClick={onLoadMoonlitPreset}
            disabled={isLoading}
            title="Seed Team Moonlit: Maya is $370/$400 recouped. Ready for $100 boundary sale."
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#F8F9FA] hover:border-[#BDC1C6] active:bg-[#F1F3F4] transition-colors disabled:opacity-50"
          >
            <span>Preset: Moonlit ($370/$400)</span>
          </button>

          {/* Quick Preset: Creator */}
          <button
            onClick={onLoadCreatorPreset}
            disabled={isLoading}
            title="Seed Creator Launch: $500 ad recoup before 50/50 tier split"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#F8F9FA] hover:border-[#BDC1C6] active:bg-[#F1F3F4] transition-colors disabled:opacity-50"
          >
            <span>Preset: Creator</span>
          </button>

          {/* Run $100 Boundary Sale */}
          <button
            onClick={onRunBoundarySale}
            disabled={isLoading || isPaused}
            title="Execute $100 sale completing Maya's $400 recoup ($30) and splitting $56.42 40/30/20/10"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#1A73E8] text-white hover:bg-[#1557B0] active:bg-[#174EA6] shadow-sm transition-colors disabled:opacity-50"
          >
            <DollarSign className="w-3.5 h-3.5 stroke-[2]" />
            <span>Capture $100 Sale</span>
          </button>

          {/* Trigger $50 Refund */}
          <button
            onClick={onRunRefund}
            disabled={isLoading || isPaused}
            title="Execute $50 refund: drains $9.60 reserve to 0, nets $40.40 deficit on next sale"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#FCE8E6] hover:text-[#C5221F] hover:border-[#FAD2CF] transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2]" />
            <span>Refund $50</span>
          </button>

          {/* Run Chaos Suite */}
          <button
            onClick={onOpenChaos}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#DADCE0] bg-white text-[#3C4043] hover:bg-[#FEF7E0] hover:text-[#B06000] hover:border-[#FEEFC3] transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-[#B06000] stroke-[2]" />
            <span>Chaos Suite</span>
          </button>

          {/* Emergency Kill Switch */}
          <button
            onClick={onTogglePause}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
              isPaused
                ? 'bg-[#C5221F] text-white border-[#C5221F] hover:bg-[#A51D1A]'
                : 'border-[#DADCE0] text-[#5F6368] bg-white hover:bg-[#FCE8E6] hover:text-[#C5221F] hover:border-[#FAD2CF]'
            }`}
          >
            <Power className="w-3.5 h-3.5 stroke-[2]" />
            <span>{isPaused ? 'HALTED' : 'Kill Switch'}</span>
          </button>
        </div>
      </div>

      {/* 2. Subheader Tabs (Google Cloud Console Style) */}
      <nav className="px-6 flex items-center gap-8 border-t border-[#F1F3F4] text-xs font-medium">
        <button
          onClick={() => setActiveTab('deal-studio')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'deal-studio'
              ? 'border-[#1A73E8] text-[#1A73E8] font-semibold'
              : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          <FileCode2 className="w-4 h-4 stroke-[1.75]" />
          <span>1. Deal Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'simulator'
              ? 'border-[#1A73E8] text-[#1A73E8] font-semibold'
              : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          <Sliders className="w-4 h-4 stroke-[1.75]" />
          <span>2. Waterfall Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ledger'
              ? 'border-[#1A73E8] text-[#1A73E8] font-semibold'
              : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          <DollarSign className="w-4 h-4 stroke-[1.75]" />
          <span>3. Live Settlement Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'statements'
              ? 'border-[#1A73E8] text-[#1A73E8] font-semibold'
              : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          <UserCheck className="w-4 h-4 stroke-[1.75]" />
          <span>4. Payee Statements</span>
        </button>
      </nav>
    </header>
  );
};
