import "./style.css";
import Chart from "chart.js/auto";
import annotationPlugin from "chartjs-plugin-annotation";
import { initTheme } from "./theme.js";
import { RECESSIONS } from "./recessions.js";
import { isFavorite, toggleFavorite, getFavorites } from "./favorites.js";

Chart.register(annotationPlugin);

const DATA_URL = import.meta.env.BASE_URL + "data/indicators.json";
const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利", "為替・市場"];

const now = new Date();
const state = {
  category: "すべて",
  q: "",
  sort: "category",
  data: null,
  calMonth: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
  favoritesOnly: false,
};

/* ---------- helpers ---------- */

/** "2026-09-10" / "2026-07" / "2026 Q2" / "2026" → epoch ms */
function parseT(t) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{4})-(\d{2})$/.exec(t);
  if (m) return Date.UTC(+m[1], +m[2] - 1, 1);
  m = /^(\d{4}) Q(\d)$/.exec(t);
  if (m) return Date.UTC(+m[1], (+m[2] - 1) * 3, 1);
  m = /^(\d{4})$/.exec(t);
  if (m) return Date.UTC(+m[1], 0, 1);
  return NaN;
}

/** 単位ごとのスケール（表示単位・除数）。億円は値の大きさに応じて兆円へ切り替える */
function unitScale(unit, v = 0) {
  if (unit === "百万円") return { unit: "兆円", div: 1e6, digits: 2 };
  if (unit === "億円") {
    return Math.abs(v) >= 10000
      ? { unit: "兆円", div: 1e4, digits: 2 }
      : { unit: "億円", div: 1, digits: 2 };
  }
  if (unit === "%" || unit === "倍") return { unit, div: 1, digits: 2 };
  if (unit === "円") return { unit, div: 1, digits: 2 };
  return { unit, div: 1, digits: 1 };
}

/** 値と単位を読みやすい形に。戻り値 {num, unit} */
function fmtValue(v, ind) {
  const sc = unitScale(ind.unit, v);
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
  const sc = unitScale(ind.unit, d);
  const n = Math.abs(d) / sc.div;
  const num = n.toLocaleString("ja-JP", { maximumFractionDigits: sc.digits });
  const unit = sc.unit === "倍" ? "pt" : sc.unit === "%" ? "pt" : sc.unit;
  return { text: `${arrow} ${num} ${unit}`, cls };
}

/**
 * 過去の変化幅（前期比相当）の分布に対して、直近の変化がどれくらい珍しいかを表すz-score。
 * 市場予想（コンセンサス）との比較ではなく、指標自身の過去の変動から見た統計的な目安。
 */
function computeSurprise(points) {
  if (points.length < 10) return null;
  const diffs = [];
  for (let i = 1; i < points.length; i++) diffs.push(points[i].value - points[i - 1].value);
  const latest = diffs.at(-1);
  const history = diffs.slice(0, -1);
  if (history.length < 8) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd === 0) return null;
  return (latest - mean) / sd;
}

function surpriseInfo(z) {
  if (z == null || !Number.isFinite(z)) return null;
  const abs = Math.abs(z);
  if (abs >= 2.5) return { level: "high", label: "非常に大きな変化", z };
  if (abs >= 1.5) return { level: "mid", label: "やや大きな変化", z };
  return { level: "low", label: "通常の範囲内", z };
}

function catColor(cat) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--cat-${cat}`).trim() || "#2563eb";
}

/** "2026-10-02" → "2026年10月2日（金）" */
function fmtJpDateWithWeekday(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  return `${+m[1]}年${+m[2]}月${+m[3]}日（${wd}）`;
}

/** 重要度（1〜5）を★☆の文字列に */
function starsText(n) {
  const filled = Math.max(0, Math.min(5, n | 0));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

/** "2026-09" → その月の最終日 23:59:59（UTC）epoch ms */
function monthEndMs(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2], 0, 23, 59, 59);
}

/** target/neutral/context の目安ラインの色 */
function refColor(kind) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--ref-${kind}`).trim();
  return v || "#94a3b8";
}

