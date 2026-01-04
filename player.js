const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const fmtPct = (n) => (Number.isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");

function getPlayerFromQuery() {
  const url = new URL(window.location.href);
  return url.searchParams.get("name");
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
    r.forEach((cell) => {
      const td = document.createElement("td");
      if (cell && typeof cell === "object" && "html" in cell) td.innerHTML = cell.html;
      else td.textContent = String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  el.appendChild(tbody);
}

async function main() {
  const name = getPlayerFromQuery();
  if (!name) {
    document.getElementById("subtitle").textContent = "No player selected.";
    return;
  }

  const res = await fetch("/games.json", { cache: "no-store" });
  if (!res.ok) throw new Error("games.json not found / blocked");
  const data = await res.json();

  const players = data.players || [];
  if (!players.includes(name)) {
    document.getElementById("subtitle").textContent = "Player not found.";
    return;
  }

  const games = (data.games || []).slice().sort((a, b) => a.id - b.id);

  document.getElementById("playerTitle").textContent = name;
  document.getElementById("subtitle").textContent = `${games.length} games tracked`;

  // totals
  let gCount = 0;
  let pts = 0, ast = 0, reb = 0;
  let fgm = 0, fga = 0, tpm = 0, tpa = 0;

  const rows = [];

  for (const g of games) {
    const s = g.players?.[name];
    if (!s) continue;

    gCount++;
    pts += s.pts;
    ast += s.ast;
    reb += s.reb;
    fgm += s.fgm;
    fga += s.fga;
    tpm += s.tpm;
    tpa += s.tpa;

    const fgp = s.fga ? s.fgm / s.fga : NaN;
    const tpp = s.tpa ? s.tpm / s.tpa : NaN;

    rows.push([
      { html: `<a class="plink" href="games.html?game=${encodeURIComponent(g.id)}">Game ${g.id}</a>` },
      g.date,
      `${g.for}-${g.against}`,
      s.pts,
      s.ast,
      s.reb,
      `${s.fgm}-${s.fga}`,
      fmtPct(fgp),
      `${s.tpm}-${s.tpa}`,
      fmtPct(tpp),
    ]);
  }

  const fgpTot = fga ? fgm / fga : NaN;
  const tppTot = tpa ? tpm / tpa : NaN;

  document.getElementById("playerSub").textContent =
    `Totals: ${pts} PTS • ${ast} AST • ${reb} REB • FG% ${fmtPct(fgpTot)} • 3P% ${fmtPct(tppTot)}`;

  document.getElementById("pG").textContent = String(gCount);
  document.getElementById("pPPG").textContent = fmt1(pts / (gCount || 1));
  document.getElementById("pAPG").textContent = fmt1(ast / (gCount || 1));
  document.getElementById("pRPG").textContent = fmt1(reb / (gCount || 1));

  renderTable(
    document.getElementById("playerGamesTable"),
    ["Game", "Date", "Score", "PTS", "AST", "REB", "FG", "FG%", "3PT", "3P%"],
    rows
  );
}

main().catch(() => {
  document.getElementById("subtitle").textContent =
    "Failed to load games.json (serve the folder via http://localhost)";
});
