/**
 * 「マーケットボード」（経済状況サマリーの最上部に出す主要6銘柄の最新値）のデータを
 * public/data/market.json に書き出す。日米どちらのサイトにも同じ6銘柄を出すため、このファイルは日米共通
 * （us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 *
 *   node scripts/fetch-market-board.mjs
 *
 * 指標カード用のデータ（indicators.json）とは独立に、直近の値だけを軽く取り直す（毎回の自動更新で実行）。
 * 取得元（いずれも登録・APIキー不要）：
 *   ドル円         日本銀行 時系列統計データ検索サイト（東京17時、fetch-boj-fx-daily.mjs）
 *   米10年国債利回り / WTI原油 / S&P500 / 日経平均株価   FRED（DGS10 / DCOILWTICO / SP500 / NIKKEI225）
 *   日本10年国債利回り  財務省「国債金利情報」CSV（当月の jgbcm.csv ＋ 前月までの data/jgbcm_all.csv）
 * 銘柄ごとに失敗しても他は更新し、失敗した銘柄は前回の値をそのまま残す。
 * 各銘柄は「最新値・前営業日の値・直近30営業日の推移」を持つ。表示用の単位・桁数・変化の出し方もここで定義する。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fetchUsdJpyDaily } from "./fetch-boj-fx-daily.mjs";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data");
const OUT = resolve(OUT_DIR, "market.json");
const SPARK_POINTS = 30;
const UA = { "User-Agent": "economic-tracker" };

async function fetchFred(seriesId) {
  const since = new Date(Date.now() - 75 * 86400e3).toISOString().slice(0, 10);
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${since}`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const points = [];
  for (const line of (await res.text()).trim().split("\n").slice(1)) {
    const [t, raw] = line.split(",");
    const value = Number(raw);
    if (t && raw && raw.trim() !== "." && Number.isFinite(value)) points.push({ t, value });
  }
  return points;
}

/** 和暦の日付（R8.10.15 / H30.1.4 / S49.9.24）→ "YYYY-MM-DD" */
function parseWareki(s) {
  const m = /^([RHS])(\d+)\.(\d+)\.(\d+)$/.exec(s.trim());
  if (!m) return null;
  const base = { R: 2018, H: 1988, S: 1925 }[m[1]];
  return `${base + Number(m[2])}-${String(m[3]).padStart(2, "0")}-${String(m[4]).padStart(2, "0")}`;
}

async function fetchMofCsv(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = new TextDecoder("shift_jis").decode(await res.arrayBuffer());
  const rows = text.split(/\r?\n/).map((l) => l.split(","));
  const header = rows.find((r) => r[0] === "基準日");
  const col = header ? header.indexOf("10年") : -1;
  if (col < 0) throw new Error("財務省CSV：10年の列が見つかりません");
  const points = [];
  for (const r of rows) {
    const t = parseWareki(r[0] ?? "");
    const value = Number(r[col]);
    if (t && r[col] && r[col].trim() !== "-" && Number.isFinite(value)) points.push({ t, value });
  }
  return points;
}

async function fetchJgb10y() {
  const base = "https://www.mof.go.jp/jgbs/reference/interest_rate/";
  const [current, history] = await Promise.all([fetchMofCsv(base + "jgbcm.csv"), fetchMofCsv(base + "data/jgbcm_all.csv")]);
  const byDate = new Map();
  for (const p of [...history, ...current]) byDate.set(p.t, p);
  return [...byDate.values()].sort((a, b) => a.t.localeCompare(b.t));
}

/**
 * change：変化の出し方。"pct"＝前営業日比の変化額と変化率（%）、"pt"＝変化額のみ（利回りは%ポイント）。
 * detailIds：クリックで開く指標詳細（サイトに存在するもののうち最初のもの。無ければ押せない表示）。
 */
const ITEMS = [
  { id: "usdjpy", label: "ドル円", unit: "円", digits: 2, change: "pct", detailIds: ["usdjpy"], source: "日本銀行（東京17時）", get: fetchUsdJpyDaily },
  { id: "us10y", label: "米10年国債利回り", unit: "%", digits: 2, change: "pt", detailIds: ["treasury_10y_us"], source: "FRED（米財務省）", get: () => fetchFred("DGS10") },
  { id: "jgb10y", label: "日本10年国債利回り", unit: "%", digits: 3, change: "pt", detailIds: [], source: "財務省", get: fetchJgb10y },
  { id: "wti", label: "WTI原油", unit: "ドル", digits: 2, change: "pct", detailIds: ["wti_oil_us"], source: "FRED（EIA）", get: () => fetchFred("DCOILWTICO") },
  { id: "sp500", label: "S&P500", unit: "", digits: 2, change: "pct", detailIds: ["sp500_us"], source: "FRED（S&P Dow Jones Indices）", get: () => fetchFred("SP500") },
  { id: "nikkei225", label: "日経平均株価", unit: "円", digits: 2, change: "pct", detailIds: ["nikkei225"], source: "FRED（日本経済新聞社）", get: () => fetchFred("NIKKEI225") },
];

function toItem(def, points) {
  const pts = points.filter((p) => Number.isFinite(p.value)).sort((a, b) => a.t.localeCompare(b.t));
  if (pts.length < 2) throw new Error("値が2点以上取得できませんでした");
  const latest = pts.at(-1);
  const prev = pts.at(-2);
  const { get, ...meta } = def;
  return {
    ...meta,
    latest: { t: latest.t, value: latest.value },
    prev: { t: prev.t, value: prev.value },
    spark: pts.slice(-SPARK_POINTS).map((p) => p.value),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await readFile(OUT, "utf8")).items ?? [];
  } catch {
    // 初回
  }
  const items = [];
  let failed = 0;
  for (const def of ITEMS) {
    try {
      const item = toItem(def, await def.get());
      items.push(item);
      console.log(`- ${def.id} ... OK (${item.latest.t} = ${item.latest.value})`);
    } catch (err) {
      failed++;
      console.log(`- ${def.id} ... 失敗: ${err.message}`);
      const old = existing.find((e) => e.id === def.id);
      if (old) items.push(old); // 失敗した銘柄は前回の値を残す
    }
  }
  if (!items.length) {
    console.error("全銘柄の取得に失敗しました。既存の market.json は変更しません。");
    process.exit(1);
  }
  const before = JSON.stringify(existing);
  if (JSON.stringify(items) !== before) {
    await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 1) + "\n", "utf8");
    console.log(`書き出し: ${OUT}`);
  } else {
    console.log("変更なし");
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
