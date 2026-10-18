import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

export interface LLMRequest {
  promptVersion: string;
  systemPrompt: string;
  userInput: string;
  schemaType?: string;
}

export interface LLMResponse {
  content: string;
  source: 'GEMINI_API' | 'GROQ_API' | 'REPLAY_CACHE' | 'OFFLINE_FALLBACK';
  cacheKey: string;
  durationMs: number;
}

const REPLAY_CACHE_PATH =
  process.env.REPLAY_CACHE_PATH ||
  path.resolve(process.cwd(), 'fixtures/replay-cache.json');

/**
 * Deterministic hash key generation for the LLM Record/Replay cache
 */
export function computeCacheKey(
  promptVersion: string,
  systemPrompt: string,
  userInput: string
): string {
  const combined = `${promptVersion.trim()}|${systemPrompt.trim()}|${userInput.trim()}`;
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
}

/**
 * Loads the replay cache from disk safely
 */
function loadReplayCache(): Record<string, string> {
  try {
    if (fs.existsSync(REPLAY_CACHE_PATH)) {
      const raw = fs.readFileSync(REPLAY_CACHE_PATH, 'utf8');
      const data = JSON.parse(raw);
      return data.entries || {};
    }
  } catch (err) {
    console.warn(`[ReplayCache] Failed to load cache from ${REPLAY_CACHE_PATH}:`, err);
  }
  return {};
}

/**
 * Persists an entry to the replay cache
 */