/** インラインSVGスパークライン（目安ラインが範囲内にあれば1本重ねる） */
function sparkline(points, color, referenceLines = []) {
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

  const ref = referenceLines.find((r) => r.value >= min && r.value <= max);
  const refY = ref ? pad + (H - pad * 2) * (1 - (ref.value - min) / span) : null;
  const refSvg =
    refY == null
      ? ""
      : `<line x1="${pad}" y1="${refY.toFixed(1)}" x2="${W - pad}" y2="${refY.toFixed(1)}"
           stroke="${refColor(ref.kind)}" stroke-width="1" stroke-dasharray="3 3" />`;

  return `
    <svg class="card__spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/>
      ${refSvg}
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
}

/* ---------- rendering ---------- */

function visibleIndicators() {
  let list = state.data.indicators.slice();
  if (state.category !== "すべて") list = list.filter((i) => i.category === state.category);
  if (state.favoritesOnly) {
    const favSet = getFavorites();
    list = list.filter((i) => favSet.has(i.id));
  }
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

  // お気に入りは常に先頭にまとめる（Array.sortは安定ソートなので各グループ内の順序は上記のまま保たれる）
  if (!state.favoritesOnly) {
    const favSet = getFavorites();
    list.sort((a, b) => Number(favSet.has(b.id)) - Number(favSet.has(a.id)));
  }
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
      const fav = isFavorite(ind.id);
      const surprise = surpriseInfo(computeSurprise(ind.points));
      const surpriseBadge =
        surprise && surprise.level !== "low"
          ? `<span class="card__surprise card__surprise--${surprise.level}">⚡ ${surprise.label}</span>`
          : "";
      const prevLabel = ind.frequency === "quarterly" ? "前期比" : ind.frequency === "daily" ? "前日比" : "前月比";
      return `
      <div class="card" data-id="${ind.id}" role="button" tabindex="0">
        <div class="card__top">
          <span class="tag" style="background:${color}">${ind.category}</span>
          <div class="card__top-right">
            <button type="button" class="card__fav${fav ? " is-active" : ""}" data-fav-id="${ind.id}" aria-pressed="${fav}" aria-label="${fav ? "お気に入りから外す" : "お気に入りに追加"}">${fav ? "★" : "☆"}</button>
            <span class="stars" title="重要度 ${ind.importance}/5">${starsText(ind.importance)}</span>
          </div>
        </div>
        <h3 class="card__name">${ind.name}</h3>
        <div class="card__valrow">
          <span class="card__value">${num}</span>
          <span class="card__unit">${unit}</span>
          <span class="card__period">${s.latest.t}${s.latest.provisional ? "（速報）" : ""}</span>
        </div>
        ${sparkline(ind.points, color, ind.referenceLines)}
        <div class="card__changes">
          <span>${prevLabel} <b class="${dPrev.cls}">${dPrev.text}</b></span>
          <span>前年比 <b class="${dYoy.cls}">${dYoy.text}</b></span>
        </div>
        ${surpriseBadge}
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(el.dataset.id);
      }
    });
  });
  grid.querySelectorAll(".card__fav").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.favId;
      const nowFav = toggleFavorite(id);
      btn.classList.toggle("is-active", nowFav);
      btn.textContent = nowFav ? "★" : "☆";
      btn.setAttribute("aria-pressed", String(nowFav));
      btn.setAttribute("aria-label", nowFav ? "お気に入りから外す" : "お気に入りに追加");
      if (state.favoritesOnly) renderGrid();
      if (currentInd?.id === id) updateDetailFavButton();
    });
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
      renderCategoryGuide();
    });
  });
}

