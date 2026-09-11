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
import { INDICATORS } from "./indicators.config.mjs";
import { fetchForeignInvestorFlow } from "./fetch-jpx-investor-type.mjs";

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
  const lag = frequency === "quarterly" ? 4 : 12;
  const yearAgo = n > lag ? points[n - 1 - lag] : null;

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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const out = [];
  const failures = [];

  for (const ind of INDICATORS) {
    process.stdout.write(`- ${ind.id} ... `);
    try {
      const isJpx = ind.api.provider === "jpx-investor-type";
      const points = isJpx ? await fetchForeignInvestorFlow() : await fetchSeries(ind);
      const source = isJpx
        ? { provider: "投資部門別売買状況（JPX）", statName: ind.api.statName, sourceUrl: ind.api.sourceUrl }
        : { provider: "統計ダッシュボード（e-Stat）", statName: ind.api.statName, indicatorCode: ind.api.indicatorCode };

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
        description: ind.description,
        judgment: ind.judgment,
        referenceLines: ind.referenceLines ?? [],
        movingAverage: ind.movingAverage ?? null,
        releaseSchedule: ind.releaseSchedule,
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
