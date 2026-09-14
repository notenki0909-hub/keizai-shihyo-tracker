/**
 * 統計ダッシュボードAPI（e-Stat・利用登録不要）から全指標の時系列を取得し、
 * public/data/indicators.json に書き出す。
 *
 *   node scripts/fetch-indicators.mjs
 *
 * 毎回全期間を取り直すため「蓄積」は不要（速報値の改定にも自動追従）。
 * 変更履歴は git の差分で追える。
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { INDICATORS, CATEGORY_GUIDES } from "./indicators.config.mjs";
import { fetchForeignInvestorFlow } from "./fetch-jpx-investor-type.mjs";
import { fetchUsdJpyDaily } from "./fetch-boj-fx-daily.mjs";
import { fetchFredSeries } from "./fetch-fred-series.mjs";
import { fetchNextReleaseDate } from "./fetch-fred-release-date.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/data");
const BASE = "https://dashboard.e-stat.go.jp/api/1.0/Json/getData";

const asArr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** e-Stat 時期コード → { key, date }（月次: YYYYMM00 / 四半期: YYYYnQ00） */
function parseTime(code) {
  const s = String(code);
  const q = s.match(/^(\d{4})(\d)Q00$/);
  if (q) {
    const year = +q[1];
    const quarter = +q[2];
    const month = (quarter - 1) * 3 + 1;
    return { key: `${year} Q${quarter}`, date: `${year}-${String(month).padStart(2, "0")}-01` };
  }
  const m = s.match(/^(\d{4})(\d{2})00$/);
  if (m) {
    return { key: `${m[1]}-${m[2]}`, date: `${m[1]}-${m[2]}-01` };
  }
  const y = s.match(/^(\d{4})CY00$/);
  if (y) return { key: m[1], date: `${y[1]}-01-01` };
  return { key: s, date: null };
}

/* ---------- 次回発表予定日の推定 ---------- */

function lastDayOfMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0));
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function nextBusinessDayFromToday() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d;
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

/** "2026-09-10" / "2026-09" / "2026 Q2" → その期間の初日（UTC） */
function periodStartFromT(t) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{4})-(\d{2})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, 1));
  m = /^(\d{4}) Q(\d)$/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], (+m[2] - 1) * 3, 1));
  return null;
}

/**
 * releaseSchedule の目安（例：「対象月の翌月末ごろ」）から、次回発表予定日を推定する。
 * FRED（日経平均のみ）のような公式メタデータが存在しない e-Stat・JPX・BOJ系列向け。
 * 「毎営業日・随時更新」で明確な発表周期を持たない系列（無担保コールレート・10年国債利回り・
 * TOPIX＝いずれも月末値を採用しているだけの継続更新データ）には nextReleaseRule を設定せず、
 * 推定値は出さない（不正確な断定より非表示の方が誠実という方針、市場予想と同じ考え方）。
 */
function estimateNextRelease(ind, latestT) {
  const rule = ind.nextReleaseRule;
  if (!rule) return null;

  if (rule.type === "nextBusinessDay") {
    return toISO(nextBusinessDayFromToday());
  }

  if (rule.type === "periodLag") {
    const periodStart = periodStartFromT(latestT);
    if (!periodStart) return null;
    let periodEnd;
    if (ind.frequency === "quarterly") {
      const q = Math.floor(periodStart.getUTCMonth() / 3);
      periodEnd = lastDayOfMonth(periodStart.getUTCFullYear(), (q + 1) * 3 + 2);
    } else {
      periodEnd = lastDayOfMonth(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1);
    }
    let release = addDays(periodEnd, rule.daysAfterPeriodEnd);
    // 官公庁は土日に発表しないため、土日に当たった場合は翌営業日（月曜）にずらす
    // （祝日までは考慮していないため、あくまで目安）
    if (release.getUTCDay() === 6) release = addDays(release, 2);
    if (release.getUTCDay() === 0) release = addDays(release, 1);
    return toISO(release);
  }

  return null; // rule.type === "fred" はFRED本体から別途取得するためここでは扱わない
}

/**
 * 2系列から比率（分子÷分母）の時系列を計算する（例：NT倍率＝日経平均÷TOPIX）。
 * 分母（月次想定）の各時点について、その月内で最新の分子（日次想定）の値を対応させる。
 */
function computeRatioSeries(numeratorPoints, denominatorPoints) {
  const out = [];
  for (const d of denominatorPoints) {
    const prefix = d.t.slice(0, 7); // "YYYY-MM"
    const candidates = numeratorPoints.filter((p) => p.t.startsWith(prefix));
    const matched = candidates.at(-1);
    if (!matched || !Number.isFinite(d.value) || d.value === 0) continue;
    out.push({ t: d.t, value: +(matched.value / d.value).toFixed(3) });
  }
  return out;
}

