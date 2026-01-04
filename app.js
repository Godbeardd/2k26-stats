// app.js (overview page)
const fmtPct = (n) => (Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");
const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const safeDiv = (a, b) => (b === 0 ? 0 : a / b);

function cell(value) {
  // allow HTML cell objects: { html: "<a>...</a>" }
  if (value && typeof value === "object" && "html" in value) return value;
  return { text: String(value) };
}

function renderTable(el, headers, rows) {
  el.innerHTML = "";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  el.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    r.forEach((raw) => {
      const td = document.createElement("td");
      const c = cell(raw);
      if ("html" in c) td.innerHTML = c.html;
      else td.textContent = c.text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

function calcTotals(players, games) {
  const totals = {};
  players.forEach((p) => {
    totals[p] = { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0 };
  });

  games.forEach((game) => {
    players.forEach((p) => {
      const s = game.players?.[p];
      if (!s) return;
      const t = totals[p];
      t.g += 1;
      t.pts += s.pts;
      t.reb += s.reb;
      t.ast += s.ast;
      t.stl += s.stl;
      t.blk += s.blk;
      t.fgm += s.fgm;
      t.fga += s.fga;
      t.tpm += s.tpm;
      t.tpa += s.tpa;
    });
  });

  return totals;
}

function leaderboard(totals, metric) {
  const entries = Object.entries(totals).map(([name, t]) => {
    const fgp = t.fga ? t.fgm / t.fga : NaN;
    const tpp = t.tpa ? t.tpm / t.tpa : NaN;

    const value =
      metric === "pts" ? t.pts :
      metric === "reb" ? t.reb :
      metric === "ast" ? t.ast :
      metric === "stl" ? t.stl :
      metric === "blk" ? t.blk :
      metric === "fgp" ? fgp :
      metric === "tpp" ? tpp :
      NaN;

    return [name, value];
  });

  entries.sort((a, b) => (b[1] ?? -Infinity) - (a[1] ?? -Infinity));
  return entries[0];
}

/* Trends */
function buildTrendSeries(players, games, metric) {
  const series = Object.fromEntries(players.map((p) => [p, []]));

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    for (const p of players) {
      const s = g.players?.[p];
      if (!s) continue;

      let y = 0;
      if (metric === "fgp") y = s.fga ? (s.fgm / s.fga) * 100 : NaN;
      else if (metric === "tpp") y = s.tpa ? (s.tpm / s.tpa) * 100 : NaN;
      else y = s[metric] ?? 0;

      series[p].push({ x: i + 1, y, id: g.id });
    }
  }

  return { series, gamesCount: games.length };
}

function sizeCanvasToContainer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = Math.round(cssW * (420 / 1200));
  canvas.style.height = cssH + "px";

  const pxW = Math.max(300, Math.floor(cssW * dpr));
  const pxH = Math.max(200, Math.floor(cssH * dpr));
  if (canvas.width !== pxW) canvas.width = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;
}

function drawTrendChart(canvas, selectedPlayers, metric, trendData) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!selectedPlayers.length) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.max(14, Math.round(W / 70))}px system-ui`;
    ctx.fillText("Select one or more players to view trends.", 18, 32);
    return;
  }

  let points = [];
  for (const p of selectedPlayers) points = points.concat(trendData.series[p] || []);
  points = points.filter((pt) => Number.isFinite(pt.y));

  if (!points.length) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.max(14, Math.round(W / 70))}px system-ui`;
    ctx.fillText("No data for selected players/metric.", 18, 32);
    return;
  }

  const pad = { l: 54, r: 16, t: 16, b: 40 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const xMin = 1;
  const xMax = Math.max(trendData.gamesCount, ...xs);

  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad;
  yMax += yPad;

  const xToPx = (x) => pad.l + safeDiv((x - xMin), (xMax - xMin || 1)) * plotW;
  const yToPx = (y) => pad.t + (1 - safeDiv((y - yMin), (yMax - yMin || 1))) * plotH;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  const yTicks = 5;
  ctx.font = "12px system-ui";
  for (let i = 0; i <= yTicks; i++) {
    const y = yMin + (i / yTicks) * (yMax - yMin);
    const py = yToPx(y);
    ctx.beginPath();
    ctx.moveTo(pad.l, py);
    ctx.lineTo(W - pad.r, py);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    const label = (metric === "fgp" || metric === "tpp") ? `${Math.round(y)}%` : `${Math.round(y)}`;
    ctx.fillText(label, 10, py + 4);
  }

  const xTicks = Math.min(10, xMax);
  for (let i = 1; i <= xTicks; i++) {
    const x = Math.round(1 + (i - 1) * (xMax - 1) / (xTicks - 1 || 1));
    const px = xToPx(x);
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, H - pad.b);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(`G${x}`, px - 10, H - 16);
  }

  selectedPlayers.forEach((player, idx) => {
    const pts = (trendData.series[player] || []).filter((pt) => Number.isFinite(pt.y));
    if (!pts.length) return;

    const hue = Math.floor((idx / Math.max(1, selectedPlayers.length)) * 300);
    ctx.strokeStyle = `hsla(${hue}, 85%, 65%, 0.95)`;
    ctx.fillStyle = `hsla(${hue}, 85%, 65%, 0.95)`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    pts.forEach((p) => {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function getSelectedOptions(selectEl) {
  return Array.from(selectEl.selectedOptions).map((o) => o.value);
}

async function main() {
  const res = await fetch("/games.json", { cache: "no-store" });
  if (!res.ok) throw new Error("games.json not found / blocked");
  const data = await res.json();

  const players = data.players;
  const games = (data.games || []).slice().sort((a, b) => a.id - b.id);

  const wins = games.filter((g) => g.for > g.against).length;
  const losses = games.length - wins;

  document.getElementById("subtitle").textContent =
    `${games.length} games tracked • Record ${wins}-${losses}`;

  document.getElementById("record").textContent = `${wins}-${losses}`;
  document.getElementById("gamesCount").textContent = `${games.length}`;

  const avgFor = games.reduce((s, g) => s + g.for, 0) / (games.length || 1);
  const avgAgainst = games.reduce((s, g) => s + g.against, 0) / (games.length || 1);
  document.getElementById("avgFor").textContent = fmt1(avgFor);
  document.getElementById("avgAgainst").textContent = fmt1(avgAgainst);

  const totals = calcTotals(players, games);

  const totalsRows = players.map((p) => {
    const t = totals[p];
    const fgp = t.fga ? t.fgm / t.fga : NaN;
    const tpp = t.tpa ? t.tpm / t.tpa : NaN;

    return [
      { html: `<a class="plink" href="player.html?name=${encodeURIComponent(p)}">${p}</a>` },
      t.g,
      t.pts, fmt1(t.pts / (t.g || 1)),
      t.reb, fmt1(t.reb / (t.g || 1)),
      t.ast, fmt1(t.ast / (t.g || 1)),
      t.stl, fmt1(t.stl / (t.g || 1)),
      t.blk, fmt1(t.blk / (t.g || 1)),
      fmtPct(fgp),
      fmtPct(tpp),
    ];
  });

  renderTable(
    document.getElementById("totalsTable"),
    ["Player", "G", "PTS", "PPG", "REB", "RPG", "AST", "APG", "STL", "SPG", "BLK", "BPG", "FG%", "3P%"],
    totalsRows
  );

  const metricSelect = document.getElementById("metricSelect");
  function updateLeaderboard() {
    const metric = metricSelect.value;
    const [name, value] = leaderboard(totals, metric);
    document.getElementById("lbLeader").textContent = name ?? "—";
    document.getElementById("lbValue").textContent =
      (metric === "fgp" || metric === "tpp") ? fmtPct(value) : (Number.isFinite(value) ? String(value) : "—");
  }
  metricSelect.addEventListener("change", updateLeaderboard);
  updateLeaderboard();

  // trends
  const trendMetricEl = document.getElementById("trendMetric");
  const trendPlayersEl = document.getElementById("trendPlayers");
  const trendCanvas = document.getElementById("trendChart");

  if (trendMetricEl && trendPlayersEl && trendCanvas) {
    trendPlayersEl.innerHTML = "";
    players.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      opt.selected = true;
      trendPlayersEl.appendChild(opt);
    });

    function redrawTrends() {
      sizeCanvasToContainer(trendCanvas);
      const metric = trendMetricEl.value;
      const selectedPlayers = getSelectedOptions(trendPlayersEl);
      const trendData = buildTrendSeries(players, games, metric);
      drawTrendChart(trendCanvas, selectedPlayers, metric, trendData);
    }

    trendMetricEl.addEventListener("change", redrawTrends);
    trendPlayersEl.addEventListener("change", redrawTrends);
    window.addEventListener("resize", redrawTrends);
    redrawTrends();
  }
}

main().catch(() => {
  const sub = document.getElementById("subtitle");
  if (sub) sub.textContent = "Failed to load games.json (serve the folder via http://localhost)";
});

