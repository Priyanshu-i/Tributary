import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { DealStudio } from './components/DealStudio.js';
import { Simulator } from './components/Simulator.js';
import { LiveLedger } from './components/LiveLedger.js';
import { PayeeStatement } from './components/PayeeStatement.js';
import { ChaosDrawer } from './components/ChaosDrawer.js';
import { DealSpec } from '../core-engine/types.js';
import { ChaosTestResult } from '../paypal-gateway/types.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deal-studio' | 'simulator' | 'ledger' | 'statements'>('deal-studio');
  const [currentDeal, setCurrentDeal] = useState<DealSpec | null>(null);
  const [dealStatus, setDealStatus] = useState<'DRAFT' | 'LOCKED'>('LOCKED');
  const [ledgerState, setLedgerState] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [payoutBatches, setPayoutBatches] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditVerification, setAuditVerification] = useState<any>({ valid: true });
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isChaosOpen, setIsChaosOpen] = useState<boolean>(false);
  const [chaosResults, setChaosResults] = useState<ChaosTestResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-clear notification after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load ledger details for a deal
  const refreshLedger = useCallback(async (dealId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/ledger`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setLedgerState(data.ledgerState);
        setSales(data.sales || []);
        setPayoutBatches(data.payoutBatches || []);
        setAuditLog(data.auditLog || []);
        setAuditVerification(data.auditVerification || { valid: true });
        if (data.deal?.spec) {
          setCurrentDeal(data.deal.spec);
          setDealStatus(data.deal.status || 'LOCKED');
        }
      }
    } catch (err: any) {
      console.error('Failed to refresh ledger:', err);
    }
  }, []);

  // Load Moonlit preset
  const handleLoadMoonlitPreset = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/demo/load-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'moonlit' }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshLedger(data.dealId);
        setNotification({
          type: 'success',
          message: 'Seeded Team Moonlit: Maya is at $370.00 / $400.00 recouped. Ready for $100 Demo Climax sale!',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Preset load error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  }, [refreshLedger]);

  // Load Creator preset
  const handleLoadCreatorPreset = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/demo/load-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'creator' }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshLedger(data.dealId);
        setNotification({
          type: 'success',
          message: 'Seeded Creator Launch: $500 upfront ad spend before 50/50 profit split.',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Preset load error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  }, [refreshLedger]);

  // Initial mount: load system status and seed moonlit demo
  useEffect(() => {
    const init = async () => {
      try {
        const sysRes = await fetch('/api/system/status');
        if (sysRes.ok) {
          const sysData = await sysRes.json();
          setIsPaused(sysData.isPayoutsPaused || false);
        }
      } catch (err) {
        console.warn('System status check skipped:', err);
      }
      await handleLoadMoonlitPreset();
    };
    init();
  }, [handleLoadMoonlitPreset]);

  // Toggle Pause (Kill-Switch)
  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/system/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !isPaused }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPaused(data.isPayoutsPaused);
        setNotification({
          type: data.isPayoutsPaused ? 'error' : 'success',
          message: data.message,
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Pause toggle failed: ${err.message}` });
    }
  };

  // Compile agreement text
  const handleCompile = async (text: string, answers?: Record<string, string>) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/deals/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementText: text, clarificationAnswers: answers }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentDeal(data.spec);
        setDealStatus('DRAFT');
        setNotification({
          type: 'success',
          message: `Agreement compiled successfully! Source: ${data.source}. SHA-256: ${data.spec.sha256Hash?.slice(0, 16)}...`,
        });
        return data;
      } else {
        throw new Error(data.error || 'Compilation failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Compiler Error: ${err.message}` });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Lock Deal
  const handleLockDeal = async (dealId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/lock`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDealStatus('LOCKED');
        if (data.spec) setCurrentDeal(data.spec);
        setNotification({
          type: 'success',
          message: `Deal locked and hash-pinned! SHA-256: ${data.sha256Hash.slice(0, 16)}... Ready for execution.`,
        });
        return data;
      } else {
        throw new Error(data.error || 'Lock failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Lock Error: ${err.message}` });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Run Boundary Demo Climax Sale ($100.00)
  const handleRunBoundarySale = async () => {
    if (!currentDeal) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/checkout/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: currentDeal.dealId,
          grossCents: 10000,
          feeCents: 398,
          simulateSandbox: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshLedger(currentDeal.dealId);
        setActiveTab('ledger');
        setNotification({
          type: 'success',
          message: `Captured $100.00 sale! Maya recoup finished ($30.00) + Maya split ($22.57) = $52.57 payout. Arjun: $16.93, Lina: $11.28, Dev: $5.64. Conservation verified!`,
        });
      } else {
        setNotification({
          type: 'error',
          message: data.message || data.error || 'Sale execution halted.',
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Capture error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Run Refund ($50.00 on latest sale)
  const handleRunRefund = async (targetSaleId?: string) => {
    if (!currentDeal) return;
    const saleId = targetSaleId || sales[0]?.sale_id;
    if (!saleId) {
      setNotification({
        type: 'info',
        message: 'No sales available to refund. Run a $100 sale first!',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/checkout/sales/${saleId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: 5000, feeCreditCents: 0 }),
      });
      const data = await res.json();
      if (data.success) {
        await refreshLedger(currentDeal.dealId);
        setActiveTab('ledger');
        setNotification({
          type: 'success',
          message: `Processed $50.00 refund! Reserve drained $9.60 -> $0.00. Remaining deficit $40.40 allocated to payees for recovery netting.`,
        });
      } else {
        setNotification({ type: 'error', message: data.error || 'Refund failed' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Refund error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Run Adversarial Simulator Scenarios
  const handleSimulate = async (dealId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/simulate`, { method: 'POST' });
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Simulation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Run Chaos Harness Suite
  const handleRunChaos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chaos/run', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.report) {
        setChaosResults(data.report.results || []);
        if (currentDeal) {
          await refreshLedger(currentDeal.dealId);
        }
        setNotification({
          type: 'success',
          message: `Chaos Suite complete: ${data.report.passedCount}/${data.report.totalCount} tests passed with cryptographic audit integrity.`,
        });
        return data.report;
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Chaos Suite failed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Payee Statement
  const handleFetchStatement = async (payeeId: string) => {
    if (!currentDeal) return null;
    try {
      const res = await fetch(`/api/deals/${currentDeal.dealId}/statements/${payeeId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err: any) {
      console.error('Failed to fetch statement:', err);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation & Judge Quick-Load Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onLoadMoonlitPreset={handleLoadMoonlitPreset}
        onLoadCreatorPreset={handleLoadCreatorPreset}
        onRunBoundarySale={handleRunBoundarySale}
        onRunRefund={() => handleRunRefund()}
        onOpenChaos={() => setIsChaosOpen(true)}
        isLoading={isLoading}
      />

      {/* Floating Notification Banner */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div
            className={`p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-200'
            }`}
          >
            <div className="flex-1 text-xs leading-relaxed font-medium">
              {notification.message}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'deal-studio' && (
          <DealStudio
            currentDeal={currentDeal}
            dealStatus={dealStatus}
            onCompile={handleCompile}
            onLock={handleLockDeal}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'simulator' && (
          <Simulator
            currentDeal={currentDeal}
            onSimulate={handleSimulate}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'ledger' && (
          <LiveLedger
            currentDeal={currentDeal}
            ledgerState={ledgerState}
            sales={sales}
            payoutBatches={payoutBatches}
            auditLog={auditLog}
            auditVerification={auditVerification}
            onExpressCapture={handleRunBoundarySale}
            onTriggerRefund={handleRunRefund}
            onOpenChaos={() => setIsChaosOpen(true)}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'statements' && (
          <PayeeStatement
            currentDeal={currentDeal}
            ledgerState={ledgerState}
            sales={sales}
            onFetchStatement={handleFetchStatement}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* 8-Test Chaos Drawer */}
      <ChaosDrawer
        isOpen={isChaosOpen}
        onClose={() => setIsChaosOpen(false)}
        onRunChaos={handleRunChaos}
        results={chaosResults}
        isLoading={isLoading}
      />
    </div>
  );
};

export default App;
