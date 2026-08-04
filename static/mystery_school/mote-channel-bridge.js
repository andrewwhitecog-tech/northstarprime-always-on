(() => {
  "use strict";

  if (document.querySelector("[data-mote-bridge]")) return;

  const script =
    document.currentScript ||
    [...document.scripts].find((node) =>
      String(node.src || "").includes("/static/mystery_school/mote-channel-bridge.js")
    );
  const requestedChannel = script?.dataset.channel || "mystery-school";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  const channelDefaults = {
    idc: {
      label: "IDC",
      name: "Interdimensional Cable",
      form: "masked-reveler",
      room: "Library / Vault",
      incoming: "Broadcasts and episode devices become dream-TV lore.",
      outgoing: "Room artifacts return as hosts, bumpers, locations, and episode seeds.",
      roomHref: "/mystery-school/library",
    },
    idg: {
      label: "IDG",
      name: "Interdimensional Games",
      form: "scanner-imp",
      room: "Workshop",
      incoming: "Playable systems become Workshop skill shrines.",
      outgoing: "Relics and thresholds return as mechanics and cabinet prompts.",
      roomHref: "/mystery-school/workshop",
    },
    idr: {
      label: "IDR",
      name: "Interdimensional Radio",
      form: "smoke-curl",
      room: "Circle",
      incoming: "Original station beds become the Circle's pulse.",
      outgoing: "Room atmospheres return as idents, tracks, and bumpers.",
      roomHref: "/mystery-school/circle",
    },
    irl: {
      label: "IRL",
      name: "The Waking Workshop",
      form: "signal-router",
      room: "Workshop",
      incoming: "Real builds keep the dream attached to evidence and craft.",
      outgoing: "Dream devices return as prototypes, tools, and documented experiments.",
      roomHref: "/mystery-school/workshop",
    },
  };

  const roomDefaults = [
    {
      match: "/mystery-school/dark-night",
      label: "DARK NIGHT",
      name: "After-Hours Housewares",
      form: "night-light",
      room: "Dark Night",
      incoming: "A small light and the quiet route are complete participation paths.",
      outgoing: "Clean observations return to the other rooms without being disguised as lore.",
      roomHref: "/mystery-school/dark-night",
    },
    {
      match: "/mystery-school/library",
      label: "LIBRARY",
      name: "Warranty & Documentation",
      form: "winged-bookmark",
      room: "Library",
      incoming: "IDC broadcasts arrive here as sourced room lore and case files.",
      outgoing: "Documented artifacts can return to IDC as episode and bumper seeds.",
      roomHref: "/mystery-school/library",
    },
    {
      match: "/mystery-school/workshop",
      label: "WORKSHOP",
      name: "Assembly & Repair",
      form: "scanner-imp",
      room: "Workshop",
      incoming: "IDG mechanics and IRL builds arrive as reproducible skill shrines.",
      outgoing: "Tools and relics leave as prototypes, games, and documented experiments.",
      roomHref: "/mystery-school/workshop",
    },
    {
      match: "/mystery-school/circle",
      label: "CIRCLE",
      name: "Customer Assembly",
      form: "masked-reveler",
      room: "Circle",
      incoming: "IDR station beds arrive as the shared room pulse.",
      outgoing: "Rhythms, glyphs, and questions return as idents and track prompts.",
      roomHref: "/mystery-school/circle",
    },
    {
      match: "/mystery-school/garden",
      label: "GARDEN",
      name: "Perishables That Remember Sunlight",
      form: "biolum-spore",
      room: "Garden",
      incoming: "Low-stimulation sound and real observation enter without making medical claims.",
      outgoing: "Bioluminescent motifs return as safe visual and ambient seeds.",
      roomHref: "/mystery-school/garden",
    },
    {
      match: "/mystery-school/high-thoughts",
      label: "HIGH THOUGHTS",
      name: "Question Laboratory",
      form: "smoke-curl",
      room: "High Thoughts",
      incoming: "Questions arrive from every channel with their confidence still attached.",
      outgoing: "Only sourced, bounded ideas leave for production.",
      roomHref: "/mystery-school/high-thoughts",
    },
    {
      match: "/mystery-school/vault",
      label: "VAULT",
      name: "Transmission Archive",
      form: "keyhole-wisp",
      room: "Vault",
      incoming: "Channel artifacts enter as optional lore, never as proof by repetition.",
      outgoing: "Transmission images can return as original show, game, and radio seeds.",
      roomHref: "/mystery-school/vault",
    },
  ];

  const roomContext = roomDefaults.find((entry) => path.startsWith(entry.match));
  const context =
    roomContext ||
    channelDefaults[requestedChannel] ||
    channelDefaults.irl;

  document.documentElement.dataset.moteContext = requestedChannel;

  const id = `mote-bridge-panel-${Math.random().toString(36).slice(2, 9)}`;
  const aside = document.createElement("aside");
  aside.className = "mote-bridge";
  aside.dataset.moteBridge = "";
  aside.dataset.moteForm = context.form;
  if (document.getElementById("idr-dock")) {
    aside.classList.add("mote-bridge--with-dock");
  }
  aside.setAttribute("aria-label", "MOTE channel guide");
  aside.innerHTML = `
    <button class="mote-bridge__toggle" type="button" aria-expanded="false" aria-controls="${id}">
      <span class="mote-bridge__morph" aria-hidden="true">
        <span class="mote-bridge__body"></span>
        <span class="mote-bridge__eye">◆</span>
      </span>
      <strong>MOTE</strong>
      <small>${context.label} courier</small>
    </button>
    <div class="mote-bridge__panel" id="${id}" hidden>
      <div class="mote-bridge__head">
        <span>${context.form.replaceAll("-", " ")} // ${context.label}</span>
        <button class="mote-bridge__close" type="button" aria-label="Close MOTE">×</button>
      </div>
      <p>I carry devices both ways. Here is the current exchange with <strong>${context.name}</strong>.</p>
      <div class="mote-bridge__flow">
        <span>IN → ${context.incoming}</span>
        <span>OUT → ${context.outgoing}</span>
      </div>
      <nav class="mote-bridge__links" aria-label="MOTE passages">
        <a href="${context.roomHref}">Open ${context.room}</a>
        <a href="/mystery-school#signal-exchange">Signal exchange</a>
      </nav>
    </div>
  `;

  document.body.appendChild(aside);

  const toggle = aside.querySelector(".mote-bridge__toggle");
  const close = aside.querySelector(".mote-bridge__close");
  const panel = aside.querySelector(".mote-bridge__panel");

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      panel.querySelector("a")?.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  fetch("/static/mystery_school/mote-manifest.json", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      return response.json();
    })
    .then((manifest) => {
      const exchange = (manifest.channel_exchange || []).find(
        (entry) => entry.id === requestedChannel
      );
      if (!exchange || roomContext) return;
      const flow = aside.querySelectorAll(".mote-bridge__flow span");
      if (flow[0]) flow[0].textContent = `IN → ${exchange.incoming}`;
      if (flow[1]) flow[1].textContent = `OUT → ${exchange.outgoing}`;
      aside.dataset.manifest = manifest.canon_version || "loaded";
    })
    .catch(() => {
      aside.dataset.manifest = "fallback";
    });
})();