/** 選択中カテゴリの「まず見る／次に見る」ガイドを表示 */
function renderCategoryGuide() {
  const el = document.getElementById("category-guide");
  const guide = state.data && state.category !== "すべて" ? state.data.categoryGuides?.[state.category] : null;
  if (!guide) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const findInd = (id) => state.data.indicators.find((i) => i.id === id);
  const row = (label, cls, entry) => {
    const ind = findInd(entry?.id);
    if (!ind) return "";
    return `
      <div class="category-guide__row">
        <span class="category-guide__badge ${cls}">${label}</span>
        <div class="category-guide__body">
          <button class="category-guide__link" data-id="${ind.id}">${ind.name}　${starsText(ind.importance)}</button>
          <p>${entry.reason}</p>
        </div>
      </div>`;
  };

  el.innerHTML = row("① まず見る", "category-guide__badge--first", guide.first) + row("② 次に見る（補完）", "category-guide__badge--second", guide.second);
  el.hidden = false;
  el.querySelectorAll(".category-guide__link").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

/* ---------- release calendar ---------- */

function shiftMonth(d, delta) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

function renderCalendar() {
  const el = document.getElementById("release-calendar");
  if (!el || !state.data) return;

  const byDate = new Map();
  state.data.indicators.forEach((ind) => {
    if (!ind.nextRelease) return;
    if (!byDate.has(ind.nextRelease)) byDate.set(ind.nextRelease, []);
    byDate.get(ind.nextRelease).push(ind);
  });

  const year = state.calMonth.getUTCFullYear();
  const month = state.calMonth.getUTCMonth();
  const startOffset = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=日
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month, 1 - startOffset + i));
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({ d, dateStr, inMonth: d.getUTCMonth() === month, items: byDate.get(dateStr) || [] });
  }
  // 最終週が丸ごと翌月かつ発表予定もなければ間引く（5週で収まる月がほとんどのため）
  while (cells.length > 35) {
    const lastWeek = cells.slice(-7);
    if (lastWeek.some((c) => c.inMonth || c.items.length)) break;
    cells.length -= 7;
  }

  const weekdayHtml = ["日", "月", "火", "水", "木", "金", "土"].map((w) => `<span>${w}</span>`).join("");

  const cellsHtml = cells
    .map((c) => {
      const dow = c.d.getUTCDay();
      const cls = [
        "calendar__cell",
        c.inMonth ? "" : "calendar__cell--outside",
        c.dateStr === todayStr ? "calendar__cell--today" : "",
        dow === 0 ? "calendar__cell--sun" : dow === 6 ? "calendar__cell--sat" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const pills = c.items
        .map((ind) => {
          const color = catColor(ind.category);
          const estMark = ind.nextReleaseKind === "estimate" ? "（推定）" : "";
          return `<button type="button" class="calendar__pill" style="background:${color}22;color:${color};border-color:${color}66" data-id="${ind.id}" title="${ind.name}${estMark}">${ind.shortName}</button>`;
        })
        .join("");
      return `
        <div class="${cls}">
          <span class="calendar__daynum">${c.d.getUTCDate()}</span>
          <div class="calendar__pills">${pills}</div>
        </div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="calendar__head">
      <h2 class="calendar__title">📅 発表予定カレンダー</h2>
      <div class="calendar__nav">
        <button type="button" class="calendar__navbtn" id="cal-prev" aria-label="前月">←</button>
        <span class="calendar__month">${year}年${month + 1}月</span>
        <button type="button" class="calendar__navbtn" id="cal-next" aria-label="次月">→</button>
      </div>
    </div>
    <div class="calendar__weekdays">${weekdayHtml}</div>
    <div class="calendar__grid">${cellsHtml}</div>
    <p class="calendar__note">※ 日経平均株価以外はFREDのような公式メタデータがないため、発表スケジュールの目安からの推定日です。詳しくは<a href="./guide.html">このツールの見方</a>を参照。</p>`;

  el.querySelectorAll(".calendar__pill").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
  document.getElementById("cal-prev").addEventListener("click", () => {
    state.calMonth = shiftMonth(state.calMonth, -1);
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    state.calMonth = shiftMonth(state.calMonth, 1);
    renderCalendar();
  });
}

/* ---------- data export ---------- */

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(ind) {
  const rows = ind.points.map((p) => `${p.t},${p.value}`);
  return ["date,value", ...rows].join("\n");
}

function exportCSV(ind) {
  downloadFile(`${ind.id}.csv`, toCSV(ind), "text/csv;charset=utf-8");
}

function exportJSON(ind) {
  const payload = {
    id: ind.id,
    name: ind.name,
    shortName: ind.shortName,
    category: ind.category,
    unit: ind.unit,
    unitLabel: ind.unitLabel,
    frequency: ind.frequency,
    seasonalAdjustment: ind.seasonalAdjustment,
    source: ind.source,
    points: ind.points,
  };
  downloadFile(`${ind.id}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
}

/* ---------- detail dialog ---------- */

let chart = null;
let currentInd = null;
let currentRange = "10y";
let compareInd = null;

const RANGES = [
  { key: "1y", label: "1年", years: 1 },
  { key: "3y", label: "3年", years: 3 },
  { key: "5y", label: "5年", years: 5 },
  { key: "10y", label: "10年", years: 10 },
  { key: "all", label: "全期間", years: Infinity },
];

/** 詳細モーダルの☆/★ボタンを現在の指標のお気に入り状態に合わせて更新 */
function updateDetailFavButton() {
  if (!currentInd) return;
  const btn = document.getElementById("d-fav");
  const fav = isFavorite(currentInd.id);
  btn.textContent = fav ? "★" : "☆";
  btn.classList.toggle("is-active", fav);
  btn.setAttribute("aria-pressed", String(fav));
  btn.setAttribute("aria-label", fav ? "お気に入りから外す" : "お気に入りに追加");
}

function openDetail(id) {
  const ind = state.data.indicators.find((i) => i.id === id);
  if (!ind) return;
  currentInd = ind;
  currentRange = "10y";
  compareInd = null;

  const compareSelect = document.getElementById("d-compare");
  const byCat = (i) => CATEGORIES.indexOf(i.category);
  const otherInds = state.data.indicators
    .filter((i) => i.id !== ind.id)
    .sort((a, b) => byCat(a) - byCat(b) || a.name.localeCompare(b.name, "ja"));
  compareSelect.innerHTML =
    `<option value="">選択しない</option>` +
    otherInds.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
  compareSelect.value = "";

  const color = catColor(ind.category);
  const s = ind.summary;
  document.getElementById("d-tag").textContent = ind.category;
  document.getElementById("d-tag").style.background = color;
  document.getElementById("d-stars").textContent = starsText(ind.importance);
  document.getElementById("d-stars").title = `重要度 ${ind.importance}/5`;
  updateDetailFavButton();
  document.getElementById("d-name").textContent = ind.name;
  document.getElementById("d-desc").textContent = ind.description;

  const f = (v) => {
    const { num, unit } = fmtValue(v, ind);
    return `${num} ${unit}`;
  };
  const surprise = surpriseInfo(computeSurprise(ind.points));
  const surpriseText = surprise
    ? `${surprise.level !== "low" ? "⚡ " : ""}${surprise.label}（z=${surprise.z.toFixed(1)}）`
    : "算出不可（データ不足）";
  document.getElementById("d-stats").innerHTML = `
    <div><span>最新（${s.latest.t}）</span><b>${f(s.latest.value)}</b></div>
    <div><span>過去最大（${s.max.t}）</span><b>${f(s.max.value)}</b></div>
    <div><span>過去最小（${s.min.t}）</span><b>${f(s.min.value)}</b></div>
    <div><span>データ数</span><b>${s.count}点</b></div>
    <div><span>季節調整</span><b>${ind.seasonalAdjustment}</b></div>
    <div><span>変化の大きさ</span><b>${surpriseText}</b></div>`;
  document.getElementById("d-stats-note").textContent =
    "⚡は市場予想との比較ではなく、指標自身の過去の変化幅の分布から見た統計的な目安（|z|≥1.5）です。";

  const j = ind.judgment;
  document.getElementById("d-judgment").innerHTML = j
    ? `
    <h3>判断の目安</h3>
    <p class="judgment__summary">${j.summary}</p>
    <div class="judgment__grid">
      <div class="judgment__good"><span>良いとされる状態</span><p>${j.goodWhen}</p></div>
      <div class="judgment__bad"><span>注意が必要な状態</span><p>${j.badWhen}</p></div>
    </div>
    <p class="judgment__caveat">⚠️ ${j.caveat}</p>`
    : "";

  const releaseParts = [];
  if (ind.nextReleaseKind) {
    const nextText = ind.nextRelease ? fmtJpDateWithWeekday(ind.nextRelease) : "未定";
    const suffix = ind.nextReleaseKind === "estimate" ? "（推定）" : "";
    releaseParts.push(`<p>📅 次回発表予定日：<b>${nextText}${suffix}</b></p>`);
  }
  if (ind.releaseSchedule) {
    releaseParts.push(`<p class="detail__release-note">発表スケジュールの目安：${ind.releaseSchedule}</p>`);
  }
  document.getElementById("d-release").innerHTML = releaseParts.join("");

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

  const src = ind.source;
  const srcCode = src.indicatorCode
    ? `　系列コード <code>${src.indicatorCode}</code>`
    : src.sourceUrl
      ? `　<a href="${src.sourceUrl}" target="_blank" rel="noopener">公表元ページ</a>`
      : "";
  document.getElementById("d-source").innerHTML =
    `出典：${src.provider}／${src.statName}${srcCode}　単位：${ind.unitLabel}`;

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
  const labelText = css.getPropertyValue("--surface").trim();
  const maColor = refColor("target");

  const datasets = [
    {
      label: ind.movingAverage ? "実績" : ind.shortName,
      data: pts,
      borderColor: color,
      backgroundColor: color + "20",
      borderWidth: 1.8,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.15,
    },
  ];

  if (ind.movingAverage) {
    const win = ind.movingAverage.window;
    const maAll = [];
    for (let i = win - 1; i < ind.points.length; i++) {
      const slice = ind.points.slice(i - win + 1, i + 1);
      const avg = slice.reduce((sum, p) => sum + p.value, 0) / win;
      maAll.push({ x: parseT(ind.points[i].t), y: avg });
    }
    datasets.push({
      label: ind.movingAverage.label,
      data: maAll.filter((p) => Number.isFinite(p.x) && p.x >= cutoff),
      borderColor: maColor,
      borderWidth: 2,
      borderDash: [5, 3],
      pointRadius: 0,
      pointHoverRadius: 3,
      fill: false,
      tension: 0.15,
    });
  }
  if (compareInd) {
    // 比較指標がメイン指標と同じカテゴリだと色が被るため、カテゴリ色ではなく常に高コントラストな
    // テーマ文字色（黒／白）を使い、破線と合わせてどのカテゴリでも視認できるようにする
    const compareColor = css.getPropertyValue("--text").trim();
    const cPts = compareInd.points
      .map((p) => ({ x: parseT(p.t), y: p.value }))
      .filter((p) => Number.isFinite(p.x) && p.x >= cutoff);
    datasets.push({
      label: compareInd.shortName,
      data: cPts,
      borderColor: compareColor,
      backgroundColor: "transparent",
      borderWidth: 1.8,
      borderDash: [4, 2],
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.15,
      yAxisID: "y1",
      _ind: compareInd,
    });
  }
  const multi = datasets.length > 1;

  const annotations = {};
  const recessionColor = css.getPropertyValue("--recession").trim();
  RECESSIONS.forEach((rec, i) => {
    const xMin = parseT(rec.start);
    const xMax = monthEndMs(rec.end);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax < cutoff) return;
    annotations["recession" + i] = {
      type: "box",
      xMin,
      xMax,
      backgroundColor: recessionColor,
      borderWidth: 0,
      drawTime: "beforeDatasetsDraw",
    };
  });
  (ind.referenceLines || []).forEach((rl, i) => {
    const c = refColor(rl.kind);
    annotations["ref" + i] = {
      type: "line",
      yMin: rl.value,
      yMax: rl.value,
      borderColor: c,
      borderWidth: rl.kind === "target" ? 1.75 : 1.25,
      borderDash: rl.kind === "context" ? [2, 3] : rl.kind === "neutral" ? [6, 4] : [],
      label: {
        display: true,
        content: rl.label,
        position: "start",
        color: c,
        backgroundColor: labelText,
        font: { size: 10, weight: "600" },
        padding: 4,
        borderRadius: 4,
      },
    };
  });

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("d-canvas"), {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // 比較指標は日付範囲・頻度が異なりうるため、index一致ではなくx値の近さで個別に対応点を探す
      interaction: compareInd ? { mode: "nearest", axis: "x", intersect: false } : { mode: "index", intersect: false },
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
        ...(compareInd
          ? {
              y1: {
                position: "right",
                ticks: { color: tick },
                grid: { drawOnChartArea: false },
              },
            }
          : {}),
      },
      plugins: {
        legend: multi
          ? { display: true, position: "top", align: "end", labels: { color: tick, boxWidth: 14, font: { size: 11 } } }
          : { display: false },
        annotation: { annotations },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = new Date(items[0].parsed.x);
              if (ind.frequency === "quarterly") {
                return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
              }
              if (ind.frequency === "daily") {
                return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
              }
              return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            },
            label: (item) => {
              const refInd = item.dataset._ind || ind;
              const { num, unit } = fmtValue(item.parsed.y, refInd);
              return multi ? `${item.dataset.label}：${num} ${unit}` : `${num} ${unit}`;
            },
          },
        },
      },
    },
  });
}

/* ---------- init ---------- */

async function init() {
  initTheme(() => {
    renderGrid(); // カテゴリ色・目安ラインのSVGは属性描画のため色変更を反映し直す
    renderCalendar(); // カレンダーのピル色も同様にインラインstyleで描画しているため再描画
    if (chart) drawChart(); // 開いている詳細グラフの配色も更新
  });
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

  document.getElementById("d-fav").addEventListener("click", () => {
    if (!currentInd) return;
    toggleFavorite(currentInd.id);
    updateDetailFavButton();
    renderGrid();
  });
  document.getElementById("fav-filter").addEventListener("click", (e) => {
    state.favoritesOnly = !state.favoritesOnly;
    e.currentTarget.setAttribute("aria-pressed", String(state.favoritesOnly));
    renderGrid();
  });
  document.getElementById("d-download-csv").addEventListener("click", () => {
    if (currentInd) exportCSV(currentInd);
  });
  document.getElementById("d-download-json").addEventListener("click", () => {
    if (currentInd) exportJSON(currentInd);
  });
  document.getElementById("d-compare").addEventListener("change", (e) => {
    const id = e.target.value;
    compareInd = id ? state.data.indicators.find((i) => i.id === id) : null;
    drawChart();
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
  renderCategoryGuide();
  renderCalendar();
}

init();