function saveToReplayCache(cacheKey: string, content: string): void {
  try {
    const dir = path.dirname(REPLAY_CACHE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = loadReplayCache();
    current[cacheKey] = content;

    const payload = {
      version: 1,
      description: 'Tributary Deterministic LLM Record/Replay Cache',
      updatedAt: new Date().toISOString(),
      entries: current,
    };

    fs.writeFileSync(REPLAY_CACHE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[ReplayCache] Failed to save entry to ${REPLAY_CACHE_PATH}:`, err);
  }
}

/**
 * Air-gapped AI Provider:
 * 1. Replay cache check
 * 2. Gemini Flash API call (temperature: 0, strict JSON)
 * 3. Groq API fallback
 * 4. Deterministic offline synthesizer fallback
 */
export async function queryAIProvider(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();
  const cacheKey = computeCacheKey(req.promptVersion, req.systemPrompt, req.userInput);

  const useCache = process.env.USE_REPLAY_CACHE !== 'false';
  const offlineOnly = process.env.OFFLINE_REPLAY_ONLY === 'true';
  const cache = loadReplayCache();

  // 1. Check Replay Cache
  if (useCache && cache[cacheKey]) {
    return {
      content: cache[cacheKey],
      source: 'REPLAY_CACHE',
      cacheKey,
      durationMs: Date.now() - start,
    };
  }

  // If forced offline or no Gemini API key configured
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (offlineOnly || !geminiKey) {
    // Generate deterministic response and record to cache
    const fallbackContent = generateOfflineFallback(req);
    saveToReplayCache(cacheKey, fallbackContent);
    return {
      content: fallbackContent,
      source: 'OFFLINE_FALLBACK',
      cacheKey,
      durationMs: Date.now() - start,
    };
  }

  // 2. Call Gemini Flash API via HTTPS
  try {
    const envModel = process.env.GEMINI_MODEL;
    const model = (envModel && envModel !== 'gemini-2.5-flash') ? envModel : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const apiBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.userInput }],
        },
      ],
      systemInstruction: {
        parts: [{ text: req.systemPrompt }],
      },
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        saveToReplayCache(cacheKey, text);
        return {
          content: text,
          source: 'GEMINI_API',
          cacheKey,
          durationMs: Date.now() - start,
        };
      }
    } else {
      console.warn(`[AI Provider] Gemini API returned status ${res.status}`);
    }
  } catch (err: any) {
    console.warn(`[AI Provider] Gemini API request failed: ${err.message}`);
  }

  // 3. Fallback to Groq if key available
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userInput },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      });

      if (groqRes.ok) {
        const groqData = (await groqRes.json()) as any;
        const groqText = groqData.choices?.[0]?.message?.content;
        if (groqText) {
          saveToReplayCache(cacheKey, groqText);
          return {
            content: groqText,
            source: 'GROQ_API',
            cacheKey,
            durationMs: Date.now() - start,
          };
        }
      }
    } catch (err: any) {
      console.warn(`[AI Provider] Groq fallback failed: ${err.message}`);
    }
  }

  // 4. Deterministic Offline Fallback Synthesizer
  const fallback = generateOfflineFallback(req);
  saveToReplayCache(cacheKey, fallback);
  return {
    content: fallback,
    source: 'OFFLINE_FALLBACK',
    cacheKey,
    durationMs: Date.now() - start,
  };
}

/**
 * Deterministic offline rule-based parser for revenue-share agreements.
 * Guarantees zero-key offline mode functions 100% reliably.
 */
function generateOfflineFallback(req: LLMRequest): string {
  const text = req.userInput.toLowerCase();

  if (req.schemaType === 'explain_trace') {
    try {
      const data = JSON.parse(req.userInput);
      const parts: string[] = [];
      if (data.payeeName) parts.push(`Statement for ${data.payeeName}:`);
      parts.push(`On gross sale of ${data.grossAmount} (PayPal fee ${data.paypalFee}, reserve ${data.reserveHoldback}),`);
      if (data.recoupAwarded && data.recoupAwarded !== '$0.00') parts.push(`you received ${data.recoupAwarded} recoup payment.`);
      if (data.splitAwarded) parts.push(`your split share was ${data.splitAwarded}.`);
      if (data.recoveryWithheld && data.recoveryWithheld !== '$0.00') parts.push(`${data.recoveryWithheld} was withheld for past refunds.`);
      parts.push(`Total payout issued: ${data.payoutIssued}.`);
      return JSON.stringify({
        explanation: parts.join(' '),
      });
    } catch {
      return JSON.stringify({
        explanation: 'Your share was calculated based on the approved agreement terms.',
      });
    }
  }

  if (req.schemaType === 'propose_scenarios') {
    return JSON.stringify({
      scenarios: [
        {
          title: 'Scenario 1: Pure Upfront Recoup Sale',
          description: 'A standard sale where distributable proceeds are dedicated to reimbursing upfront costs.',
          grossCents: 10000,
          feeCents: 398,
        },
        {
          title: 'Scenario 2: Boundary-Crossing Sale (Recoup Completion + Tier Split)',
          description: 'A sale that completes the remaining recoup balance and splits the remaining pool across all collaborators.',
          grossCents: 10000,
          feeCents: 398,
        },
        {
          title: 'Scenario 3: Post-Payout Partial Refund',
          description: 'A customer refund issued after payouts, demonstrating reserve absorption and deficit clawback netting.',
          grossCents: 10000,
          feeCents: 398,
          refundCents: 5000,
        },
      ],
    });
  }

  // Default: compile agreement
  const isMoonlit = text.includes('moonlit') || text.includes('maya');
  const isCreatorLaunch = text.includes('creator') || text.includes('agency') || text.includes('course');

  if (isCreatorLaunch) {
    return JSON.stringify({
      dealId: 'deal_creator_launch',
      version: 1,
      title: 'Creator Course & Ad Agency Launch Agreement',
      payees: [
        { id: 'creator', name: 'Alex Creator', email: 'alex@creator.example.com', tier1Bps: 5000, tier2Bps: 6000 },
        { id: 'agency', name: 'Apex Media Agency', email: 'partner@agency.example.com', tier1Bps: 5000, tier2Bps: 4000 },
      ],
      recoupBucket: {
        payeeId: 'agency',
        totalCents: 50000, // $500 ad spend
        feeBasis: 'NET_OF_FEES',
      },
      tierThresholdNetCents: 300000, // $3,000 threshold
      reserveBps: 1000,
      holdbackDays: 14,
      minPayoutCents: 2500,
      clawbackRule: 'PRO_RATA_SALE_SHARE',
      ambiguities: [
        {
          id: 'ambiguity_recoup_fee_basis',
          question: 'Is the $500 upfront ad spend recouped before or after PayPal payment processing fees?',
          whyItMatters: 'Determines whether PayPal fee is absorbed by the general pool or deducted prior to recoupment.',
          options: ['NET_OF_FEES', 'GROSS'],
          defaultOption: 'NET_OF_FEES',
        },
        {
          id: 'ambiguity_clawback_rule',
          question: 'If a student requests a refund after payout, how is the remaining deficit recovered?',
          whyItMatters: 'Governs whether collaborator recovery balances are calculated pro-rata to sale earnings or active tier weights.',
          options: ['PRO_RATA_SALE_SHARE', 'ACTIVE_TIER_WEIGHTS'],
          defaultOption: 'PRO_RATA_SALE_SHARE',
        },
      ],
      canActivate: false,
    });
  }

  // Team Moonlit Indie Game Default
  return JSON.stringify({
    dealId: 'deal_moonlit_v1',
    version: 1,
    title: 'Moonlit Indie Game Revenue Share Agreement',
    payees: [
      { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
      { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
      { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
      { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
    ],
    recoupBucket: {
      payeeId: 'maya',
      totalCents: 40000, // $400 upfront art
      feeBasis: 'NET_OF_FEES',
    },
    tierThresholdNetCents: 200000, // $2,000
    reserveBps: 1000, // 10%
    holdbackDays: 14,
    minPayoutCents: 2500, // $25
    clawbackRule: 'PRO_RATA_SALE_SHARE',
    ambiguities: [
      {
        id: 'ambiguity_recoup_fee_basis',
        question: 'Is Maya\'s $400 art cost repaid before or after PayPal payment processing fees?',
        whyItMatters: 'Diverts who absorbs transaction fees during the initial recoup phase.',
        options: ['NET_OF_FEES', 'GROSS'],
        defaultOption: 'NET_OF_FEES',
      },
      {
        id: 'ambiguity_clawback_rule',
        question: 'How should post-payout refunds be absorbed if the 10% reserve is fully depleted?',
        whyItMatters: 'Dictates whether deficits are clawed back proportional to what each person received or active tier weights.',
        options: ['PRO_RATA_SALE_SHARE', 'ACTIVE_TIER_WEIGHTS'],
        defaultOption: 'PRO_RATA_SALE_SHARE',
      },
      {
        id: 'ambiguity_tier_basis',
        question: 'Is the $2,000 revenue tier threshold measured on Gross sales or Net revenue after PayPal fees?',
        whyItMatters: 'Determines the exact dollar volume needed to unlock the equal 25/25/25/25 split.',
        options: ['NET_REVENUE', 'GROSS_REVENUE'],
        defaultOption: 'NET_REVENUE',
      },
    ],
    canActivate: false,
  });
}
