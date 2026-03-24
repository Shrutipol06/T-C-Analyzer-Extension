// ============================================================
// content.js — Injected into every page
// Handles: text extraction + clause highlighting on the DOM
// ============================================================

// ── Text extraction ───────────────────────────────────────────
function extractPageText() {
  const selectors = [
    'main', 'article',
    '[class*="terms"]', '[class*="policy"]', '[class*="privacy"]',
    '[id*="terms"]', '[id*="policy"]', '[id*="privacy"]',
    '[class*="content"]', '[id*="content"]',
    'body'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText || el.textContent || '';
      if (text.trim().length > 300) return text.trim();
    }
  }
  return document.body.innerText || '';
}

// ── Highlight a clause text in the DOM ───────────────────────
function highlightClause(matchText, severity, clauseId) {
  if (!matchText || matchText.trim().length < 5) return false;

  const colorMap = {
    High:   { bg: 'rgba(239,68,68,0.25)',   border: '#ef4444', label: '🔴' },
    Medium: { bg: 'rgba(249,115,22,0.25)',  border: '#f97316', label: '🟠' },
    Low:    { bg: 'rgba(234,179,8,0.25)',   border: '#eab308', label: '🟡' }
  };
  const style = colorMap[severity] || colorMap.Low;

  // Use TreeWalker to find text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const tag = node.parentElement?.tagName?.toLowerCase();
        if (['script','style','noscript','textarea'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.dataset?.tcHighlight) return NodeFilter.FILTER_REJECT;
        return node.textContent.toLowerCase().includes(matchText.toLowerCase().slice(0, 30))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    }
  );

  let found = false;
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.textContent.toLowerCase().indexOf(matchText.toLowerCase().slice(0, 50));
    if (idx === -1) continue;

    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, Math.min(idx + matchText.length, node.textContent.length));

      const span = document.createElement('mark');
      span.dataset.tcHighlight = clauseId;
      span.dataset.severity    = severity;
      span.title               = `TC Analyzer: ${severity} Risk`;
      span.style.cssText = `
        background: ${style.bg} !important;
        border-bottom: 2px solid ${style.border} !important;
        border-radius: 2px !important;
        padding: 1px 2px !important;
        cursor: pointer !important;
        position: relative !important;
      `;

      range.surroundContents(span);

      // Click to scroll popup to that clause
      span.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ type: 'CLAUSE_CLICKED', clauseId });
      });

      found = true;
      break; // highlight first occurrence only
    } catch (e) {
      // Range error (e.g., crosses element boundaries) — skip silently
    }
  }
  return found;
}

// ── Remove all highlights ─────────────────────────────────────
function removeAllHighlights() {
  document.querySelectorAll('mark[data-tc-highlight]').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
}

// ── Message listener ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TEXT') {
    sendResponse({ text: extractPageText(), url: location.href });
    return true;
  }

  if (msg.type === 'HIGHLIGHT_CLAUSES') {
    removeAllHighlights();
    let highlighted = 0;
    (msg.clauses || []).forEach(clause => {
      const text = clause.matchText || clause.text?.slice(0, 80) || '';
      if (highlightClause(text, clause.severity, clause.id || clause.label)) {
        highlighted++;
      }
    });
    sendResponse({ highlighted });
    return true;
  }

  if (msg.type === 'CLEAR_HIGHLIGHTS') {
    removeAllHighlights();
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'SCROLL_TO_CLAUSE') {
    const el = document.querySelector(`mark[data-tc-highlight="${msg.clauseId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '3px solid #3b82f6';
      setTimeout(() => { el.style.outline = ''; }, 2000);
    }
    sendResponse({ ok: !!el });
    return true;
  }
});
