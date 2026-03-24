// ============================================================
// popup.js — TermAlert UI controller
// ============================================================

const $ = id => document.getElementById(id);

// ── State ─────────────────────────────────────────────────────
let state = { clauses: [], score: 0, pages: 0, method: '', scanned: false };

// ── Tab navigation ────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`panel-${btn.dataset.panel}`).classList.add('active');
  });
});

// ── Load settings ─────────────────────────────────────────────
chrome.storage.local.get(['settings','lastResult','history','userRules'], data => {
  if (data.settings) applySettings(data.settings);
  if (data.lastResult) applyResult(data.lastResult, false);
  if (data.history) renderHistory(data.history);
  if (data.userRules) state.userRules = data.userRules;
  else state.userRules = [];
  renderRules();
  updateHistBadge(data.history?.length || 0);
});

// ── Settings persistence ──────────────────────────────────────
['stgHL','stgHist','stgRate'].forEach(id => {
  $(id)?.addEventListener('change', saveSettings);
});
$('stgRate')?.addEventListener('input', () => {
  const v = $('stgRate').value;
  $('rateLbl').textContent = v == 1.0 ? 'Normal (1.0x)' : `${v}x Speed`;
});

function saveSettings() {
  const s = {
    highlight:  $('stgHL').checked,
    saveHist:   $('stgHist').checked,
    speechRate: parseFloat($('stgRate').value || 1.0)
  };
  chrome.storage.local.set({ settings: s });
}

function applySettings(s) {
  if (s.highlight !== undefined) $('stgHL').checked   = s.highlight;
  if (s.saveHist  !== undefined) $('stgHist').checked = s.saveHist;
  if (s.speechRate) {
    $('stgRate').value = s.speechRate;
    $('rateLbl').textContent = s.speechRate == 1.0 ? 'Normal (1.0x)' : `${s.speechRate}x Speed`;
  }
}

// ── Network status ────────────────────────────────────────────
function setNetwork(status) {
  const dot = $('netDot'), lbl = $('netLbl');
  dot.className = 'net-dot' + (status === 'offline' ? ' off' : status === 'scanning' ? ' scan' : '');
  lbl.textContent = status === 'offline' ? 'Offline' : status === 'scanning' ? 'Scanning' : 'Online';
}

chrome.runtime.sendMessage({ type: 'CHECK_NETWORK' }, res => {
  setNetwork(res?.online === false ? 'offline' : 'online');
});

