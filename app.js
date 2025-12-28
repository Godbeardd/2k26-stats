const fmtPct = (n) => (Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");
const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");

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
    r.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

function calcTotals(players, games) {
  const totals = {};
  players.forEach((p) => {
    totals[p] = {
      g: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
    };
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

function wlFrom(game) {
  const diff = game.for - game.against;
  return diff > 0 ? "W" : diff < 0 ? "L" : "T";
}

async function main() {
  const res = await fetch("./games.json", { cache: "no-store" });
  const data = await res.json();

  const players = data.players;
  const games = (data.games || []).slice().sort((a, b) => a.id - b.id);

  // Summary
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

  // Dropdowns
  const gameSelect = document.getElementById("gameSelect");
  const metricSelect = document.getElementById("metricSelect");

  gameSelect.innerHTML = "";
  games.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = `Game ${g.id}`;
    gameSelect.appendChild(opt);
  });

  // Totals table
  const totals = calcTotals(players, games);
  const totalsRows = players.map((p) => {
    const t = totals[p];
    const fgp = t.fga ? t.fgm / t.fga : NaN;
    const tpp = t.tpa ? t.tpm / t.tpa : NaN;

    return [
      p,
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

  // Game log table
  const logRows = games.map((g) => {
    const diff = g.for - g.against;
    return [g.id, g.date, `${g.for}-${g.against}`, diff, wlFrom(g)];
  });

  renderTable(
    document.getElementById("logTable"),
    ["Game #", "Date", "Score", "Diff", "W/L"],
    logRows
  );

  // Leaderboard update
  function updateLeaderboard() {
    const metric = metricSelect.value;
    const [name, value] = leaderboard(totals, metric);

    document.getElementById("lbLeader").textContent = name ?? "—";

    const isPct = metric === "fgp" || metric === "tpp";
    document.getElementById("lbValue").textContent =
      isPct ? fmtPct(value) : (Number.isFinite(value) ? String(value) : "—");
  }

  // Box score update
  function updateBox() {
    const id = Number(gameSelect.value);
    const g = games.find((x) => x.id === id);
    if (!g) return;

    document.getElementById("gameMeta").textContent =
      `${g.date} • ${g.for}-${g.against} • ${wlFrom(g)}`;

    const boxRows = players.map((p) => {
      const s = g.players[p];
      if (!s) return [p, "—", "—", "—", "—", "—", "—", "—", "—", "—"];

      const fgp = s.fga ? s.fgm / s.fga : NaN;
      const tpp = s.tpa ? s.tpm / s.tpa : NaN;

      return [
        p,
        s.pts,
        s.reb,
        s.ast,
        s.stl,
        s.blk,
        `${s.fgm}-${s.fga}`,
        fmtPct(fgp),
        `${s.tpm}-${s.tpa}`,
        fmtPct(tpp),
      ];
    });

    // Sort by points desc
    boxRows.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

    renderTable(
      document.getElementById("boxTable"),
      ["Player", "PTS", "REB", "AST", "STL", "BLK", "FG", "FG%", "3PT", "3P%"],
      boxRows
    );
  }

  metricSelect.addEventListener("change", updateLeaderboard);
  gameSelect.addEventListener("change", updateBox);

  updateLeaderboard();
  updateBox();
}

main().catch((err) => {
  console.error(err);
  const sub = document.getElementById("subtitle");
  if (sub) sub.textContent = "Failed to load games.json";
});
