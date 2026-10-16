/**
 * 「マーケットボード」（経済状況サマリーの最上部に出す主要6銘柄の最新値）のデータを
 * public/data/market.json に書き出す。日米どちらのサイトにも同じ6銘柄を出すため、このファイルは日米共通
 * （us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 *
 *   node scripts/fetch-market-board.mjs
 *
 * 指標カード用のデータ（indicators.json）とは独立に、直近の値だけを軽く取り直す（毎回の自動更新で実行）。
 * 取得元（いずれも登録・APIキー不要）：
 *   ドル円         日本銀行 時系列統計データ検索サイト（東京17時、fetch-boj-fx-daily.mjs。約2営業日遅れ）
 *                  ＋「参考」として ECB参考レートからの換算値（1営業日新しい。時点・方法が違うため併記のみ）
 *   米10年国債利回り  米財務省の日次イールドカーブCSV（取れなければFREDのDGS10＝1営業日遅れに切り替え）
 *   WTI原油 / S&P500 / 日経平均株価   FRED（DCOILWTICO / SP500 / NIKKEI225）
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
 * 米財務省の日次イールドカーブ（米10年国債利回り）。FRED(DGS10)はこの値を翌営業日に写すため、1営業日早い。
 * CSVは当年分（日付は MM/DD/YYYY、新しい順）。年初で点が足りないときは前年分も取る。
 */
async function fetchTreasury10y() {
  const year = new Date().getUTCFullYear();
  const fetchYear = async (y) => {
    const url =
      `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all` +
      `?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lines = (await res.text()).trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    const col = header.indexOf("10 Yr");
    if (col < 0) throw new Error("財務省CSV：10 Yr の列が見つかりません");
    const points = [];
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((cells[0] ?? "").replace(/"/g, "").trim());
      const value = Number(cells[col]);
      if (m && cells[col] && Number.isFinite(value)) points.push({ t: `${m[3]}-${m[1]}-${m[2]}`, value });
    }
    return points;
  };
  let points = await fetchYear(year);
  if (points.length < SPARK_POINTS + 1) points = [...(await fetchYear(year - 1)), ...points];
  return { points, source: "米財務省（日次イールドカーブ）" };
}

/** 米10年国債利回り：財務省が取れなければ従来どおりFRED（1営業日遅れ）に戻す */
async function fetchUs10y() {
  try {
    return await fetchTreasury10y();
  } catch (err) {
    console.log(`    財務省の取得に失敗、FREDに切り替え: ${err.message}`);
    return { points: await fetchFred("DGS10"), source: "FRED（米財務省）" };
  }
}

/**
 * ドル円の参考値：ECBの参考レート（EUR基準）から ドル円＝EUR/JPY ÷ EUR/USD で換算する（欧州中央銀行14:15時点、欧州の営業日のみ）。
 * 日銀の東京17時の値とは時点・算出方法が違うため、あくまで「参考」として併記する。直近90日のXMLを使う
 * （同名のCSV eurofxref-hist-90d.csv は存在しない。eurofxref-hist.csv は全期間で重い）。
 */
async function fetchEcbUsdJpy() {
  const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml", { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  // <Cube time="2026-10-15"><Cube currency="USD" rate="1.1208"/><Cube currency="JPY" rate="177.06"/>…</Cube> の繰り返し
  const rateOf = (block, cur) => {
    const i = block.indexOf(`currency="${cur}" rate="`);
    if (i < 0) return NaN;
    const start = i + `currency="${cur}" rate="`.length;
    return Number(block.slice(start, block.indexOf('"', start)));
  };
  const points = [];
  for (const block of xml.split('<Cube time="').slice(1)) {
    const t = block.slice(0, 10);
    const usd = rateOf(block, "USD");
    const jpy = rateOf(block, "JPY");
    if (usd > 0 && jpy > 0) points.push({ t, value: jpy / usd });
  }
  if (points.length < 2) throw new Error("ECB XML：値が2点以上取得できませんでした");
  return points.sort((a, b) => a.t.localeCompare(b.t));
}

/**
 * change：変化の出し方。"pct"＝前営業日比の変化額と変化率（%）、"pt"＝変化額のみ（利回りは%ポイント）。
 * detailIds：クリックで開く指標詳細（サイトに存在するもののうち最初のもの。無ければ押せない表示）。
 */
const ITEMS = [
  {
    id: "usdjpy",
    label: "ドル円",
    unit: "円",
    digits: 2,
    change: "pct",
    detailIds: ["usdjpy"],
    source: "日本銀行（東京17時）",
    get: fetchUsdJpyDaily,
    getReference: async () => ({ label: "ECB換算", note: "欧州中央銀行の参考レート（14:15時点）から換算", points: await fetchEcbUsdJpy() }),
  },
  { id: "us10y", label: "米10年国債利回り", unit: "%", digits: 2, change: "pt", detailIds: ["treasury_10y_us"], source: "米財務省（日次イールドカーブ）", get: fetchUs10y },
  {
    id: "jgb10y",
    label: "日本10年国債利回り",
    unit: "%",
    digits: 3,
    change: "pt",
    detailIds: ["jgb_10y_yield"], // 日本版のみ：月次の指標カード（日本銀行・新発10年国債）を開く
    note: "月ごとの推移は指標カード「新発10年国債利回り」（日本銀行・月末値）で確認できます。出典・算出方法が違うため、少しずれることがあります。",
    source: "財務省",
    get: fetchJgb10y,
  },
  { id: "wti", label: "WTI原油", unit: "ドル", digits: 2, change: "pct", detailIds: ["wti_oil_us"], source: "FRED（EIA）", get: () => fetchFred("DCOILWTICO") },
  { id: "sp500", label: "S&P500", unit: "", digits: 2, change: "pct", detailIds: ["sp500_us"], source: "FRED（S&P Dow Jones Indices）", get: () => fetchFred("SP500") },
  { id: "nikkei225", label: "日経平均株価", unit: "円", digits: 2, change: "pct", detailIds: ["nikkei225"], source: "FRED（日本経済新聞社）", get: () => fetchFred("NIKKEI225") },
];

/** got は点の配列、または { points, source }（取得元が状況で変わる銘柄用） */
function toItem(def, got, reference) {
  const raw = Array.isArray(got) ? got : got.points;
  const pts = raw.filter((p) => Number.isFinite(p.value)).sort((a, b) => a.t.localeCompare(b.t));
  if (pts.length < 2) throw new Error("値が2点以上取得できませんでした");
  const latest = pts.at(-1);
  const prev = pts.at(-2);
  const { get, getReference, ...meta } = def;
  const item = {
    ...meta,
    ...(!Array.isArray(got) && got.source ? { source: got.source } : {}),
    latest: { t: latest.t, value: latest.value },
    prev: { t: prev.t, value: prev.value },
    spark: pts.slice(-SPARK_POINTS).map((p) => p.value),
  };
  if (reference) {
    const r = reference.points.at(-1);
    item.reference = { label: reference.label, note: reference.note, t: r.t, value: r.value };
  }
  return item;
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
      let reference = null;
      if (def.getReference) {
        try {
          reference = await def.getReference();
        } catch (err) {
          console.log(`    参考値（${def.id}）の取得に失敗、併記なし: ${err.message}`); // 参考値が取れなくても本体は更新する
        }
      }
      const item = toItem(def, await def.get(), reference);
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
