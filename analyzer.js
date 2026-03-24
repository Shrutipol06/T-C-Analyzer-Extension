// ============================================================
// analyzer.js — Core analysis engine (shared by popup & background)
// Deterministic scoring + hash-based caching = consistent results
// ============================================================

// ── Category & Severity weights ──────────────────────────────
const CATEGORY_WEIGHTS = {
  "Data Privacy": 0.30,
  "Financial":    0.25,
  "User Rights":  0.20,
  "Legal":        0.15,
  "IP":           0.10,
  "Safe":         0
};

const SEVERITY_WEIGHTS = {
  "Low":    0.3,
  "Medium": 0.6,
  "High":   1.0
};

// ── Rule-based detection (deterministic, always consistent) ──
const RULES = [
  // Data Privacy
  { pattern: /\b(sell|selling|sold)\s+(your\s+)?(personal\s+)?data\b/gi,         category: "Data Privacy", severity: "High",   impact: 0.9, label: "Data Selling" },
  { pattern: /\bshare[sd]?\s+(your\s+)?(personal\s+)?data\b/gi,                  category: "Data Privacy", severity: "High",   impact: 0.85, label: "Data Sharing" },
  { pattern: /\bthird[- ]party\s+(sharing|access|disclosure)\b/gi,               category: "Data Privacy", severity: "High",   impact: 0.85, label: "Third-Party Data Sharing" },
  { pattern: /\btrack(ing|ed)?\s+(your\s+)?(location|activity|behavior)\b/gi,    category: "Data Privacy", severity: "High",   impact: 0.8,  label: "Location/Activity Tracking" },
  { pattern: /\bcollect[sd]?\s+(your\s+)?(personal|biometric|sensitive)\b/gi,    category: "Data Privacy", severity: "Medium", impact: 0.65, label: "Personal Data Collection" },
  { pattern: /\bfacial\s+recognition\b/gi,                                        category: "Data Privacy", severity: "High",   impact: 0.9,  label: "Facial Recognition" },
  { pattern: /\bcookie[sd]?\s+(tracking|policy|consent)\b/gi,                    category: "Data Privacy", severity: "Low",    impact: 0.3,  label: "Cookie Tracking" },
  { pattern: /\bdata\s+retention\b/gi,                                            category: "Data Privacy", severity: "Low",    impact: 0.25, label: "Data Retention" },

  // Financial
  { pattern: /\bauto[- ]?renew(al|s|ing)?\b/gi,                                  category: "Financial", severity: "High",   impact: 0.85, label: "Auto-Renewal" },
  { pattern: /\bnon[- ]?refundable\b/gi,                                          category: "Financial", severity: "High",   impact: 0.8,  label: "No Refund Policy" },
  { pattern: /\bno\s+refund(s)?\b/gi,                                             category: "Financial", severity: "High",   impact: 0.8,  label: "No Refund" },
  { pattern: /\bcharg(e|ed|ing)\s+(without\s+notice|automatically)\b/gi,          category: "Financial", severity: "High",   impact: 0.9,  label: "Automatic Charges" },
  { pattern: /\bprice\s+(change|increase|modification)\b/gi,                      category: "Financial", severity: "Medium", impact: 0.55, label: "Price Changes" },
  { pattern: /\bcancell?ation\s+fee\b/gi,                                         category: "Financial", severity: "Medium", impact: 0.6,  label: "Cancellation Fee" },
  { pattern: /\bhidden\s+(fee|charge|cost)\b/gi,                                  category: "Financial", severity: "High",   impact: 0.85, label: "Hidden Fees" },
  { pattern: /\bsubscription\s+(auto|automatically)\b/gi,                         category: "Financial", severity: "Medium", impact: 0.55, label: "Auto-Subscription" },

  // User Rights
  { pattern: /\bwaive[sd]?\s+(your\s+)?(right|rights|claim)\b/gi,                category: "User Rights", severity: "High",   impact: 0.9,  label: "Rights Waiver" },
  { pattern: /\bclass\s+action\s+waiver\b/gi,                                     category: "User Rights", severity: "High",   impact: 0.95, label: "Class Action Waiver" },
  { pattern: /\bmandatory\s+arbitration\b/gi,                                     category: "User Rights", severity: "High",   impact: 0.9,  label: "Mandatory Arbitration" },
  { pattern: /\blimit(ed|ing|s)?\s+(your\s+)?liabilit/gi,                         category: "User Rights", severity: "Medium", impact: 0.6,  label: "Liability Limitation" },
  { pattern: /\bterminate\s+(your\s+)?(account|access|service)\s+at\s+(any\s+time|our\s+discretion)\b/gi, category: "User Rights", severity: "Medium", impact: 0.65, label: "Unilateral Termination" },
  { pattern: /\bmodif(y|ied|ication)\s+(terms|agreement|policy)\s+at\s+(any\s+time|our\s+discretion)\b/gi, category: "User Rights", severity: "Medium", impact: 0.6,  label: "Unilateral Terms Change" },

  // Legal
  { pattern: /\bgoverning\s+law\b|\bjurisdiction\b/gi,                            category: "Legal", severity: "Low",    impact: 0.3,  label: "Jurisdiction Clause" },
  { pattern: /\bindemnif(y|ication|ied)\b/gi,                                     category: "Legal", severity: "High",   impact: 0.85, label: "Indemnification Clause" },
  { pattern: /\bdisclaim(er|s)?\s+(of\s+)?warrant/gi,                             category: "Legal", severity: "Medium", impact: 0.55, label: "Warranty Disclaimer" },
  { pattern: /\bforce\s+majeure\b/gi,                                              category: "Legal", severity: "Low",    impact: 0.25, label: "Force Majeure" },

  // IP
  { pattern: /\b(grant|grants|granting)\s+(us|company|we)\s+(a\s+)?(worldwide|perpetual|irrevocable|royalty[- ]free)\b/gi, category: "IP", severity: "High",   impact: 0.85, label: "Broad IP License Grant" },
  { pattern: /\bown(s|ership)?\s+(all\s+)?(content|intellectual\s+property|IP)\s+(you\s+)?(submit|upload|create)\b/gi,    category: "IP", severity: "High",   impact: 0.9,  label: "IP Ownership Transfer" },
  { pattern: /\blicense\s+to\s+use\s+your\s+content\b/gi,                         category: "IP", severity: "Medium", impact: 0.55, label: "Content License" },

  // Extended Data Privacy Rules
  { pattern: /\b(will\s+not|will\s+never|does\s+not|do\s+not|cannot)\s+(be\s+)?(sell|sold|share|shared|disclosed|transfer)\s+.*?(data|information|personal)\b/gi, category: "Data Privacy", severity: "Low", impact: 0.0, label: "No Data Sharing Clause (Safe)" },
  { pattern: /\b(will\s+not|will\s+never|do\s+not|does\s+not)\s+track.*?(activity|behavior|location|browsing)\b/gi, category: "Data Privacy", severity: "Low", impact: 0.0, label: "No Tracking Clause (Safe)" },
  { pattern: /\bnever.*?(share|sell|disclose).*?(personal|customer)\s+data\b/gi, category: "Data Privacy", severity: "Low", impact: 0.0, label: "Never Share Data (Safe)" },
  { pattern: /\bdata.*?(will\s+not|is\s+not)\s+(used|shared|sold)\b/gi, category: "Data Privacy", severity: "Low", impact: 0.0, label: "Data Not Used/Shared (Safe)" },
  { pattern: /\bbrowsing\s+behavior.*?across\s+.*(site|website|page)\b/gi, category: "Data Privacy", severity: "High", impact: 0.8, label: "Cross-Site Tracking" },
  { pattern: /\blocation\s+data.*?share.*?(partner|marketing|affiliate)\b/gi, category: "Data Privacy", severity: "High", impact: 0.85, label: "Location Data Sharing" },
  { pattern: /\baffiliate(s)?\s+(marketing|partner|program)\b/gi, category: "Data Privacy", severity: "High", impact: 0.75, label: "Affiliate Data Sharing" },

  // Extended Financial/Refund Rules
  { pattern: /\b(all|every)\s+purchase.*?non[- ]refundable\b/gi, category: "Financial", severity: "High", impact: 0.9, label: "All Purchases Non-Refundable" },
  { pattern: /\brefund.*?(available|allowed).*?(\d+)\s+(days?|weeks?|months?)\b/gi, category: "Financial", severity: "Low", impact: 0.2, label: "Refund Window Available (Safe)" },
  { pattern: /\blate\s+payment.*?(\d+)%.*?(interest|charge|fee)\b/gi, category: "Financial", severity: "High", impact: 0.85, label: "Late Payment Penalty" },
  { pattern: /\brestocking\s+fee\b/gi, category: "Financial", severity: "High", impact: 0.75, label: "Restocking Fee" },
  { pattern: /\bdo\s+not\s+charge\s+(hidden|undisclosed|surprise)\s+(fee|charge|cost)\b/gi, category: "Financial", severity: "Low", impact: 0.0, label: "No Hidden Fees (Safe)" },
  { pattern: /\bno\s+(additional|extra|hidden).*?(fee|charge|cost)\b/gi, category: "Financial", severity: "Low", impact: 0.0, label: "No Hidden Charges (Safe)" },

  // Extended Cancellation Rules
  { pattern: /\b(cannot|can't|unable\s+to|no\s+ability)\s+cancel.*?subscription\b/gi, category: "Financial", severity: "High", impact: 0.95, label: "No Cancellation Option" },
  { pattern: /\bcancel.*?(anytime|at\s+any\s+time).*?(without|no)\s+(penalty|fee)\b/gi, category: "Financial", severity: "Low", impact: 0.0, label: "Cancel Anytime No Penalty (Safe)" },
  { pattern: /\bto\s+cancel.*?(\d+)\s+(days?)\s+without\s+(penalty|fee)\b/gi, category: "Financial", severity: "Low", impact: 0.1, label: "Grace Period For Cancellation (Safe)" },
  { pattern: /\nearly\s+cancell?ation.*?\$?\d+\s+(fee|penalty)\b/gi, category: "Financial", severity: "High", impact: 0.75, label: "Early Termination Fee" },

  // Extended User Rights Rules
  { pattern: /\b(reserve\s+the\s+right\s+to)?\s*terminate.*?(account|access|service).*?(without\s+notice|immediately)\b/gi, category: "User Rights", severity: "High", impact: 0.9, label: "Unilateral Account Termination" },
  { pattern: /\bmodif(y|ied|ication)\s+(terms|agreement).*?(without\s+notification|without\s+notice)\b/gi, category: "User Rights", severity: "High", impact: 0.85, label: "Unilateral Terms Modification" },
  { pattern: /\barbitration\s+(clause|agreement|agreement).*?waive.*?right.*?sue\b/gi, category: "User Rights", severity: "High", impact: 0.95, label: "Mandatory Arbitration with Legal Waiver" },
  { pattern: /\b(we|company|us)\s+(reserve\s+)?right.*?access.*?account.*?(any\s+time|for\s+any\s+reason)\b/gi, category: "User Rights", severity: "High", impact: 0.9, label: "Unrestricted Account Access" },
  { pattern: /\b(assume|accept)\s+(all\s+)?(risk|liability|responsibility).*?(loss|damage|access)\b/gi, category: "User Rights", severity: "High", impact: 0.85, label: "User Assumes All Risk" },
  { pattern: /\bnot\s+(liable|held\s+liable|responsible).*?damage.*?your\s+service\b/gi, category: "User Rights", severity: "High", impact: 0.85, label: "Liability Disclaimer" },

  // Extended Liability Rules
  { pattern: /\b(we|company|us)\s+(are\s+)?(responsible|accountable|liable).*?all\s+loss\b/gi, category: "Legal", severity: "Low", impact: 0.0, label: "Company Accepts Liability (Safe)" },
  { pattern: /\b(cannot|is\s+not)\s+(held\s+)?(liable|responsible)\s+for\s+third[- ]party\b/gi, category: "Legal", severity: "High", impact: 0.8, label: "No Liability For Third-Party Content" }
];

// ── Deterministic hash (same text → same hash always) ────────
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// ── Rule-based analysis (100% deterministic) ─────────────────
function ruleBasedAnalysis(text) {
  const foundClauses = [];
  const seen = new Set();

  RULES.forEach(rule => {
    const matches = [...text.matchAll(rule.pattern)];
    matches.forEach(match => {
      const matchText = match[0].trim();
      const key = rule.label + "|" + matchText.toLowerCase().slice(0, 60);
      if (seen.has(key)) return;
      seen.add(key);

      // Extract sentence more accurately
      const sentence = extractSentenceFromIndex(text, match.index, matchText.length);
      const sentiment = detectSentiment(sentence);

      // Only flag if sentiment is negative (less than 0.5)
      // or if it's a high-priority category rule (Data Privacy/Financial often have neutral language but high risk)
      const isRisky = sentiment < 0.5 || ["Data Privacy", "Financial"].includes(rule.category);

      if (isRisky) {
        foundClauses.push({
          id:              key,
          text:            sentence.slice(0, 300),
          matchText:       matchText,
          label:           rule.label,
          category:        rule.category,
          severity:        rule.severity,
          impact:          rule.impact,
          confidence:      0.85,
          sentiment_score: sentiment
        });
      }
    });
  });

  return foundClauses;
}

function extractSentenceFromIndex(text, matchIndex, matchLength) {
  // Find sentence start (previous . ! ? followed by space, or start of file)
  let start = matchIndex;
  while (start > 0) {
    if (/[.!?]\s/.test(text.slice(start - 2, start))) break;
    start--;
  }
  // Skip leading whitespace/newlines
  while (start < matchIndex && /\s/.test(text[start])) start++;

  // Find sentence end (. ! ? followed by space, or end of file)
  let end = matchIndex + matchLength;
  while (end < text.length) {
    if (/[.!?](\s|$)/.test(text.slice(end, end + 2))) {
      end += 1; // include the punctuation
      break;
    }
    end++;
  }
  return text.slice(start, end).trim();
}

function detectSentiment(sentence) {
  const lower = sentence.toLowerCase();
  // Negative keywords/patterns
  const neg = ['not', 'never', 'don\'t', 'won\'t', 'cannot', 'refuse', 'fail', 'no ', 'none', 'disclaim', 'waive', 'terminate', 'suspend', 'limit', 'restrict', 'forfeit', 'sell', 'share', 'transfer', 'exclude', 'penalty', 'fine', 'fee', 'arbitration', 'waiver'];
  // Positive/Permissive keywords
  const pos = ['allow', 'permit', 'enable', 'can', 'may', 'request', 'choice', 'opt-in', 'consent', 'agree', 'welcome', 'benefit'];

  let score = 0.5; // Neutral start
  neg.forEach(w => { if (lower.includes(w)) score -= 0.08; });
  pos.forEach(w => { if (lower.includes(w)) score += 0.08; });

  return Math.max(0.05, Math.min(0.95, score));
}

// ── Simple keyword matching for User Rules (fallback) ────────
function matchUserRules(text, userRules) {
  if (!userRules || userRules.length === 0) return [];
  const detected = [];
  userRules.forEach(rule => {
    // Basic keyword extraction: split rule into words, filter out common ones
    const keywords = rule.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    if (keywords.length === 0) return;

    // Check if any keyword matches
    const firstMatch = keywords.find(kw => text.toLowerCase().includes(kw));
    if (firstMatch) {
      const idx = text.toLowerCase().indexOf(firstMatch);
      const sentence = extractSentenceFromIndex(text, idx, firstMatch.length);
      const sentiment = detectSentiment(sentence);

      // Only flag if sentiment is negative (less than 0.5)
      if (sentiment < 0.5) {
        detected.push({
          rule: rule,
          text: sentence.slice(0, 300),
          reason: `Matched via keyword/sentiment analysis (Sentiment: ${sentiment.toFixed(2)})`
        });
      }
    }
  });
  return detected;
}

// ── Deterministic score calculation ──────────────────────────
function calculateScore(clauses) {
  if (!clauses || clauses.length === 0) return 0;

  let totalRisk = 0;
  clauses.forEach(c => {
    const wc              = CATEGORY_WEIGHTS[c.category] || 0;
    const ws              = SEVERITY_WEIGHTS[c.severity] || 0;
    const impact          = c.impact || 0;
    const confidence      = c.confidence || 0;
    const sentimentFactor = 1 - (c.sentiment_score || 0.5);
    const clauseRisk      = wc * ws * impact * confidence * sentimentFactor;
    totalRisk += clauseRisk;
  });

  // Normalize: cap at 5 clauses worth of max risk to scale 0–100
  const maxPossible = 5 * (0.30 * 1.0 * 1.0 * 1.0 * 1.0);
  const finalScore  = (totalRisk / maxPossible) * 100;
  return Math.min(Math.round(finalScore), 100);
}

// ── Page text extraction (clean) ─────────────────────────────
function extractPageText() {
  const selectors = [
    'main', 'article', '[class*="terms"]', '[class*="policy"]',
    '[class*="privacy"]', '[id*="terms"]', '[id*="policy"]',
    '[class*="content"]', 'body'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > 500) return text.trim();
    }
  }
  return document.body.innerText || '';
}

// ── Split into chunks ─────────────────────────────────────────
function chunkText(text, chunkSize = 3000) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ── Export for use in other files ────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { ruleBasedAnalysis, calculateScore, hashText, chunkText, extractPageText, CATEGORY_WEIGHTS, SEVERITY_WEIGHTS, matchUserRules };
}
