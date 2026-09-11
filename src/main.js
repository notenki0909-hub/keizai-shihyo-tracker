import "./style.css";
import Chart from "chart.js/auto";

const DATA_URL = import.meta.env.BASE_URL + "data/indicators.json";
const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利"];

const state = {
  category: "すべて",
  q: "",
  sort: "category",
  data: null,
};

/* ---------- helpers ---------- */

/** "2026-07" / "2026 Q2" / "2026" → epoch ms */
function parseT(t) {
  let m = /^(\d{4})-(\d{2})$/.exec(t);
  if (m) return Date.UTC(+m[1], +m[2] - 1, 1);
  m = /^(\d{4}) Q(\d)$/.exec(t);
  if (m) return Date.UTC(+m[1], (+m[2] - 1) * 3, 1);
  m = /^(\d{4})$/.exec(t);
  if (m) return Date.UTC(+m[1], 0, 1);
  return NaN;
}

/** 単位ごとのスケール（表示単位・除数） */
function unitScale(unit) {
  if (unit === "百万円") return { unit: "兆円", div: 1e6, digits: 2 };
  if (unit === "億円") return { unit: "兆円", div: 1e4, digits: 2 };
  if (unit === "%" || unit === "倍") return { unit, div: 1, digits: 2 };
  return { unit, div: 1, digits: 1 };
}

/** 値と単位を読みやすい形に。戻り値 {num, unit} */
function fmtValue(v, ind) {
  const sc = unitScale(ind.unit);
  const n = v / sc.div;
  const opts =
    sc.unit === "%" || sc.unit === "倍"
      ? { minimumFractionDigits: 1, maximumFractionDigits: 2 }
      : { maximumFractionDigits: sc.digits };
  return { num: n.toLocaleString("ja-JP", opts), unit: sc.unit };
}

function fmtDelta(d, ind) {
  if (d == null) return { text: "—", cls: "chg-neutral" };
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "―";
  let cls = "chg-neutral";
  if (d !== 0 && ind.betterWhen !== "neutral") {
    const good = d > 0 === (ind.betterWhen === "up");
    cls = good ? "chg-pos" : "chg-neg";
  }
  const sc = unitScale(ind.unit);
  const n = Math.abs(d) / sc.div;
  const num = n.toLocaleString("ja-JP", { maximumFractionDigits: sc.digits });
  const unit = sc.unit === "倍" ? "pt" : sc.unit === "%" ? "pt" : sc.unit;
  return { text: `${arrow} ${num} ${unit}`, cls };
}

