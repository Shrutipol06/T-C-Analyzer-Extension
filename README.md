# 🛡️ T&C Risk Analyzer — Chrome Extension v2.0

## What Changed from v1

### ✅ Problem 1: Inconsistent Risk Scores — FIXED
**Root cause:** Gemini API (and any LLM) is non-deterministic by nature — same input gives
different output each call. This caused different scores on every scan.

**Fix applied — three-layer solution:**
1. **Hash-based caching** — Text is hashed deterministically. Same page = same hash = same
   cached result. Scan the same page 100 times: same score every time.
2. **Rule-based engine as backbone** — All rules use regex matching, which is 100%
   deterministic. Same text → same clauses → same score. Always.
3. **Deterministic score formula** — The `calculateScore()` function is pure math with no
   randomness. Given the same array of clauses, it always returns the same number.

### ✅ Problem 2: API Key Exposure — FIXED (+ Cost Eliminated)
**Old approach:** Gemini API key stored in `.env` on backend server.

**New approach: Chrome's Built-in AI (Gemini Nano)**
- Runs **locally in the browser** — no server needed, no API key, no cost
- Uses `window.ai.languageModel` — Chrome's native AI API
- If unavailable, seamlessly falls back to rule-based detection

No backend server required at all in v2.

---

## Architecture

```
User clicks Scan
      │
      ▼
content.js → extracts page text
      │
      ▼
background.js → hash text → check cache
      │                         │
      │ cache miss              │ cache hit → return same result
      ▼
Check network
      │
  ┌───┴───┐
  │       │
online  offline
  │       │
  ▼       ▼
Chrome  Rule-based
  AI    detection
  │       │
  └───┬───┘
      │ merge results
      ▼
calculateScore() ← deterministic formula
      │
      ▼
Cache result (hash → result)
      │
      ▼
content.js → highlight clauses on page
      │
      ▼
popup.js → display score, clauses, summary
```

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) |
| `analyzer.js` | Core: rules, scoring formula, text chunking |
| `background.js` | Service worker: AI calls, caching, network check |
| `content.js` | Page: text extraction + DOM highlighting |
| `popup.html` | Extension popup UI |
| `popup.js` | UI logic: tabs, rendering, scan coordination |

---

## Setup

### Install in Chrome (Developer Mode)
1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder
5. Click the extension icon on any T&C page → Scan

### Enable Chrome AI (Optional — for AI mode)
1. Open `chrome://flags/#optimization-guide-on-device-model`
2. Set to **Enabled BypassPerfRequirement**
3. Open `chrome://flags/#prompt-api-for-gemini-nano`
4. Set to **Enabled**
5. Restart Chrome
6. Visit `chrome://components` → Update **Optimization Guide On Device Model**

> Without Chrome AI, the extension falls back to rule-based detection automatically.
> Rule-based detection is deterministic and works offline.

---

## Score Calculation

```js
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

clauseRisk = categoryWeight × severityWeight × impact × confidence × (1 − sentiment_score)
finalScore = (sum of all clauseRisks / maxPossible) × 100
```

---

## Why Scores Were Inconsistent Before (Technical)

| Cause | v1 | v2 |
|-------|----|----|
| LLM temperature > 0 | ✗ Random output | ✅ Not used for scoring |
| No result caching | ✗ New API call each scan | ✅ Hash cache |
| AI-only scoring | ✗ Variable confidence values | ✅ Rule-based backbone |
| No deduplication | ✗ Duplicate clauses inflated score | ✅ Deduplication applied |

---

## Technologies

- **Chrome Extension Manifest V3**
- **Chrome Built-in AI** (`window.ai` — Gemini Nano, no API key)
- **Rule-based NLP** (regex engine, deterministic)
- **DOM TreeWalker** (precise text highlighting)
- **Chrome Storage API** (result persistence)
- **No backend server required**
