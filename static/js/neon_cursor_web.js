/* NSP NEON CURSOR (web) — DISABLED 2026-07-30.
   The old in-browser cursor (reticle + ribbon trail + click bursts drawn on every
   mousemove) was heavy and, by hiding the OS cursor with `cursor:none`, it overrode
   Andre's native neon cursor in Chrome ("reverts back"). The desktop now has a native
   zero-CPU .ani reticle + an event-driven SFX daemon, so this web layer is redundant.
   Original preserved as neon_cursor_web.js.bak-heavy-*. No-op below; restores the cursor. */
(function () { try { document.documentElement.style.cursor = ''; document.body.style.cursor = ''; } catch (e) {} })();