function catColor(cat) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--cat-${cat}`).trim() || "#2563eb";
}

/** インラインSVGスパークライン */
function sparkline(points, color) {
  const W = 300;
  const H = 44;
  const pad = 3;
  const slice = points.slice(-72);
  const vals = slice.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / Math.max(slice.length - 1, 1);
  const coords = slice.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (H - pad * 2) * (1 - (p.value - min) / span);
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)[0].toFixed(1)} ${H} L${coords[0][0].toFixed(1)} ${H} Z`;
  const gid = "g" + Math.random().toString(36).slice(2, 8);
  return `
    <svg class="card__spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}

/* ---------- rendering ---------- */

function visibleIndicators() {
  let list = state.data.indicators.slice();
  if (state.category !== "すべて") list = list.filter((i) => i.category === state.category);
  if (state.q.trim()) {
    const q = state.q.trim().toLowerCase();
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.shortName.toLowerCase().includes(q) ||
        i.category.includes(q)
    );
  }
  const byCat = (i) => CATEGORIES.indexOf(i.category);
  const chg = (i) => i.summary?.changeFromPrev ?? 0;
  const sorters = {
    category: (a, b) => byCat(a) - byCat(b) || a.name.localeCompare(b.name, "ja"),
    name: (a, b) => a.name.localeCompare(b.name, "ja"),
    changeAbs: (a, b) => Math.abs(chg(b)) - Math.abs(chg(a)),
    changeUp: (a, b) => chg(b) - chg(a),
    changeDown: (a, b) => chg(a) - chg(b),
  };
  list.sort(sorters[state.sort] || sorters.category);
  return list;
}

function renderGrid() {
  const grid = document.getElementById("grid");
  const list = visibleIndicators();
  document.getElementById("empty").hidden = list.length > 0;

  grid.innerHTML = list
    .map((ind) => {
      const s = ind.summary;
      const { num, unit } = fmtValue(s.latest.value, ind);
      const dPrev = fmtDelta(s.changeFromPrev, ind);
      const dYoy = fmtDelta(s.changeFromYearAgo, ind);
      const color = catColor(ind.category);
      const prevLabel = ind.frequency === "quarterly" ? "前期比" : "前月比";
      return `
      <button class="card" data-id="${ind.id}">
        <span class="tag" style="background:${color}">${ind.category}</span>
        <h3 class="card__name">${ind.name}</h3>
        <div class="card__valrow">
          <span class="card__value">${num}</span>
          <span class="card__unit">${unit}</span>
          <span class="card__period">${s.latest.t}${s.latest.provisional ? "（速報）" : ""}</span>
        </div>
        ${sparkline(ind.points, color)}
        <div class="card__changes">
          <span>${prevLabel} <b class="${dPrev.cls}">${dPrev.text}</b></span>
          <span>前年比 <b class="${dYoy.cls}">${dYoy.text}</b></span>
        </div>
      </button>`;
    })
    .join("");

  grid.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
}

function renderChips() {
  const wrap = document.getElementById("category-chips");
  const cats = ["すべて", ...CATEGORIES];
  wrap.innerHTML = cats
    .map(
      (c) =>
        `<button class="chip" data-cat="${c}" aria-pressed="${c === state.category}">${c}</button>`
    )
    .join("");
  wrap.querySelectorAll(".chip").forEach((el) => {
    el.addEventListener("click", () => {
      state.category = el.dataset.cat;
      renderChips();
      renderGrid();
    });
  });
}

/* ---------- detail dialog ---------- */

let chart = null;
let currentInd = null;
let currentRange = "10y";

const RANGES = [
  { key: "1y", label: "1年", years: 1 },
  { key: "3y", label: "3年", years: 3 },
  { key: "5y", label: "5年", years: 5 },
  { key: "10y", label: "10年", years: 10 },
  { key: "all", label: "全期間", years: Infinity },
];

function openDetail(id) {
  const ind = state.data.indicators.find((i) => i.id === id);
  if (!ind) return;
  currentInd = ind;
  currentRange = "10y";

  const color = catColor(ind.category);
  const s = ind.summary;
  document.getElementById("d-tag").textContent = ind.category;
  document.getElementById("d-tag").style.background = color;
  document.getElementById("d-name").textContent = ind.name;
  document.getElementById("d-desc").textContent = ind.description;

  const f = (v) => {
    const { num, unit } = fmtValue(v, ind);
    return `${num} ${unit}`;
  };
  document.getElementById("d-stats").innerHTML = `
    <div><span>最新（${s.latest.t}）</span><b>${f(s.latest.value)}</b></div>
    <div><span>過去最大（${s.max.t}）</span><b>${f(s.max.value)}</b></div>
    <div><span>過去最小（${s.min.t}）</span><b>${f(s.min.value)}</b></div>
    <div><span>データ数</span><b>${s.count}点</b></div>
    <div><span>季節調整</span><b>${ind.seasonalAdjustment}</b></div>`;

  document.getElementById("d-ranges").innerHTML = RANGES.map(
    (r) => `<button class="range-btn" data-range="${r.key}" aria-pressed="${r.key === currentRange}">${r.label}</button>`
  ).join("");
  document.querySelectorAll("#d-ranges .range-btn").forEach((el) => {
    el.addEventListener("click", () => {
      currentRange = el.dataset.range;
      document.querySelectorAll("#d-ranges .range-btn").forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.range === currentRange);
      });
      drawChart();
    });
  });

  document.getElementById("d-source").innerHTML =
    `出典：統計ダッシュボード（e-Stat）／${ind.source.statName}　系列コード <code>${ind.source.indicatorCode}</code>　` +
    `単位：${ind.unitLabel}`;

  document.getElementById("detail").showModal();
  drawChart();
}

function drawChart() {
  const ind = currentInd;
  const color = catColor(ind.category);
  const r = RANGES.find((x) => x.key === currentRange);
  const cutoff =
    r.years === Infinity ? -Infinity : Date.now() - r.years * 365.25 * 864e5;

  const pts = ind.points
    .map((p) => ({ x: parseT(p.t), y: p.value }))
    .filter((p) => Number.isFinite(p.x) && p.x >= cutoff);

  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue("--border").trim();
  const tick = css.getPropertyValue("--text-faint").trim();

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("d-canvas"), {
    type: "line",
    data: {
      datasets: [
        {
          data: pts,
          borderColor: color,
          backgroundColor: color + "20",
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.15,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "linear",
          min: pts.length ? pts[0].x : undefined,
          max: pts.length ? pts.at(-1).x : undefined,
          ticks: {
            color: tick,
            maxTicksLimit: 8,
            callback: (v) => {
              const d = new Date(v);
              return currentRange === "1y" || currentRange === "3y"
                ? `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`
                : String(d.getUTCFullYear());
            },
          },
          grid: { color: grid },
        },
        y: {
          ticks: { color: tick },
          grid: { color: grid },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = new Date(items[0].parsed.x);
              return ind.frequency === "quarterly"
                ? `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`
                : `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            },
            label: (item) => {
              const { num, unit } = fmtValue(item.parsed.y, ind);
              return `${num} ${unit}`;
            },
          },
        },
      },
    },
  });
}

/* ---------- init ---------- */

async function init() {
  renderChips();

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.q = search.value;
    renderGrid();
  });
  document.getElementById("sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  const dlg = document.getElementById("detail");
  document.getElementById("detail-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });

  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    document.getElementById("meta-line").textContent =
      "データの読み込みに失敗しました：" + err.message;
    return;
  }

  const gen = new Date(state.data.generatedAt);
  const genStr = `${gen.getFullYear()}年${gen.getMonth() + 1}月${gen.getDate()}日`;
  document.getElementById("meta-line").textContent =
    `最終更新 ${genStr}　／　${state.data.indicatorCount} 指標　／　毎回 API から全期間を再取得`;

  renderGrid();
}

init();