async function fetchSeries(ind, { retries = 3 } = {}) {
  const { indicatorCode, cycle, rank, sa } = ind.api;
  const url =
    `${BASE}?Lang=JP&IndicatorCode=${indicatorCode}&RegionCode=00000` +
    `&Cycle=${cycle}&RegionalRank=${rank}&IsSeasonalAdjustment=${sa}`;

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const g = json.GET_STATS;
      if (!g || g.RESULT?.status !== "0") {
        throw new Error(`API status: ${g?.RESULT?.errorMsg ?? "unknown"}`);
      }
      const rows = asArr(g.STATISTICAL_DATA?.DATA_INF?.DATA_OBJ)
        .map((o) => o.VALUE)
        .filter(Boolean);
      if (!rows.length) throw new Error("0 データ点");

      const points = rows
        .map((r) => {
          const { key, date } = parseTime(r["@time"]);
          const value = Number(r.$);
          const p = { t: key, date, value };
          if (r["@isProvisional"] === "1") p.provisional = true;
          return p;
        })
        .filter((p) => Number.isFinite(p.value) && p.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      return points;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(attempt * 1200);
    }
  }
  throw lastErr;
}

/** 直近値・前期比・前年比などの派生指標 */
function summarize(points, frequency) {
  if (!points.length) return null;
  const n = points.length;
  const latest = points[n - 1];
  const prev = n >= 2 ? points[n - 2] : null;

  let yearAgo;
  if (frequency === "daily") {
    // 日次は祝休日でズレるため、365日前以前で最も近い点を探す
    const targetMs = new Date(latest.date).getTime() - 365 * 86400000;
    for (let i = n - 1; i >= 0; i--) {
      if (new Date(points[i].date).getTime() <= targetMs) {
        yearAgo = points[i];
        break;
      }
    }
  } else {
    const lag = frequency === "quarterly" ? 4 : 12;
    yearAgo = n > lag ? points[n - 1 - lag] : null;
  }

  const diff = (a, b) => (a && b ? +(a.value - b.value).toFixed(4) : null);
  const strip = (p) => (p ? { t: p.t, value: p.value } : null);
  return {
    latest: { t: latest.t, value: latest.value, provisional: !!latest.provisional },
    changeFromPrev: diff(latest, prev),
    changeFromYearAgo: diff(latest, yearAgo),
    min: strip(points.reduce((m, p) => (p.value < m.value ? p : m))),
    max: strip(points.reduce((m, p) => (p.value > m.value ? p : m))),
    count: n,
    start: points[0].t,
  };
}

/**
 * 過去の変化幅（前期比相当）の分布に対して、直近の変化がどれくらい珍しいかを表すz-score。
 * フロントエンド（main.js の computeSurprise）と同じロジック。ビルド時点のサプライズ判定に使う。
 */