// ── Load current tab info ─────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  const url  = tab.url || '';
  const host = (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return url; } })();
  $('siteName').textContent = tab.title?.slice(0, 50) || host;
  $('siteUrl').textContent  = host;
  $('topSub').textContent   = host;

  // Try to load favicon
  const fav = $('siteFav');
  const favUrl = `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  const img = document.createElement('img');
  img.src = favUrl;
  img.onload  = () => { fav.innerHTML = ''; fav.appendChild(img); };
  img.onerror = () => { fav.textContent = '🌐'; };
});

// ── Scan button ───────────────────────────────────────────────
$('scanBtn').addEventListener('click', async () => {
  const btn = $('scanBtn');
  btn.disabled = true;
  $('scanTxt').innerHTML = '<span class="spin">⟳</span> Scanning…';
  setNetwork('scanning');
  setProgress(5, 'Extracting page content…');
  
  // Clear old results
  $('sumContent').innerHTML = '<div class="empty-state"><div class="es-icon spin">⟳</div><p class="es-p">Analyzing page...</p></div>';
  $('userDefinedSummary').style.display = 'none';
  $('scoreBox').style.display = 'none';
  $('clauseSec').style.display = 'none';
  
  showProg(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get text from page
    let pageText = '', pageUrl = '';
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TEXT' });
      pageText = res.text || ''; pageUrl = res.url || '';
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await sleep(300);
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TEXT' });
      pageText = res.text || ''; pageUrl = res.url || '';
    }

    if (!pageText || pageText.trim().length < 80) {
      throw new Error('Not enough text on this page. Try a Terms & Conditions page.');
    }

    setProgress(22, 'Analyzing clauses…');

    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'ANALYZE', text: pageText, url: pageUrl },
        res => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (!res?.success) reject(new Error(res?.error || 'Analysis failed'));
          else resolve(res.result);
        }
      );
    });

    setProgress(75, 'Calculating score…'); await sleep(180);
    setProgress(88, 'Highlighting clauses…');

    // Highlight on page if setting enabled
    if ($('stgHL').checked) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_CLAUSES', clauses: result.clauses });
      } catch {}
    }

    setProgress(100, 'Complete!'); await sleep(280);
    showProg(false);

    // Save to history
    chrome.storage.local.get(['history','settings'], data => {
      const saveHist = data.settings?.saveHist !== false;
      if (saveHist) {
        const hist = data.history || [];
        const host = (() => { try { return new URL(pageUrl).hostname.replace('www.',''); } catch { return pageUrl; } })();
        hist.unshift({
          site:      host,
          url:       pageUrl,
          score:     result.score,
          clauses:   result.clauses.length,
          timestamp: Date.now()
        });
        const trimmed = hist.slice(0, 30);
        chrome.storage.local.set({ history: trimmed, lastResult: result });
        renderHistory(trimmed);
        updateHistBadge(trimmed.length);
      } else {
        chrome.storage.local.set({ lastResult: result });
      }
    });

    applyResult(result, true);

  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    $('scanTxt').textContent = '🔄 SCAN AGAIN';
    $('scanIco').textContent = '';
    setNetwork('online');
    showProg(false);
  }
});

// ── Apply result to all panels ────────────────────────────────
function applyResult(result, animate) {
  state.clauses = result.clauses || [];
  state.score   = result.score   || 0;
  state.pages   = result.pageCount || 1;
  state.method  = result.method  || 'rule-based';
  state.scanned = true;

  const highs = state.clauses.filter(c => c.severity === 'High').length;
  const meds  = state.clauses.filter(c => c.severity === 'Medium').length;

  // Score donut
  updateDonut(state.score, animate);

  // Stats
  $('highCt').textContent = highs;
  $('medCt').textContent  = meds;
  $('pageCt').textContent = state.pages;

  // Verdict
  const { text, sub, color } = getVerdict(state.score);
  $('verdict').textContent    = text;
  $('verdict').style.color    = color;
  $('verdictSub').textContent = sub;

  // Site tag
  const tagEl = $('siteTag');
  tagEl.className = 'site-tag ' + (
    state.score >= 70 ? 't-risk' :
    state.score >= 40 ? 't-med'  :
    state.score >= 15 ? 't-pend' : 't-safe'
  );
  tagEl.textContent =
    state.score >= 70 ? 'High Risk' :
    state.score >= 40 ? 'Moderate'  :
    state.score >= 15 ? 'Low Risk'  : 'Safe';

  // Show sections
  $('scoreBox').style.display   = 'block';
  $('clauseSec').style.display  = 'block';
  $('clearBtn').style.display   = state.clauses.length > 0 ? 'block' : 'none';

  // Clause count
  $('clauseCt').textContent = `${state.clauses.length} found`;

  renderPills();
  renderSummary();
  console.log('[TC Popup] Applying result, user rules detected:', result.userRulesDetected);
  renderUserRulesSummary(result.userRulesDetected || []);
}

function renderUserRulesSummary(detected) {
  const wrap = $('userDefinedSummary');
  const cont = $('userRuleContent');
  console.log('[TC Popup] Rendering user rules summary, count:', detected?.length);
  if (!detected || detected.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  cont.innerHTML = detected.map(r => `
    <div class="sum-card sch">
      <div class="sc-hd">
        <span class="sc-ico">💡</span>
        <span class="sc-title">${esc(r.rule)}</span>
      </div>
      <div class="sc-body">
        <em>"${esc(r.text)}"</em>
      </div>
    </div>
  `).join('');
}

// ── Donut animation ───────────────────────────────────────────
function updateDonut(score, animate) {
  const circ   = 213;
  const offset = circ - (score / 100) * circ;
  const color  = scoreColor(score);
  const fill   = $('dFill'), num = $('dNum');

  num.textContent   = score;
  num.style.color   = color;
  fill.style.stroke = color;

  if (animate) {
    fill.style.transition = 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke .4s';
    requestAnimationFrame(() => setTimeout(() => {
      fill.style.strokeDashoffset = offset;
    }, 30));
  } else {
    fill.style.transition = 'none';
    fill.style.strokeDashoffset = offset;
  }
}

function scoreColor(s) {
  if (s >= 70) return 'var(--red)';
  if (s >= 40) return 'var(--orange)';
  if (s >= 15) return 'var(--yellow)';
  return 'var(--green)';
}

function getVerdict(s) {
  if (s >= 70) return { text: '⚠️ High Risk',      sub: 'This document has serious clauses that could affect your rights or finances.', color: 'var(--red)' };
  if (s >= 40) return { text: '⚡ Moderate Risk',   sub: 'Some clauses warrant attention. Review before agreeing.', color: 'var(--orange)' };
  if (s >= 15) return { text: '✅ Low Risk',         sub: 'Minor concerns found. Generally safe with some caveats.', color: 'var(--yellow)' };
  return          { text: '✅ Safe',               sub: 'No major risky clauses detected. Looks clean.', color: 'var(--green)' };
}

// ── Render clause pills (Scan tab) ───────────────────────────
function renderPills() {
  const sevOrder = { High: 3, Medium: 2, Low: 1 };

  const filtered = [...state.clauses]
    .sort((a, b) => (sevOrder[b.severity] || 1) - (sevOrder[a.severity] || 1));

  const list = $('pillList');

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:var(--tx3);font-size:12px">
      ✅ No risky clauses detected at this level</div>`;
    return;
  }

  const sevIcon = { High: '🔴', Medium: '🟠', Low: '🟡' };
  const sevClass = { High: 'ph', Medium: 'pm', Low: 'pl' };
  const sevBadge = { High: 'sh', Medium: 'sm', Low: 'sl' };

  list.innerHTML = filtered.map(c => `
    <div class="clause-pill ${sevClass[c.severity] || 'pl'}"
         data-id="${esc(c.id || c.label)}" title="Click to jump to this clause on the page">
      <span class="pill-ico">${sevIcon[c.severity] || '🟡'}</span>
      <div class="pill-bd">
        <div class="pill-name">${esc(c.label || 'Unnamed Clause')}</div>
        <div class="pill-cat">${esc(c.category || '')}</div>
      </div>
      <span class="pill-sev ${sevBadge[c.severity] || 'sl'}">${c.severity}</span>
    </div>`).join('');

  list.querySelectorAll('.clause-pill').forEach(el => {
    el.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try { await chrome.tabs.sendMessage(tab.id, { type: 'SCROLL_TO_CLAUSE', clauseId: el.dataset.id }); } catch {}
    });
  });
}

