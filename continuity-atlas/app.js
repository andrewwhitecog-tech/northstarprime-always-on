(() => {
  "use strict";

  const payload = window.CONTINUITY_ATLAS_DATA;
  if (!payload) {
    document.body.innerHTML = "<p>Graph data bundle is missing. Run build_static_bundle.py.</p>";
    return;
  }

  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");
  const shell = canvas.parentElement;
  const gradeColors = { A: "#67edb7", B: "#70b7ff", C: "#d5a5ff", D: "#ff8c83" };
  const typeColors = {
    show: "#6da9ff", film: "#f6cb69", person: "#d5a5ff", character: "#67edb7",
    brand: "#ff8c83", finding: "#ff8c83", source: "#81d4fa", topic: "#f6cb69",
    tournament: "#67edb7", era: "#9aa9c9", season: "#9aa9c9", metric: "#ffbd7a",
    place: "#7ed0a8", episode: "#93a9ff", round: "#7ad7ff", mechanic: "#ffbd7a",
    rule: "#ff8c83", taxonomy: "#f6cb69", "category-form": "#e2c66f",
    concept: "#d6b6ff", event: "#ff9f80", organization: "#7fd8c3",
    language: "#ffd37d", work: "#c6d2ff"
  };

  let mode = "media";
  let graph;
  let nodes = [];
  let nodeMap = new Map();
  let edges = [];
  let selected = null;
  let hovered = null;
  let draggingNode = null;
  let panning = false;
  let lastPointer = null;
  let transform = { x: 0, y: 0, scale: 1 };
  let activeGrades = new Set(["A", "B", "C", "D"]);
  let searchTerm = "";
  let width = 0;
  let height = 0;
  let frame;

  function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function resize() {
    const rect = shell.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, rect.width);
    height = Math.max(420, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setMode(nextMode) {
    mode = nextMode;
    graph = payload[mode];
    const radius = Math.min(width, height) * .31;
    nodes = graph.nodes.map((item, index) => {
      const angle = ((hash(item.id) % 10000) / 10000) * Math.PI * 2;
      const ring = .45 + ((hash(`${item.id}-r`) % 1000) / 2000);
      const nodeRadius = item.type === "show" ? 16 : item.type === "taxonomy" ? 14 : item.type === "tournament" ? 12 : 10;
      return { ...item, x: Math.cos(angle) * radius * ring, y: Math.sin(angle) * radius * ring, vx: 0, vy: 0, radius: nodeRadius, index };
    });
    nodeMap = new Map(nodes.map(node => [node.id, node]));
    edges = graph.edges.map(edge => ({ ...edge, a: nodeMap.get(edge.source), b: nodeMap.get(edge.target) }));
    selected = null;
    hovered = null;
    transform = { x: 0, y: 0, scale: 1 };
    document.querySelectorAll(".mode").forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.getElementById("jeopardy-coverage").hidden = mode !== "jeopardy";
    updateStats();
    updateDetail();
    kick(220);
  }

  function visibleEdges() {
    return edges.filter(edge => activeGrades.has(edge.evidence_grade));
  }

  function visibleNodes() {
    const connected = new Set();
    visibleEdges().forEach(edge => { connected.add(edge.source); connected.add(edge.target); });
    let result = nodes.filter(node => connected.has(node.id));
    if (searchTerm) {
      const matching = new Set(result.filter(node => `${node.label} ${node.description || ""}`.toLowerCase().includes(searchTerm)).map(node => node.id));
      visibleEdges().forEach(edge => {
        if (matching.has(edge.source) || matching.has(edge.target)) {
          matching.add(edge.source);
          matching.add(edge.target);
        }
      });
      result = result.filter(node => matching.has(node.id));
    }
    return result;
  }

  function updateStats() {
    document.getElementById("node-count").textContent = graph.nodes.length.toLocaleString();
    document.getElementById("edge-count").textContent = graph.edges.length.toLocaleString();
    document.getElementById("source-count").textContent = graph.sources.length.toLocaleString();
    document.getElementById("graph-version").textContent = graph.version;
  }

  function sourceFor(id) {
    return graph.sources.find(source => source.id === id);
  }

  function updateDetail(node = selected) {
    const title = document.getElementById("detail-title");
    const description = document.getElementById("detail-description");
    const meta = document.getElementById("detail-meta");
    const edgeList = document.getElementById("detail-edges");
    if (!node) {
      title.textContent = "Choose a node";
      description.textContent = "Click any entity to see its connections, evidence grade, explanation, and sources.";
      meta.innerHTML = "";
      edgeList.innerHTML = "";
      return;
    }
    title.textContent = node.label;
    description.textContent = node.description || "This entity is included because at least one evidence-backed connection points to it.";
    meta.innerHTML = `<span class="meta-chip">${escapeHtml(node.type)}</span>${node.year ? `<span class="meta-chip">${escapeHtml(node.year)}</span>` : ""}`;
    const related = visibleEdges().filter(edge => edge.source === node.id || edge.target === node.id);
    edgeList.innerHTML = related.map(edge => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = nodeMap.get(otherId);
      const sources = edge.citations.map(citation => {
        const source = sourceFor(citation.source_id);
        if (!source) return "";
        const locator = citation.locator ? ` — ${escapeHtml(citation.locator)}` : "";
        return `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>${locator}</li>`;
      }).join("");
      return `<article class="edge-card"><div class="edge-head"><span class="grade grade-${edge.evidence_grade.toLowerCase()}">${edge.evidence_grade}</span><h3>${escapeHtml(edge.label)} → ${escapeHtml(other ? other.label : otherId)}</h3></div><p>${escapeHtml(edge.description)}</p><ul>${sources}</ul></article>`;
    }).join("") || "<p class=\"hint\">No visible connection survives the current filters.</p>";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function escapeAttr(value) { return escapeHtml(value); }

  function physics() {
    const currentNodes = visibleNodes();
    const currentIds = new Set(currentNodes.map(node => node.id));
    const currentEdges = visibleEdges().filter(edge => currentIds.has(edge.source) && currentIds.has(edge.target));
    const repel = currentNodes.length > 30 ? 1200 : 1800;
    for (let i = 0; i < currentNodes.length; i++) {
      const a = currentNodes[i];
      for (let j = i + 1; j < currentNodes.length; j++) {
        const b = currentNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy + 1;
        const force = Math.min(repel / d2, 3.5);
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx -= dx * force; a.vy -= dy * force;
        b.vx += dx * force; b.vy += dy * force;
      }
    }
    currentEdges.forEach(edge => {
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = edge.evidence_grade === "D" ? 170 : 125;
      const force = (distance - desired) * .0035;
      edge.a.vx += dx / distance * force;
      edge.a.vy += dy / distance * force;
      edge.b.vx -= dx / distance * force;
      edge.b.vy -= dy / distance * force;
    });
    currentNodes.forEach(node => {
      if (node !== draggingNode) {
        node.vx += -node.x * .0008;
        node.vy += -node.y * .0008;
        node.vx *= .88; node.vy *= .88;
        node.x += node.vx; node.y += node.vy;
      }
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
    ctx.scale(transform.scale, transform.scale);
    const currentNodes = visibleNodes();
    const ids = new Set(currentNodes.map(node => node.id));
    const currentEdges = visibleEdges().filter(edge => ids.has(edge.source) && ids.has(edge.target));

    currentEdges.forEach(edge => {
      ctx.beginPath();
      ctx.moveTo(edge.a.x, edge.a.y);
      ctx.lineTo(edge.b.x, edge.b.y);
      ctx.strokeStyle = gradeColors[edge.evidence_grade] + (edge.evidence_grade === "D" ? "75" : "55");
      ctx.lineWidth = edge.evidence_grade === "A" ? 1.8 : 1.2;
      ctx.setLineDash(edge.evidence_grade === "D" ? [5, 6] : edge.evidence_grade === "C" ? [2, 4] : []);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    currentNodes.forEach(node => {
      const isSelected = selected && selected.id === node.id;
      const isHovered = hovered && hovered.id === node.id;
      const color = typeColors[node.type] || "#aeb9d6";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isSelected ? 4 : isHovered ? 2 : 0), 0, Math.PI * 2);
      ctx.fillStyle = color + (isSelected ? "ff" : "d8");
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected || isHovered ? 20 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? "#fff6d8" : "rgba(255,255,255,.34)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      if (transform.scale > .64 || isSelected || isHovered) {
        ctx.font = `${isSelected ? 700 : 600} ${Math.max(9, 11 / transform.scale)}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = isSelected ? "#fff8e7" : "#cbd2e6";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label.length > 28 ? `${node.label.slice(0, 26)}…` : node.label, node.x, node.y + node.radius + 6, 190);
      }
    });
    ctx.restore();

    const empty = currentEdges.length === 0;
    const emptyState = document.getElementById("empty-state");
    emptyState.hidden = !empty;
    emptyState.style.display = empty ? "grid" : "none";
  }

  function animate() {
    physics();
    draw();
    frame = requestAnimationFrame(animate);
  }

  function kick(iterations = 80) {
    for (let i = 0; i < iterations; i++) physics();
    draw();
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function worldPoint(event) {
    const point = canvasPoint(event);
    return { x: (point.x - width / 2 - transform.x) / transform.scale, y: (point.y - height / 2 - transform.y) / transform.scale };
  }

  function nearestNode(event) {
    const point = worldPoint(event);
    let best = null;
    let bestDistance = Infinity;
    visibleNodes().forEach(node => {
      const distance = Math.hypot(node.x - point.x, node.y - point.y);
      if (distance < (node.radius + 8) / transform.scale && distance < bestDistance) {
        best = node; bestDistance = distance;
      }
    });
    return best;
  }

  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture(event.pointerId);
    draggingNode = nearestNode(event);
    panning = !draggingNode;
    lastPointer = canvasPoint(event);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", event => {
    if (draggingNode) {
      const point = worldPoint(event);
      draggingNode.x = point.x; draggingNode.y = point.y;
      draggingNode.vx = 0; draggingNode.vy = 0;
    } else if (panning && lastPointer) {
      const point = canvasPoint(event);
      transform.x += point.x - lastPointer.x;
      transform.y += point.y - lastPointer.y;
      lastPointer = point;
    } else {
      hovered = nearestNode(event);
    }
  });
  canvas.addEventListener("pointerup", event => {
    const node = nearestNode(event);
    if (draggingNode && node === draggingNode) {
      selected = node;
      updateDetail();
    }
    draggingNode = null; panning = false; lastPointer = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? .9 : 1.1;
    transform.scale = Math.max(.35, Math.min(2.5, transform.scale * factor));
  }, { passive: false });

  document.querySelectorAll(".mode").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelectorAll("input[data-grade]").forEach(input => input.addEventListener("change", () => {
    input.checked ? activeGrades.add(input.dataset.grade) : activeGrades.delete(input.dataset.grade);
    if (selected && !visibleNodes().some(node => node.id === selected.id)) selected = null;
    updateDetail(); kick(80);
  }));
  document.getElementById("search").addEventListener("input", event => {
    searchTerm = event.target.value.trim().toLowerCase();
    kick(90);
  });
  document.getElementById("reset-view").addEventListener("click", () => {
    transform = { x: 0, y: 0, scale: 1 };
    selected = null; searchTerm = ""; document.getElementById("search").value = "";
    updateDetail(); kick(120);
  });

  function renderCoverage() {
    document.getElementById("coverage-grid").innerHTML = payload.coverage.dimensions.map(item => {
      const statusClass = `status-${item.status.replace(/[^a-z]+/g, "-")}`;
      return `<div class="coverage-item"><strong>${escapeHtml(item.name)}</strong><span class="${statusClass}">${escapeHtml(item.status)} · ${item.records} records</span></div>`;
    }).join("");
  }

  new ResizeObserver(() => { resize(); draw(); }).observe(shell);
  resize();
  renderCoverage();
  setMode("media");
  cancelAnimationFrame(frame);
  animate();
})();
