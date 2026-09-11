/**
 * 東京証券取引所（JPX）「投資部門別売買状況」（株式・月間）から、
 * 東証プライム市場における海外投資家の買い越し／売り越し額を取得する。
 *
 * e-Stat統計ダッシュボードには存在しないデータのため、JPXが公開している
 * Excel（.xls）ファイルを直接ダウンロード・解析する（登録不要・無償）。
 *
 * 参照ページ: https://www.jpx.co.jp/markets/statistics-equities/investor-type/00-01.html
 *
 * ■ 既知の制約・注意点
 * - 東証プライム市場は2022年4月発足のため、それ以前（旧・市場第一部）とは
 *   連続しない別区分としてSINCEで打ち切っている。
 * - 月間ページの「バックナンバー」は年ごとの固定URL（00-01-archives-0N.html）
 *   をスクレイピングして月次ファイルのリンクを発見している。JPXがサイト構成を
 *   変えると崩れる可能性がある（取得失敗時はこの指標だけスキップされる設計）。
 * - JPXは2026年10月8日公表分から「金額・株数を1ファイルに統合し、シート構成も
 *   変更する」とアナウンス済み。本パーサーは変更前フォーマット（対象市場ごとに
 *   シートが分かれ、シート内に単一期間の投資部門別集計が入る形式）を前提にして
 *   おり、10月以降は新フォーマット対応が別途必要になる（失敗時は自動でスキップ
 *   されるため、他の指標には影響しない）。
 */
import * as XLSX from "xlsx";

const BASE = "https://www.jpx.co.jp";

// 月間データの一覧ページ（当年＋直近の年別バックナンバー）
const MONTHLY_PAGES = [
  "/markets/statistics-equities/investor-type/00-01.html", // 当年
  "/markets/statistics-equities/investor-type/00-01-archives-01.html", // 前年
  "/markets/statistics-equities/investor-type/00-01-archives-02.html", // 2年前
  "/markets/statistics-equities/investor-type/00-01-archives-03.html", // 3年前
  "/markets/statistics-equities/investor-type/00-01-archives-04.html", // 4年前（プライム市場発足年）
];

const SINCE = "2022-04"; // 東証プライム市場発足月
const SHEET = "TSE Prime";
const CATEGORY_LABEL = "海外投資家";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(path) {
  const res = await fetch(BASE + path, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${path})`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** 月間ページのHTMLから stock_val_1_mYYMM.xls のフルURLと年月キーを抽出 */
function extractMonthlyValueLinks(html) {
  const re = /href="(\/markets\/statistics-equities\/investor-type\/[^"]+\/stock_val_1_m(\d{2})(\d{2})\.xls)"/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const [, href, yy, mm] = m;
    out.push({ url: BASE + href, key: `${2000 + Number(yy)}-${mm}` });
  }
  return out;
}

/** 1ファイル分の対象シートから「海外投資家」の買い越し額（円）を抽出 */
function extractForeignNetYen(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`シート「${SHEET}」が見つかりません`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const idx = rows.findIndex((r) => r[0] === CATEGORY_LABEL);
  if (idx === -1 || !rows[idx + 1]) throw new Error(`「${CATEGORY_LABEL}」の行が見つかりません`);

  const toNum = (v) => Number(String(v).replace(/,/g, ""));
  const sales = toNum(rows[idx][4]); // 売り（Sales）
  const purchases = toNum(rows[idx + 1][4]); // 買い（Purchases）
  if (!Number.isFinite(sales) || !Number.isFinite(purchases)) {
    throw new Error("数値の抽出に失敗しました");
  }
  return purchases - sales; // 買い越し(+) / 売り越し(-)、円ベース
}

export async function fetchForeignInvestorFlow() {
  const linksByMonth = new Map();

  for (const page of MONTHLY_PAGES) {
    try {
      const html = await fetchText(page);
      for (const { url, key } of extractMonthlyValueLinks(html)) {
        if (key >= SINCE && !linksByMonth.has(key)) linksByMonth.set(key, url);
      }
    } catch (err) {
      console.log(`    JPXページ取得失敗（${page}）: ${err.message}`);
    }
    await sleep(200);
  }

  if (!linksByMonth.size) throw new Error("月間データのリンクを1件も取得できませんでした");

  const keys = [...linksByMonth.keys()].sort();
  const points = [];
  for (const key of keys) {
    try {
      const buf = await fetchBinary(linksByMonth.get(key));
      const netYen = extractForeignNetYen(buf);
      points.push({ t: key, value: Math.round((netYen / 1e8) * 100) / 100 }); // 億円換算
    } catch (err) {
      console.log(`    JPXファイル解析失敗（${key}）: ${err.message}`);
    }
    await sleep(250);
  }

  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points;
}