function computeSurpriseZ(points) {
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

/**
 * 全指標を機械的に集計し、「現在の経済状況サマリー」を生成する（ルールベース、AI不使用）。
 * - improving/worsening: betterWhen と前期比の符号だけで判定する単純な集計（因果関係の解説はしない）
 * - statusFindings: 目安ライン（referenceLines）に対して現在どちら側にあるかの機械的な判定
 * - surpriseFindings: 指標自身の過去の変化幅の分布から見て、直近の変化が統計的に珍しいかどうか
 * すべて公開統計の再集計であり、投資助言ではない旨を運用側（フロント）で明記すること。
 */
function buildEconSummary(indicators) {
  let improving = 0;
  let worsening = 0;
  let neutralCount = 0;
  const improvingList = [];
  const worseningList = [];
  const neutralList = [];
  const statusFindings = [];
  const surpriseFindings = [];

  for (const ind of indicators) {
    const s = ind.summary;
    if (!s) continue;

    const nameEntry = { id: ind.id, name: ind.name, category: ind.category };
    if (ind.betterWhen !== "neutral" && s.changeFromPrev != null && s.changeFromPrev !== 0) {
      const good = s.changeFromPrev > 0 === (ind.betterWhen === "up");
      if (good) {
        improving++;
        improvingList.push(nameEntry);
      } else {
        worsening++;
        worseningList.push(nameEntry);
      }
    } else {
      neutralCount++;
      neutralList.push(nameEntry);
    }

    if (ind.betterWhen !== "neutral") {
      for (const line of ind.referenceLines || []) {
        if (line.kind !== "neutral" && line.kind !== "target") continue;
        const above = s.latest.value >= line.value;
        const concerning = ind.betterWhen === "up" ? !above : above;
        if (!concerning) continue;
        // detail: 「指標名：」に続けて読める断片。text: 単独でも読める完全な文。
        statusFindings.push({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          detail: `目安「${line.label}」を${above ? "上回っており" : "下回っており"}、注意が必要な水準です。`,
          text: `${ind.name}は現在、目安「${line.label}」を${above ? "上回って" : "下回って"}おり、注意が必要な水準です。`,
        });
      }
    }

    const z = computeSurpriseZ(ind.points ?? []);
    if (z != null && Number.isFinite(z) && Math.abs(z) >= 1.5) {
      const level = Math.abs(z) >= 2.5 ? "high" : "mid";
      const levelWord = level === "high" ? "非常に大きな" : "やや大きな";
      surpriseFindings.push({
        id: ind.id,
        name: ind.name,
        category: ind.category,
        z: +z.toFixed(1),
        level,
        detail: `${levelWord}変化が見られました（過去の変動幅と比べて統計的に珍しい動き、z=${z.toFixed(1)}）。`,
        text: `${ind.name}で${levelWord}変化が見られました（過去の変動幅と比べて統計的に珍しい動き、z=${z.toFixed(1)}）。`,
      });
    }
  }

  surpriseFindings.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  const total = improving + worsening + neutralCount;
  const headline = `${total}指標中、改善傾向が${improving}件、悪化傾向が${worsening}件、横ばい・中立が${neutralCount}件です。`;

  return {
    generatedAt: new Date().toISOString(),
    stats: { total, improving, worsening, neutral: neutralCount, surpriseCount: surpriseFindings.length },
    headline,
    improvingList,
    worseningList,
    neutralList,
    statusFindings: statusFindings.slice(0, 8),
    surpriseFindings: surpriseFindings.slice(0, 6),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const out = [];
  const failures = [];

  for (const ind of INDICATORS) {
    process.stdout.write(`- ${ind.id} ... `);
    try {
      const provider = ind.api.provider ?? "estat";
      let points, source;
      switch (provider) {
        case "jpx-investor-type":
          points = await fetchForeignInvestorFlow();
          source = { provider: "投資部門別売買状況（JPX）", statName: ind.api.statName, sourceUrl: ind.api.sourceUrl };
          break;
        case "boj-fx-daily":
          points = await fetchUsdJpyDaily();
          source = { provider: "日本銀行 時系列統計データ検索サイト", statName: ind.api.statName, sourceUrl: ind.api.sourceUrl };
          break;
        case "fred-csv":
          points = await fetchFredSeries(ind.api.seriesId);
          source = { provider: "FRED（セントルイス連邦準備銀行）", statName: ind.api.statName, sourceUrl: ind.api.sourceUrl };
          break;
        case "computed-ratio": {
          const numInd = out.find((o) => o.id === ind.api.numerator);
          const denInd = out.find((o) => o.id === ind.api.denominator);
          if (!numInd || !denInd) {
            throw new Error(`比率計算に必要な指標が未取得です（${ind.api.numerator} / ${ind.api.denominator}）`);
          }
          points = computeRatioSeries(numInd.points, denInd.points);
          source = { provider: "本ツールによる計算", statName: ind.api.statName };
          break;
        }
        default:
          points = await fetchSeries(ind);
          source = { provider: "統計ダッシュボード（e-Stat）", statName: ind.api.statName, indicatorCode: ind.api.indicatorCode };
      }

      let nextRelease = null;
      let nextReleaseKind = null; // "official"（FRED公式）/ "estimate"（releaseScheduleからの推定）/ null（対象外）
      const rule = ind.nextReleaseRule;
      if (rule?.type === "fred") {
        nextReleaseKind = "official";
        try {
          nextRelease = await fetchNextReleaseDate(ind.api.seriesId);
        } catch {
          // 取得失敗時は nextRelease: null のまま（フロントは「未定」表示）
        }
      } else if (rule) {
        nextReleaseKind = "estimate";
        nextRelease = estimateNextRelease(ind, points.at(-1).t);
      }

      out.push({
        id: ind.id,
        name: ind.name,
        shortName: ind.shortName,
        category: ind.category,
        unit: ind.unit,
        unitLabel: ind.unitLabel,
        frequency: ind.frequency,
        seasonalAdjustment: ind.seasonalAdjustment,
        betterWhen: ind.betterWhen,
        importance: ind.importance,
        description: ind.description,
        judgment: ind.judgment,
        referenceLines: ind.referenceLines ?? [],
        movingAverage: ind.movingAverage ?? null,
        releaseSchedule: ind.releaseSchedule,
        nextRelease, // "YYYY-MM-DD" または null。nextReleaseKindが null の指標では常にnull（掲載対象外）
        nextReleaseKind, // "official" | "estimate" | null
        source,
        summary: summarize(points, ind.frequency),
        // date は t（"2026-07" / "2026 Q2"）から復元できるため出力では省く
        points: points.map((p) => (p.provisional ? { t: p.t, value: p.value, provisional: true } : { t: p.t, value: p.value })),
      });
      console.log(`OK (${points.length}点, 最新 ${points.at(-1).t}=${points.at(-1).value})`);
    } catch (err) {
      console.log(`失敗: ${err.message}`);
      failures.push({ id: ind.id, error: err.message });
    }
    await sleep(400);
  }

  if (!out.length) {
    console.error("\n全指標の取得に失敗しました。既存の JSON は変更しません。");
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "統計ダッシュボード（e-Stat） https://dashboard.e-stat.go.jp/",
    note: "各系列は毎回全期間を再取得しています（速報値の改定を反映）。",
    indicatorCount: out.length,
    failures,
    categoryGuides: CATEGORY_GUIDES,
    econSummary: buildEconSummary(out),
    indicators: out,
  };

  const file = resolve(OUT_DIR, "indicators.json");
  await writeFile(file, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`\n書き出し: ${file}`);
  console.log(`成功 ${out.length} / ${INDICATORS.length} 指標`);
  if (failures.length) {
    console.log(`失敗: ${failures.map((f) => f.id).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
