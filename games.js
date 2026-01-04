const fmtPct = (n) => (Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");
const safeDiv = (a, b) => (b === 0 ? 0 : a / b);

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
    tr.className = r._className || "";

    r.forEach((cell) => {
      if (cell === r._className) return;
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

function wlFrom(game) {
  const diff = game.for - game.against;
  return diff > 0 ? "W" : diff < 0 ? "L" : "T";
}

function formatGameLabel(g) {
  const d = new Date(g.date + "T00:00:00");
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const wl = wlFrom(g);
  return `${dateLabel} • ${wl} ${g.for}-${g.against}`;
}

function setQueryGame(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("game", String(id));
  history.replaceState({}, "", url);
}

function getQueryGame() {
  const url = new URL(window.location.href);
  const v = url.searchParams.get("game");
  return v ? Number(v) : null;
}

async function main() {
  const res = await fetch("./games.json", { cache: "no-store" });
  const data = await res.json();

  const players = data.players;
  const games = (data.games || []).slice().sort((a, b) => a.id - b.id);

  const listTable = document.getElementById("gamesListTable");
  const boxTable = document.getElementById("boxTable");

  const gameTitle = document.getElementById("gameTitle");
  const gameMeta = document.getElementById("gameMeta");

  const gScore = document.getElementById("gScore");
  const gDiff = document.getElementById("gDiff");
  const gFG = document.getElementById("gFG");
  const g3PT = document.getElementById("g3PT");

  function renderGameList(selectedId) {
    const rows = games.map((g) => {
      const diff = g.for - g.against;
      const wl = wlFrom(g);
      const row = [g.id, formatGameLabel(g), diff];
      row._className = "clickRow";
      row._id = g.id;
      row._selected = g.id === selectedId;
      return row;
    });

    // custom render so we can attach click handlers + highlight selected
    listTable.innerHTML = "";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    ["#", "Game", "Diff"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    listTable.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "clickRow";
      if (r._selected) tr.style.background = "rgba(96,165,250,0.10)";

      tr.addEventListener("click", () => {
        loadGame(r._id);
      });

      r.slice(0, 3).forEach((cell, i) => {
        const td = document.createElement("td");
        td.textContent = cell;
        // left align the "Game" label
        if (i === 1) td.style.textAlign = "left";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    listTable.appendChild(tbody);
  }

  function loadGame(id) {
    const g = games.find((x) => x.id === id);
    if (!g) return;

    setQueryGame(id);
    renderGameList(id);

    const diff = g.for - g.against;
    const wl = wlFrom(g);

    gameTitle.textContent = `Box Score • Game ${g.id}`;
    gameMeta.textContent = `${formatGameLabel(g)} • ${g.date}`;

    gScore.textContent = `${g.for}-${g.against} (${wl})`;
    gDiff.textContent = String(diff);

    // Team shooting totals (sum player stats we have)
    let fgm = 0, fga = 0, tpm = 0, tpa = 0;
    players.forEach((p) => {
      const s = g.players?.[p];
      if (!s) return;
      fgm += s.fgm || 0;
      fga += s.fga || 0;
      tpm += s.tpm || 0;
      tpa += s.tpa || 0;
    });

    const fgp = fga ? (fgm / fga) : NaN;
    const tpp = tpa ? (tpm / tpa) : NaN;

    gFG.textContent = `${fgm}-${fga} (${fmtPct(fgp)})`;
    g3PT.textContent = `${tpm}-${tpa} (${fmtPct(tpp)})`;

    const boxRows = players.map((p) => {
      const s = g.players?.[p];
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

    boxRows.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

    renderTable(
      boxTable,
      ["Player", "PTS", "REB", "AST", "STL", "BLK", "FG", "FG%", "3PT", "3P%"],
      boxRows
    );
  }

  // initial
  const initial = getQueryGame() ?? (games.at(-1)?.id ?? 1);
  renderGameList(initial);
  loadGame(initial);
}

main().catch(() => {
  const sub = document.getElementById("subtitle");
  if (sub) sub.textContent = "Failed to load games.json";
});