// ── Render summary tab ────────────────────────────────────────
function renderSummary() {
  if (!state.scanned) return;

  const highs = state.clauses.filter(c => c.severity === 'High');
  const meds  = state.clauses.filter(c => c.severity === 'Medium');
  const lows  = state.clauses.filter(c => c.severity === 'Low');
  const { text } = getVerdict(state.score);

  let html = `<div class="sum-overview">
    <strong>${text}</strong> — This document contains <strong>${state.clauses.length} flagged clause${state.clauses.length !== 1 ? 's' : ''}</strong>
    across approximately <strong>${state.pages} page${state.pages !== 1 ? 's' : ''}</strong>.
    ${highs.length ? `<strong style="color:var(--red)">${highs.length} high-risk clause${highs.length !== 1 ? 's' : ''}</strong> may significantly impact your rights or finances.` : 'No high-risk clauses found.'}
    ${meds.length  ? ` <strong style="color:var(--orange)">${meds.length} medium-risk</strong> clause${meds.length !== 1 ? 's' : ''} also noted.` : ''}
  </div>`;

  if (highs.length) html += `<div class="sum-grp"><div class="sum-grp-title">🔴 High Risk</div>${highs.map(c => summaryCard(c,'sch','svh')).join('')}</div>`;
  if (meds.length)  html += `<div class="sum-grp"><div class="sum-grp-title">🟠 Medium Risk</div>${meds.map(c => summaryCard(c,'scm','svm')).join('')}</div>`;
  if (lows.length)  html += `<div class="sum-grp"><div class="sum-grp-title">🟡 Low Risk</div>${lows.map(c => summaryCard(c,'scl','svl')).join('')}</div>`;

  // Other / general clauses (safe)
  html += `<div class="sum-grp"><div class="sum-grp-title">ℹ️ General Terms</div>
    <div class="sum-card scs">
      <div class="sc-hd"><span class="sc-ico">📋</span>
        <span class="sc-title">What This Document Covers</span>
        <span class="sc-sev svs">Overview</span>
      </div>
      <div class="sc-body">${generalOverview()}</div>
    </div>
  </div>`;

  $('sumContent').innerHTML = html;
}

