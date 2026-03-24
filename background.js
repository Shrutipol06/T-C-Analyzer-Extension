// ============================================================
// background.js — Service Worker
// Handles: AI analysis (Gemini Nano / Chrome AI), caching,
//          network detection, fallback to rule-based engine
// ============================================================

importScripts('analyzer.js');

// ── In-memory cache: hash → result (consistent across scans) ─
const analysisCache = new Map();

// ── Listen for messages from popup ───────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE') {
    handleAnalysis(msg.text, msg.url)
      .then(result => sendResponse({ success: true, result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (msg.type === 'CHECK_NETWORK') {
    checkNetwork().then(online => sendResponse({ online }));
    return true;
  }
});

// ── Main analysis handler ─────────────────────────────────────
async function handleAnalysis(text, url) {
  // 1. Hash the text content (deterministic — same text = same hash)
  const cacheKey = hashText(text.slice(0, 5000)); // first 5000 chars for hash

  // 1. Get user rules first
  let userRules = [];
  try {
    const data = await chrome.storage.local.get('userRules');
    userRules = data.userRules || [];
  } catch {}

  // 2. Return cached result if available (only if no user rules to check)
  if (analysisCache.has(cacheKey) && userRules.length === 0) {
    console.log('[TC Analyzer] Cache hit — returning consistent result');
    return { ...analysisCache.get(cacheKey), fromCache: true };
  }

  // 3. Check network
  const isOnline = await checkNetwork();
  let clauses = [];
  let userRulesDetected = [];
  let method  = 'rule-based';

  if (isOnline) {
    try {
      console.log('[TC Analyzer] Online — trying Chrome AI with rules:', userRules);
      // 5a. Try Chrome's built-in AI (Gemini Nano — no API key needed)
      const aiResult = await analyzeWithChromeAI(text, userRules);
      clauses = aiResult.clauses;
      userRulesDetected = aiResult.userRules;
      method  = 'chrome-ai';
      console.log('[TC Analyzer] AI response user rules detected:', userRulesDetected.length);
    } catch (e) {
      console.warn('[TC Analyzer] Chrome AI unavailable, using rule-based:', e.message);
      clauses = ruleBasedAnalysis(text);
      userRulesDetected = matchUserRules(text, userRules);
      method  = 'rule-based-fallback';
    }
  } else {
    // 5b. Offline — rule-based only
    console.log('[TC Analyzer] Offline — using rule-based fallback');
    clauses = ruleBasedAnalysis(text);
    userRulesDetected = matchUserRules(text, userRules);
    method  = 'rule-based-offline';
  }

  // 5. Always supplement with rule-based to catch anything AI missed
  if (method === 'chrome-ai') {
    const ruleResults = ruleBasedAnalysis(text);
    // Merge: add rule-based clauses not already found by AI
    const aiLabels = new Set(clauses.map(c => c.label?.toLowerCase()));
    ruleResults.forEach(rc => {
      if (!aiLabels.has(rc.label?.toLowerCase())) {
        clauses.push(rc);
      }
    });
  }

  // 6. Calculate deterministic score
  const score    = calculateScore(clauses);
  const pageCount = estimatePageCount(text);

  const result = {
    clauses,
    score,
    pageCount,
    method,
    userRulesDetected,
    timestamp: Date.now(),
    cacheKey
  };

  // 7. Cache it — same URL scan = same result
  analysisCache.set(cacheKey, result);

  return result;
}

// ── Chrome Built-in AI (Gemini Nano) — zero API key ──────────
async function analyzeWithChromeAI(text, userRules = []) {
  // Check if Chrome AI is available
  if (!('ai' in self) && !('chrome' in self && 'aiOriginTrial' in (self.chrome || {}))) {
    throw new Error('Chrome AI not available');
  }

  const aiAPI = self.ai || self.chrome?.aiOriginTrial;
  if (!aiAPI?.languageModel) throw new Error('Language model API not available');

  const capabilities = await aiAPI.languageModel.capabilities();
  if (capabilities.available === 'no') throw new Error('AI model not downloaded');

  const session = await aiAPI.languageModel.create({
    systemPrompt: buildSystemPrompt(userRules)
  });

  const chunks   = chunkText(text, 2000);
  const allClauses = [];
  const allUserRules = [];

  for (const chunk of chunks.slice(0, 5)) { // max 5 chunks
    try {
      let userRulePrompt = '';
      if (userRules.length > 0) {
        userRulePrompt = `\nAlso check for these specific USER RULES: ${JSON.stringify(userRules)}. ` +
          `If any match the content (even semantically), include them in a "user_rules" array in your JSON response. ` +
          `Each user_rule match: {rule: "original rule", text: "matching snippet", reason: "why it matches"}.`;
      }

      const response = await session.prompt(
        `Analyze these Terms & Conditions and return ONLY a JSON object. ` +
        `Structure: { "clauses": [...], "user_rules": [...] }. ` +
        `Each standard clause: {label, text, category, severity, impact, confidence, sentiment_score}. ` +
        `Categories: Data Privacy, Financial, User Rights, Legal, IP. ` +
        `Severity: High/Medium/Low. impact/confidence: 0-1. sentiment_score: 0=negative 1=positive. ` +
        `${userRulePrompt} ` +
        `If nothing found return empty arrays. ONLY JSON.\n\n${chunk}`
      );

      const parsed = safeParseJSON(response);
      if (parsed.clauses && Array.isArray(parsed.clauses)) {
        allClauses.push(...parsed.clauses.map(normalizeClause));
      }
      if (parsed.user_rules && Array.isArray(parsed.user_rules)) {
        allUserRules.push(...parsed.user_rules);
      }
    } catch (e) {
      console.warn('[TC Analyzer] AI chunk error:', e.message);
    }
  }

  session.destroy();
  return {
    clauses: deduplicateClauses(allClauses),
    userRules: allUserRules // Deduplicate if needed
  };
}

// ── Helpers ───────────────────────────────────────────────────
function buildSystemPrompt(userRules = []) {
  let prompt = `You are a legal clause risk analyzer. Analyze text and identify risky clauses.
CRITICAL: Use sentiment analysis to determine risk. A clause is risky if it has a NEGATIVE sentiment for the user (restrictive, rights-waiving, or penalizing).
Always respond with ONLY a valid JSON object — no markdown, no explanation.
Be consistent: the same text must always produce the same output.
Categories: Data Privacy, Financial, User Rights, Legal, IP.
Severity: High (major risk), Medium (moderate risk), Low (minor risk).
impact: 0.0-1.0 (how harmful), confidence: 0.0-1.0 (how certain), sentiment_score: 0.0-1.0 (0=very negative).`;

  if (userRules.length > 0) {
    prompt += `\n\nAdditionally, the user has defined these specific rules to watch for: ${JSON.stringify(userRules)}. ` +
      `For each match, explain why the sentiment or meaning is negative/risky for the user.`;
  }
  return prompt;
}

function normalizeClause(c) {
  return {
    id:              hashText((c.text || c.label || '') + (c.category || '')),
    label:           c.label           || 'Unnamed Clause',
    text:            (c.text           || '').slice(0, 300),
    matchText:       c.matchText       || c.text?.slice(0, 80) || '',
    category:        c.category        || 'Legal',
    severity:        ['High','Medium','Low'].includes(c.severity) ? c.severity : 'Medium',
    impact:          clamp(parseFloat(c.impact)          || 0.5),
    confidence:      clamp(parseFloat(c.confidence)      || 0.7),
    sentiment_score: clamp(parseFloat(c.sentiment_score) || 0.3)
  };
}

function clamp(v, min=0, max=1) { return Math.max(min, Math.min(max, v)); }

function safeParseJSON(text) {
  try {
    // Look for JSON object first
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    // Fallback to array match for legacy support
    const arrMatch = text.match(/\[[\s\S]*\]/);
    return arrMatch ? { clauses: JSON.parse(arrMatch[0]), user_rules: [] } : { clauses: [], user_rules: [] };
  } catch { return { clauses: [], user_rules: [] }; }
}

function deduplicateClauses(clauses) {
  const seen = new Set();
  return clauses.filter(c => {
    const key = (c.label + c.category).toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function estimatePageCount(text) {
  const wordsPerPage = 500;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / wordsPerPage));
}

async function checkNetwork() {
  try {
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store',
      signal: AbortSignal.timeout(3000)
    });
    return true;
  } catch { return false; }
}
