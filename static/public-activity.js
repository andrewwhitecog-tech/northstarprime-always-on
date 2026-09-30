/* First-party public landing activity. No cookies, URLs, referrers, coordinates or names sent. */
(() => {
'use strict';
const routes = new Set(['/', '/access/', '/hire/', '/services/', '/portfolio/', '/arcade/', '/arcade/lab/', '/idr/', '/idc-programming/', '/watch/', '/store/', '/literature/', '/mystery-school/', '/contact/', '/software/']);
const path = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '') + '/';
if (!routes.has(path) || !['northstarprime.net','www.northstarprime.net','app.northstarprime.net'].includes(location.hostname)) return;
const base = 'https://app.northstarprime.net/api/public-activity';
const panel = document.createElement('aside');
panel.setAttribute('aria-label', 'Public activity measurements');
panel.style.cssText = 'max-width:65rem;margin:2rem auto;padding:1rem;border-top:1px solid currentColor;font:0.8rem/1.6 system-ui;opacity:.9;text-align:center';
const counts = document.createElement('span'); counts.textContent = 'Public activity counts unavailable';
const details = document.createElement('small');
details.style.display = 'block';
details.textContent = 'Last 30 days · Public landing pages only · 30-minute tab sessions split by site and UTC day, not people. Declared automation and diagnostics excluded; undeclared bots may remain.';
panel.append(counts, details); document.body.append(panel);
let lastGood = null;
async function readCounts() {
 try {
  const r = await fetch(base + '/summary', {credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', signal:AbortSignal.timeout(5000)});
  const d = await r.json();
  if (!r.ok || d.schema !== 'nsp.public_activity.v1' || d.status !== 'measured' || !Number.isSafeInteger(d.browser_pageviews) || !Number.isSafeInteger(d.browser_sessions) || d.browser_pageviews < 0 || d.browser_sessions < 0) throw Error('unavailable');
  lastGood = new Date().toISOString();
  counts.textContent = d.browser_pageviews.toLocaleString() + ' browser pageviews · ' + d.browser_sessions.toLocaleString() + ' browser sessions';
  counts.title = 'Checked ' + lastGood;
 } catch (_) { counts.textContent = lastGood ? counts.textContent + ' (stale; checked ' + lastGood + ')' : 'Public activity counts unavailable'; }
}
readCounts();
if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') {
 details.textContent += ' Your privacy preference is honored; no pageview sent.'; return;
}
let session;
try {
 const now = Date.now(); const old = JSON.parse(sessionStorage.getItem('nsp-public-session-v1') || 'null');
 session = old && typeof old.id === 'string' && now - old.at < 30*60*1000 ? old.id : crypto.randomUUID();
 sessionStorage.setItem('nsp-public-session-v1', JSON.stringify({id:session, at:now}));
} catch (_) { details.textContent += ' Session storage unavailable; no pageview sent.'; return; }
const event = {event_id:crypto.randomUUID(), session_id:session, path, automated:navigator.webdriver === true};
let sent = false;
async function submit() {
 if (sent || document.visibilityState !== 'visible') return;
 sent = true;
 // One retry reuses the same event ID. Ambiguous submissions cannot double count.
 for (let attempt=0; attempt<2; attempt++) {
  try {
   const r=await fetch(base+'/events', {method:'POST', credentials:'omit', referrerPolicy:'no-referrer', headers:{'Content-Type':'application/json'}, body:JSON.stringify(event), signal:AbortSignal.timeout(5000)});
   if (r.ok) { await readCounts(); return; }
   if (r.status < 500) return;
  } catch (_) {}
  if (attempt === 0) await new Promise(resolve=>setTimeout(resolve,1500));
 }
}
document.addEventListener('visibilitychange',submit); submit();
})();