function summaryCard(c, cardClass, sevClass) {
  const plain = (c.text || c.matchText || '').replace(/\s+/g,' ').trim().slice(0,220);
  const tip   = getInterpretation(c);
  return `<div class="sum-card ${cardClass}">
    <div class="sc-hd">
      <span class="sc-ico">${clauseIcon(c.category)}</span>
      <span class="sc-title">${esc(c.label || 'Clause')}</span>
      <span class="sc-sev ${sevClass}">${c.severity}</span>
    </div>
    <div class="sc-body">
      ${plain ? `<em>${esc(plain)}</em><br><br>` : ''}
      <strong style="color:var(--tx)">What it means:</strong> ${tip}
    </div>
    <div class="sc-tip">${getAdvice(c)}</div>
  </div>`;
}

function clauseIcon(cat) {
  const m = { 'Data Privacy':'🔒','Financial':'💳','User Rights':'⚖️','Legal':'📜','IP':'©️','Safe':'✅' };
  return m[cat] || '📌';
}

function getInterpretation(c) {
  const map = {
    'Data Selling':            'The company may <em>sell your personal data</em> to third parties for profit.',
    'Data Sharing':            'Your data can be <em>shared with external companies</em> or advertising partners.',
    'Third-Party Data Sharing':'Your information may be passed to <em>outside entities</em> without your direct consent.',
    'Location/Activity Tracking':'The service tracks your <em>physical location or online behavior</em>.',
    'Auto-Renewal':            'Your subscription <em>renews automatically</em> — you may be charged without extra warning.',
    'No Refund Policy':        'Once you pay, <em>you cannot get a refund</em> under any circumstance.',
    'Automatic Charges':       'The company can <em>charge your payment method automatically</em>, potentially without notice.',
    'Rights Waiver':           'By agreeing, you <em>give up certain legal rights</em> you would otherwise have.',
    'Class Action Waiver':     'You <em>cannot join a class-action lawsuit</em> against the company — disputes are handled individually.',
    'Mandatory Arbitration':   'Any disputes must go through <em>private arbitration</em>, not regular courts.',
    'Indemnification Clause':  'You may be <em>held responsible for the company\'s legal costs</em> in certain situations.',
    'Broad IP License Grant':  'The company gets a <em>very broad license to use your content</em> — worldwide, perpetually.',
    'IP Ownership Transfer':   'Content you create or upload may <em>become the company\'s property</em>.',
    'Liability Limitation':    'The company <em>limits its financial responsibility</em> if something goes wrong.',
    'Unilateral Termination':  'The company can <em>terminate your account at any time</em>, for any reason.',
    'Unilateral Terms Change': 'The company can <em>change these terms at any time</em> without your approval.',
    'Warranty Disclaimer':     'The service is provided "as-is" — <em>no guarantees</em> about quality or reliability.',
  };
  return map[c.label] || `This clause relates to <em>${c.category}</em> and may affect your ${c.severity === 'High' ? 'rights or finances significantly' : 'usage experience'}.`;
}

