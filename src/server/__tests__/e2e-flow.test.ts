import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { createAppState } from '../state.js';

describe('Phase 5: End-to-End Integration Flow (SPEC.md Demo Scenario)', () => {
  let app: any;
  let state: any;

  beforeEach(() => {
    // Isolated in-memory state for pristine E2E run
    state = createAppState(':memory:');
    const created = createApp(state);
    app = created.app;
  });

  it('executes full Moonlit agreement lifecycle: Compile -> Interrogate -> Lock -> Seed -> $100 Sale -> $50 Refund -> Statement -> Audit Proof', async () => {
    // -------------------------------------------------------------
    // Step 1: Compile Moonlit Agreement (POST /api/deals/compile)
    // -------------------------------------------------------------
    const moonlitAgreement = `
      Team Moonlit sells an indie adventure game. Maya fronted a $400 art cost and must be repaid first from sales.
      After Maya is repaid, all revenue splits 40% to Maya, 30% to Arjun, 20% to Lina, and 10% to Dev.
      Once total net revenue hits $2,000, the split changes to an even 25% each.
      Hold 10% for refunds for 14 days, and only pay out when someone has at least $25.
    `;

    const compileRes = await app.request('/api/deals/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementText: moonlitAgreement }),
    });

    expect(compileRes.status).toBe(200);
    const compileData = await compileRes.json();
    expect(compileData.success).toBe(true);
    expect(compileData.spec.dealId).toBeDefined();
    expect(compileData.spec.payees).toHaveLength(4);
    expect(compileData.ambiguities.length).toBeGreaterThan(0);
    expect(compileData.canActivate).toBe(false); // Blocked!

    const dealId = compileData.spec.dealId;

    // -------------------------------------------------------------
    // Step 2: Answer Ambiguities -> Verify canActivate: true
    // -------------------------------------------------------------
    const answerRes = await app.request('/api/deals/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agreementText: moonlitAgreement,
        clarificationAnswers: {
          ambiguity_recoup_fee_basis: 'NET_OF_FEES',
          ambiguity_clawback_rule: 'PRO_RATA_SALE_SHARE',
          ambiguity_tier_basis: 'NET_REVENUE',
        },
      }),
    });

    expect(answerRes.status).toBe(200);
    const answerData = await answerRes.json();
    expect(answerData.ambiguities).toHaveLength(0);
    expect(answerData.canActivate).toBe(true); // Unlocked!

    // -------------------------------------------------------------
    // Step 3: Lock Deal Hash (POST /api/deals/:id/lock)
    // -------------------------------------------------------------
    const lockRes = await app.request(`/api/deals/${dealId}/lock`, {
      method: 'POST',
    });

    expect(lockRes.status).toBe(200);
    const lockData = await lockRes.json();
    expect(lockData.status).toBe('LOCKED');
    expect(lockData.sha256Hash).toBeDefined();
    expect(lockData.sha256Hash.length).toBe(64);

    // -------------------------------------------------------------
    // Step 4: Load Demo Preset ($370 / $400 Recouped)
    // -------------------------------------------------------------
    const presetRes = await app.request('/api/demo/load-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: 'moonlit' }),
    });

    expect(presetRes.status).toBe(200);
    const presetData = await presetRes.json();
    expect(presetData.preset).toBe('moonlit');
    expect(presetData.recoupedCents).toBe(37000);
    expect(presetData.remainingRecoupCents).toBe(3000);

    const demoDealId = presetData.dealId;

    // -------------------------------------------------------------
    // Step 5: Capture $100.00 Order (POST /api/checkout/capture-order)
    // -------------------------------------------------------------
    const captureRes = await app.request('/api/checkout/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: demoDealId,
        grossCents: 10000, // $100.00
        feeCents: 398, // $3.98
        simulateSandbox: true,
      }),
    });

    expect(captureRes.status).toBe(200);
    const captureData = await captureRes.json();
    expect(captureData.success).toBe(true);
    expect(captureData.grossCents).toBe(10000);
    expect(captureData.feeCents).toBe(398);

    // -------------------------------------------------------------
    // Step 6: Verify 4 Payout Items (Exact Demo Climax Numbers!)
    // Maya: 5257, Arjun: 1693, Lina: 1128, Dev: 564
    // -------------------------------------------------------------
    const trace = captureData.trace;
    expect(trace.netCents).toBe(9602);
    expect(trace.reserveCents).toBe(960);
    expect(trace.recoupPaidCents).toBe(3000); // exactly finishes recoup!
    expect(trace.remainingDistributableCents).toBe(5642);

    const maya = trace.payeeAllocations.find((p: any) => p.payeeId === 'maya');
    const arjun = trace.payeeAllocations.find((p: any) => p.payeeId === 'arjun');
    const lina = trace.payeeAllocations.find((p: any) => p.payeeId === 'lina');
    const dev = trace.payeeAllocations.find((p: any) => p.payeeId === 'dev');

    expect(maya.payoutIssuedCents).toBe(5257);
    expect(arjun.payoutIssuedCents).toBe(1693);
    expect(lina.payoutIssuedCents).toBe(1128);
    expect(dev.payoutIssuedCents).toBe(564);

    // Hard Conservation Check
    const sumCents =
      maya.payoutIssuedCents +
      arjun.payoutIssuedCents +
      lina.payoutIssuedCents +
      dev.payoutIssuedCents +
      trace.reserveCents +
      trace.feeCents;

    expect(sumCents).toBe(10000);
    expect(trace.invariantVerified).toBe(true);

    const saleId = captureData.saleId;

    // -------------------------------------------------------------
    // Step 7: Trigger $50.00 Refund (POST /api/checkout/sales/:id/refund)
    // -------------------------------------------------------------
    const refundRes = await app.request(`/api/checkout/sales/${saleId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: 5000, // $50.00
      }),
    });

    expect(refundRes.status).toBe(200);
    const refundData = await refundRes.json();
    expect(refundData.success).toBe(true);
    // Reserve drains from 960 to 0
    expect(refundData.refundResult.reserveAbsorbedCents).toBe(960);
    expect(refundData.updatedLedger.availableReserveCents).toBe(0);
    // Remaining 4040 deficit is clawed back pro-rata
    expect(refundData.refundResult.remainingDeficitCents).toBe(4040);

    const clawbacks = refundData.refundResult.payeeClawbacks;
    const mayaClaw = clawbacks.find((c: any) => c.payeeId === 'maya').clawbackCents;
    const arjunClaw = clawbacks.find((c: any) => c.payeeId === 'arjun').clawbackCents;
    const linaClaw = clawbacks.find((c: any) => c.payeeId === 'lina').clawbackCents;
    const devClaw = clawbacks.find((c: any) => c.payeeId === 'dev').clawbackCents;

    expect(mayaClaw).toBe(2458);
    expect(arjunClaw).toBe(791);
    expect(linaClaw).toBe(527);
    expect(devClaw).toBe(264);
    expect(mayaClaw + arjunClaw + linaClaw + devClaw).toBe(4040);

    // -------------------------------------------------------------
    // Step 8: Fetch Maya's Citation-Verified Statement (GET /api/deals/:id/statements/maya)
    // -------------------------------------------------------------
    const statementRes = await app.request(`/api/deals/${demoDealId}/statements/maya`);
    expect(statementRes.status).toBe(200);
    const statementData = await statementRes.json();
    expect(statementData.success).toBe(true);
    expect(statementData.statement.verified).toBe(true);
    expect(statementData.statement.unverifiedTokens).toHaveLength(0);
    expect(statementData.statement.prose).toContain('$52.57');

    // -------------------------------------------------------------
    // Step 9: Verify Cryptographic Audit Chain Continuity (GET /api/deals/:id/ledger)
    // -------------------------------------------------------------
    const ledgerRes = await app.request(`/api/deals/${demoDealId}/ledger`);
    expect(ledgerRes.status).toBe(200);
    const ledgerData = await ledgerRes.json();
    expect(ledgerData.success).toBe(true);
    expect(ledgerData.sales).toHaveLength(1);
    expect(ledgerData.auditLog.length).toBeGreaterThanOrEqual(4);
    expect(ledgerData.auditVerification.valid).toBe(true);
    expect(ledgerData.auditVerification.headHash).toBeDefined();

    // -------------------------------------------------------------
    // Step 10: Verify Kill Switch Halts Payouts
    // -------------------------------------------------------------
    await app.request('/api/system/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: true }),
    });

    const pausedCaptureRes = await app.request('/api/checkout/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: demoDealId,
        grossCents: 10000,
      }),
    });

    expect(pausedCaptureRes.status).toBe(403);
    const pausedData = await pausedCaptureRes.json();
    expect(pausedData.halted).toBe(true);
    expect(pausedData.reason).toBe('PAYOUTS_PAUSED_BY_KILL_SWITCH');
  });
});
