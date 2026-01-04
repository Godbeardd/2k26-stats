const fmtPct = (n) => (Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");

function cell(value) {
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
    if (r._rowClass) tr.className = r._rowClass;

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
  if (!res.ok) throw new Error("games.json not found / blocked");
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
    // Build simple table manually so rows can be clickable + highlight selected
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

    games.forEach((g) => {
      const diff = g.for - g.against;
      const tr = document.createElement("tr");
      tr.className = "clickRow";
      if (g.id === selectedId) tr.style.background = "rgba(96,165,250,0.10)";

      tr.addEventListener("click", () => loadGame(g.id));

      const cells = [g.id, formatGameLabel(g), diff];
      cells.forEach((val, i) => {
        const td = document.createElement("td");
        td.textContent = val;
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

    // Team shooting totals (sum tracked players only)
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
      if (!s) {
        return [
          { html: `<a class="plink" href="player.html?name=${encodeURIComponent(p)}">${p}</a>` },
          "—","—","—","—","—","—","—","—","—"
        ];
      }

      const fgp = s.fga ? s.fgm / s.fga : NaN;
      const tpp = s.tpa ? s.tpm / s.tpa : NaN;

      return [
        { html: `<a class="plink" href="player.html?name=${encodeURIComponent(p)}">${p}</a>` },
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

    // sort by points desc (treat "—" as 0)
    boxRows.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));

    renderTable(
      boxTable,
      ["Player", "PTS", "REB", "AST", "STL", "BLK", "FG", "FG%", "3PT", "3P%"],
      boxRows
    );
  }

  const initial = getQueryGame() ?? (games.at(-1)?.id ?? 1);
  renderGameList(initial);
  loadGame(initial);
}

main().catch(() => {
  const sub = document.getElementById("subtitle");
  if (sub) sub.textContent = "Failed to load games.json (serve via http://localhost)";
});