function getAdvice(c) {
  const map = {
    'Data Selling':         'Consider whether you\'re comfortable with your data being sold. Look for opt-out options.',
    'Auto-Renewal':         'Set a calendar reminder before the renewal date to cancel if needed.',
    'No Refund Policy':     'Be sure about your purchase — there is no recourse after payment.',
    'Mandatory Arbitration':'You lose access to the court system. Consider if this is acceptable before agreeing.',
    'Class Action Waiver':  'You can only pursue individual claims, limiting collective consumer power.',
    'Broad IP License Grant':'Read carefully — your photos, posts, or content may be used in their marketing.',
  };
  return map[c.label] || `Review this clause carefully before agreeing, especially if ${c.category === 'Financial' ? 'money is involved' : 'your data or rights are affected'}.`;
}

function generalOverview() {
  if (!state.scanned || state.clauses.length === 0) {
    return 'No specific risky areas detected. The document appears to use standard terms.';
  }
  const cats = [...new Set(state.clauses.map(c => c.category))];
  return `This Terms & Conditions document primarily covers <strong>${cats.slice(0,4).join(', ')}</strong>.
  A total of <strong>${state.clauses.length} clause${state.clauses.length !== 1 ? 's' : ''}</strong> were flagged for review.
  Non-flagged clauses typically cover standard disclaimers, account creation, service description, and general usage policies.
  Always read the full document before agreeing — especially sections highlighted on the page.`;
}

// ── Render history tab ────────────────────────────────────────
function renderHistory(hist) {
  const el = $('histContent');
  if (!hist || hist.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🕓</div>
      <p class="es-p">No scans yet.<br>Start scanning pages<br>to build history.</p></div>`;
    return;
  }

  const items = hist.map(h => {
    const cls = h.score >= 70 ? 'hh' : h.score >= 40 ? 'hm' : h.score >= 15 ? 'hl' : 'hs';
    const ago = timeAgo(h.timestamp);
    return `<div class="hist-item">
      <div class="hi-score ${cls}">${h.score}</div>
      <div class="hi-bd">
        <div class="hi-site">${esc(h.site || 'Unknown site')}</div>
        <div class="hi-meta">${h.clauses} clause${h.clauses !== 1 ? 's' : ''} detected</div>
      </div>
      <div class="hi-rt">
        <div class="hi-cls">${scoreLabel(h.score)}</div>
        <div class="hi-time">${ago}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = items + `<button class="clear-hist" id="clearHistBtn">🗑 Clear History</button>`;
  $('clearHistBtn').addEventListener('click', () => {
    chrome.storage.local.set({ history: [] });
    renderHistory([]);
    updateHistBadge(0);
  });
}

function updateHistBadge(n) {
  const b = $('histBadge');
  if (n > 0) { b.textContent = n > 9 ? '9+' : n; b.classList.add('on'); }
  else b.classList.remove('on');
}

function scoreLabel(s) {
  if (s >= 70) return '⚠️ High Risk';
  if (s >= 40) return '⚡ Moderate';
  if (s >= 15) return '✅ Low Risk';
  return '✅ Safe';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Clear highlights ──────────────────────────────────────────
$('clearBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' }); } catch {}
  $('clearBtn').style.display = 'none';
});

