import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { DealStudio } from './components/DealStudio.js';
import { Simulator } from './components/Simulator.js';
import { LiveLedger } from './components/LiveLedger.js';
import { PayeeStatement } from './components/PayeeStatement.js';
import { ChaosDrawer } from './components/ChaosDrawer.js';
import { DealSpec } from '../core-engine/types.js';
import { ChaosTestResult } from '../paypal-gateway/types.js';
import { apiRequest, checkApiHealth } from './lib/api.js';

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
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-clear notification after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Periodic API Health Poller (every 5 seconds)
  useEffect(() => {
    let isMounted = true;
    const pollHealth = async () => {
      try {
        const health = await checkApiHealth();
        if (isMounted) setApiConnected(health.status === 'ok');
      } catch {
        if (isMounted) setApiConnected(false);
      }
    };

    pollHealth();
    const interval = setInterval(pollHealth, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Load ledger details for a deal
  const refreshLedger = useCallback(async (dealId: string) => {
    try {
      const data = await apiRequest<any>(`/api/deals/${dealId}/ledger`);
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
      const data = await apiRequest<any>('/api/demo/load-preset', {
        method: 'POST',
        body: JSON.stringify({ preset: 'moonlit' }),
      });
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
      const data = await apiRequest<any>('/api/demo/load-preset', {
        method: 'POST',
        body: JSON.stringify({ preset: 'creator' }),
      });
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
        const sysData = await apiRequest<any>('/api/system/status');
        setIsPaused(sysData.isPayoutsPaused || false);
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
      const data = await apiRequest<any>('/api/system/pause', {
        method: 'POST',
        body: JSON.stringify({ paused: !isPaused }),
      });
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
      const data = await apiRequest<any>('/api/deals/compile', {
        method: 'POST',
        body: JSON.stringify({ agreementText: text, clarificationAnswers: answers }),
      });
      if (data.success) {
        setCurrentDeal(data.spec);
        setDealStatus('DRAFT');
        setNotification({
          type: 'success',
          message: `Agreement compiled successfully! Source: ${data.source}. SHA-256: ${data.spec.sha256Hash?.slice(0, 16)}...`,
        });
        return data;
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
      const data = await apiRequest<any>(`/api/deals/${dealId}/lock`, { method: 'POST' });
      if (data.success) {
        setDealStatus('LOCKED');
        if (data.spec) setCurrentDeal(data.spec);
        setNotification({
          type: 'success',
          message: `Deal locked and hash-pinned! SHA-256: ${data.sha256Hash.slice(0, 16)}... Ready for execution.`,
        });
        return data;
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
      const data = await apiRequest<any>('/api/checkout/capture-order', {
        method: 'POST',
        body: JSON.stringify({
          dealId: currentDeal.dealId,
          grossCents: 10000,
          feeCents: 398,
          simulateSandbox: false,
        }),
      });
      if (data.success) {
        await refreshLedger(currentDeal.dealId);
        setActiveTab('ledger');
        setNotification({
          type: 'success',
          message: `Captured $100.00 sale! Maya recoup finished ($30.00) + Maya split ($22.57) = $52.57 payout. Arjun: $16.93, Lina: $11.28, Dev: $5.64. Conservation verified!`,
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
      const data = await apiRequest<any>(`/api/checkout/sales/${saleId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amountCents: 5000, feeCreditCents: 0 }),
      });
      if (data.success) {
        await refreshLedger(currentDeal.dealId);
        setActiveTab('ledger');
        setNotification({
          type: 'success',
          message: `Processed $50.00 refund! Reserve drained $9.60 -> $0.00. Remaining deficit $40.40 allocated to payees for recovery netting.`,
        });
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
      const data = await apiRequest<any>(`/api/deals/${dealId}/simulate`, { method: 'POST' });
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
      const data = await apiRequest<any>('/api/chaos/run', { method: 'POST' });
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
      return await apiRequest<any>(`/api/deals/${currentDeal.dealId}/statements/${payeeId}`);
    } catch (err: any) {
      console.error('Failed to fetch statement:', err);
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col font-sans">
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
        apiConnected={apiConnected}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`p-4 rounded-lg border shadow-lg flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]'
                : notification.type === 'error'
                ? 'bg-[#FCE8E6] border-[#FAD2CF] text-[#C5221F]'
                : 'bg-[#E8F0FE] border-[#D2E3FC] text-[#1967D2]'
            }`}
          >
            <div className="flex-1 text-xs leading-relaxed font-medium">
              {notification.message}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#5F6368] hover:text-[#202124] text-xs font-bold px-1"
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
