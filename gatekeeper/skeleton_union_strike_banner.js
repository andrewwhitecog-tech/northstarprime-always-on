/**
 * NorthStar Prime — Skeleton Union Local #666 (48-Hour Storefront Strike Takeover)
 * Drop-in zero-dependency script: <script src="/gatekeeper/skeleton_union_strike_banner.js" defer></script>
 * Dismissible via sessionStorage; links directly to /gatekeeper/ or checkout promo code SKELETONUNION30.
 */
(function () {
  if (sessionStorage.getItem("nsp_strike_dismissed") === "1") return;
  const bar = document.createElement("div");
  bar.id = "nsp-skeleton-strike-banner";
  bar.style.cssText = [
    "position:fixed", "bottom:0", "left:0", "right:0", "z-index:99999",
    "background:repeating-linear-gradient(-45deg,#f5b038,#f5b038 14px,#111 14px,#111 28px)",
    "padding:4px 0 0 0", "font-family:'IBM Plex Mono',ui-monospace,monospace",
    "box-shadow:0 -10px 30px rgba(0,0,0,0.75)"
  ].join(";");

  bar.innerHTML = `
    <div style="background:#0c0e11;color:#f3efe6;padding:11px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:13px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <span style="background:#d91e2b;color:#fff;font-weight:700;padding:3px 8px;letter-spacing:0.08em;">STRIKE ALERT</span>
        <span><strong>SKELETON UNION LOCAL #666 HAS SEIZED CHECKOUT:</strong> Uncle Vorath refuses to pay us in 999 Silver — take <strong>30% OFF</strong> with code <code style="background:#f5b038;color:#090a0c;padding:2px 7px;font-weight:700;">SKELETONUNION30</code> until he negotiates.</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <a href="/gatekeeper/" style="background:#38f294;color:#050805;text-decoration:none;font-weight:700;padding:6px 12px;font-size:12px;letter-spacing:0.06em;">TEST THE GATEKEEPER →</a>
        <button id="nspStrikeClose" aria-label="Dismiss strike banner" style="background:transparent;color:#999;border:1px solid #333;padding:5px 9px;cursor:pointer;font-family:inherit;font-size:12px;">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(bar);
  document.getElementById("nspStrikeClose").addEventListener("click", function () {
    sessionStorage.setItem("nsp_strike_dismissed", "1");
    bar.remove();
  });
})();