// ── Progress helpers ──────────────────────────────────────────
function showProg(show) { $('progSection').style.display = show ? 'block' : 'none'; }
function setProgress(pct, lbl) {
  $('progFill').style.width    = pct + '%';
  $('progLbl').textContent     = lbl;
  $('progPct').textContent     = pct + '%';
}

// ── Error ─────────────────────────────────────────────────────
function showError(msg) {
  $('scoreBox').style.display  = 'block';
  $('dNum').textContent        = '!';
  $('dNum').style.color        = 'var(--red)';
  $('dFill').style.stroke      = 'var(--red)';
  $('verdict').textContent     = 'Scan Error';
  $('verdict').style.color     = 'var(--red)';
  $('verdictSub').textContent  = msg;
  showProg(false);
}

// ── Rule management ──────────────────────────────────────────
$('addRuleBtn')?.addEventListener('click', addUserRule);
$('ruleInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') addUserRule(); });

function addUserRule() {
  const input = $('ruleInput');
  const rule = input.value.trim();
  if (!rule) return;
  if (!state.userRules) state.userRules = [];
  state.userRules.push(rule);
  input.value = '';
  saveUserRules();
  renderRules();
}

function saveUserRules() {
  chrome.storage.local.set({ userRules: state.userRules });
}

function renderRules() {
  const list = $('rulesList');
  if (!list) return;
  if (!state.userRules || state.userRules.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:24px 20px;color:var(--tx3);font-size:12px;opacity:0.7">
      <div style="font-size:24px;margin-bottom:8px">💡</div>
      Define custom rules above to have the AI monitor them specifically for you.</div>`;
    return;
  }
  list.innerHTML = state.userRules.map((r, i) => `
    <div class="clause-pill" style="cursor:default">
      <span class="pill-ico">💡</span>
      <div class="pill-bd">
        <div class="pill-name">${esc(r)}</div>
      </div>
      <button class="delete-rule" data-index="${i}" style="background:transparent;border:none;color:var(--tx3);cursor:pointer;font-size:14px;padding:5px">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.delete-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      state.userRules.splice(parseInt(btn.dataset.index), 1);
      saveUserRules();
      renderRules();
    });
  });
}

// ── Text-to-Speech (TTS) Logic ────────────────────────────────
let currentUtterance = null;

function speakSummary() {
  // 1. Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // 2. Get text to speak
  const text = getSpeakableText();
  if (!text) {
    showError("Nothing to speak yet. Scan a page first!");
    return;
  }

  // 3. Create utterance
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = "en-US";
  currentUtterance.rate = parseFloat($('stgRate')?.value || 1.0);
  currentUtterance.pitch = 1.0;

  // 4. Handle events
  currentUtterance.onstart = () => $('speakBtn').innerHTML = '<span>⏳</span> Playing...';
  currentUtterance.onend = () => $('speakBtn').innerHTML = '<span>🔊</span> Listen Summary';
  currentUtterance.onerror = () => $('speakBtn').innerHTML = '<span>🔊</span> Listen Summary';

  // 5. Speak
  window.speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
  window.speechSynthesis.cancel();
  $('speakBtn').innerHTML = '<span>🔊</span> Listen Summary';
}

function getSpeakableText() {
  if (!state.scanned) return "";
  
  // Extract text from the summary content area
  const mainSum = $('sumContent').innerText || "";
  const userSum = $('userRuleContent').innerText || "";
  
  let fullText = "Terms and Conditions Analysis Summary. ";
  fullText += mainSum.replace(/\s+/g, ' ').trim();
  
  if (userSum) {
    fullText += ". User Defined Rules matches follow. ";
    fullText += userSum.replace(/\s+/g, ' ').trim();
  }
  
  return fullText;
}

// Event Listeners for TTS
$('speakBtn')?.addEventListener('click', speakSummary);
$('stopBtn')?.addEventListener('click', stopSpeech);

// ── Utils ─────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
