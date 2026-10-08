/**
 * MOTE Channel Bridge - NorthStar Cross-Channel Event & Telemetry Bus
 * Interconnects Mystery School chambers with IDC video, IDR records, IDL books, and IDG games.
 * Standard: Zero-Emoji / Local-First / Privacy-Preserving / Pure VORATH Mythos
 */
(function() {
  'use strict';

  if (window.__MOTE_CHANNEL_BRIDGE_LOADED__) return;
  window.__MOTE_CHANNEL_BRIDGE_LOADED__ = true;

  const CHANNEL_NAME = 'northstar_mote_bus';
  let broadcastBus = null;
  try {
    if (typeof window.BroadcastChannel === 'function') {
      broadcastBus = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) {
    // BroadcastChannel unsupported or blocked
  }

  const scriptTag = document.currentScript || document.querySelector('script[src*="mote-channel-bridge.js"]');
  const currentChannel = (scriptTag && scriptTag.getAttribute('data-channel')) || 'mystery-school';

  const logs = [
    `[${new Date().toISOString().substring(11, 19)}] MOTE familiar bonded to channel: ${currentChannel.toUpperCase()}`,
    `[${new Date().toISOString().substring(11, 19)}] Protocol: Zero-Exploitation / Falsifiable Evidence`
  ];

  function broadcastEvent(type, payload) {
    const msg = {
      source: currentChannel,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    if (broadcastBus) {
      try { broadcastBus.postMessage(msg); } catch (err) {}
    }
    try {
      localStorage.setItem('northstar_last_mote_signal', JSON.stringify(msg));
    } catch (e) {}
    addLog(`Broadcasted ${type} to federation bus.`);
  }

  function addLog(text) {
    const time = new Date().toISOString().substring(11, 19);
    logs.push(`[${time}] ${text}`);
    if (logs.length > 20) logs.shift();
    const stream = document.getElementById('mote-log-stream');
    if (stream) {
      stream.innerHTML = logs.map(l => `<div>${escapeHtml(l)}</div>`).join('');
      stream.scrollTop = stream.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initUI() {
    const widget = document.createElement('div');
    widget.className = 'mote-bridge-widget';
    widget.id = 'mote-bridge-widget';

    widget.innerHTML = `
      <div class="mote-panel" id="mote-panel">
        <div class="mote-panel-head">
          <h5>MOTE Familiar Telemetry</h5>
          <button class="mote-close-btn" id="mote-close-btn" aria-label="Close telemetry">&times;</button>
        </div>
        <div class="mote-telemetry-row">
          <span>Carrier Channel:</span>
          <span>${currentChannel.toUpperCase()}</span>
        </div>
        <div class="mote-telemetry-row">
          <span>Federation Bus:</span>
          <span style="color:#e8c982">${broadcastBus ? 'ACTIVE' : 'LOCAL ONLY'}</span>
        </div>
        <div class="mote-telemetry-row">
          <span>Acoustic Carrier:</span>
          <span>108-180 HZ</span>
        </div>
        <div class="mote-log-stream" id="mote-log-stream">
          ${logs.map(l => `<div>${escapeHtml(l)}</div>`).join('')}
        </div>
        <div class="mote-action-links">
          <a href="/mystery-school/chambers/">Chambers</a>
          <a href="/mystery-school/vault/">Vault</a>
          <a href="/literature/">Literature (IDL)</a>
          <a href="/arcade/">Arcade (IDG)</a>
        </div>
      </div>
      <div class="mote-pill" id="mote-pill" role="button" aria-expanded="false" title="MOTE Cross-Channel Familiar">
        <div class="mote-beacon active"></div>
        <span class="mote-label">MOTE</span>
        <span class="mote-channel-tag">${currentChannel.toUpperCase()}</span>
      </div>
    `;

    document.body.appendChild(widget);

    const pill = document.getElementById('mote-pill');
    const panel = document.getElementById('mote-panel');
    const closeBtn = document.getElementById('mote-close-btn');

    pill.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      pill.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        addLog('Telemetry inspection opened by initiate.');
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.remove('open');
      pill.setAttribute('aria-expanded', 'false');
    });

    if (broadcastBus) {
      broadcastBus.onmessage = function(e) {
        if (e.data && e.data.type) {
          addLog(`Signal received from [${e.data.source}]: ${e.data.type}`);
        }
      };
    }
  }

  // Hook into chamber choice events if on the chambers page
  window.addEventListener('storage', (e) => {
    if (e.key === 'northstar_chamber_journal') {
      broadcastEvent('chamber_journal_updated', { size: e.newValue ? e.newValue.length : 0 });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  window.NorthStarMote = {
    broadcast: broadcastEvent,
    log: addLog
  };
})();
