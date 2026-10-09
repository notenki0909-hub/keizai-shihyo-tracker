/**
 * 東京証券取引所（JPX）「投資部門別売買状況」（株式・月間）から、
 * 東証プライム市場における海外投資家の買い越し／売り越し額を取得する。
 *
 * e-Stat統計ダッシュボードには存在しないデータのため、JPXが公開している
 * Excelファイルを直接ダウンロード・解析する（登録不要・無償）。
 *
 * 参照ページ: https://www.jpx.co.jp/markets/statistics-equities/investor-type/00-01.html
 *
 * ■ 既知の制約・注意点
 * - 東証プライム市場は2022年4月発足のため、それ以前（旧・市場第一部）とは
 *   連続しない別区分としてSINCEで打ち切っている。
 * - 月間ページの「バックナンバー」は年ごとの固定URL（00-01-archives-0N.html）
 *   をスクレイピングして月次ファイルのリンクを発見している。JPXがサイト構成を
 *   変えると崩れる可能性がある（取得失敗時はこの指標だけスキップされる設計）。
 * - ファイル形式は2種類ある（どちらも読む）。
 *   旧形式（〜2026年8月分）：金額ファイル stock_val_1_mYYMM.xls。対象市場ごとにシートが分かれ（「TSE Prime」等）、
 *     「海外投資家」行（売り）と次行（買い）の総計列に金額が入る。
 *   新形式（2026年9月分〜、2026-10-08公表）：金額・株数を1ファイルに統合した stock_1_mYYYYMM.xlsx。
 *     1シートに全市場を縦に並べ、「株数」「金額」の行が交互に入る。横方向は投資部門ごとに
 *     売・買・差引・合計の4列。海外投資家は「法人」「個人」の2区分に分かれているため、両者の差引（買い越し額）を足す。
 *     結合セルのため、見出しは右方向へ値を引き継いで読む。
 * - 単位は千円（旧形式の「千円,%」・新形式の「千株／千円」の表記どおり）。億円にするには10万で割る。
 *   （2026-10-09まで1億で割っており、値が実際の1/1000になっていた誤りを修正した。）
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
const SHEET = "TSE Prime"; // 旧形式のシート名
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

/**
 * 月間ページのHTMLから月次ファイルのフルURLと年月キーを抽出する。
 * 旧形式 stock_val_1_mYYMM.xls と、新形式 stock_1_mYYYYMM.xlsx の両方を対象にする
 * （ページには雛形の stock_1_mYYYYMM.xlsx というリンクもあるが、数字6桁のみを対象にして除く）。
 */
function extractMonthlyLinks(html) {
  const out = [];
  const reOld = /href="(\/markets\/statistics-equities\/investor-type\/[^"]+\/stock_val_1_m(\d{2})(\d{2})\.xls)"/g;
  const reNew = /href="(\/markets\/statistics-equities\/investor-type\/[^"]+\/stock_1_m(\d{4})(\d{2})\.xlsx)"/g;
  let m;
  while ((m = reOld.exec(html))) out.push({ url: BASE + m[1], key: `${2000 + Number(m[2])}-${m[3]}` });
  while ((m = reNew.exec(html))) out.push({ url: BASE + m[1], key: `${m[2]}-${m[3]}` });
  return out;
}

const toNum = (v) => Number(String(v).replace(/,/g, ""));

/** 結合セルで空になっている見出しを、左隣の値で埋める */
function fillRight(row, width) {
  const out = [];
  let last = "";
  for (let c = 0; c < width; c++) {
    const v = String(row[c] ?? "").trim();
    if (v) last = v;
    out.push(last);
  }
  return out;
}

/** 新形式（2026年9月分〜）から、東証プライムの海外投資家の買い越し額（千円）を抽出 */
function extractForeignNetNewFormat(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const width = Math.max(...rows.map((r) => r.length));

  // 「差引 Balance」「合計 Total」を含む見出し行（売／買／差引／合計）を探す
  const hdrIdx = rows.findIndex((r) => r.some((v) => /差引/.test(String(v))) && r.some((v) => /合計/.test(String(v))));
  if (hdrIdx === -1) throw new Error("新形式：見出し行（差引・合計）が見つかりません");

  // 上位の見出し行（自己／委託・投資部門の区分）は結合セルのため、右方向へ引き継いで確認する
  const upper = [];
  for (let r = 0; r < hdrIdx; r++) upper.push(fillRight(rows[r], width));
  const balanceCols = [];
  for (let c = 0; c < width; c++) {
    if (!/差引/.test(String(rows[hdrIdx][c]))) continue;
    if (upper.some((u) => /海外投資家|Foreigners/.test(u[c]))) balanceCols.push(c);
  }
  if (!balanceCols.length) throw new Error("新形式：「海外投資家」の差引列が見つかりません");

  // 東証プライムの行（株数）の次の行が「金額 Value」
  const primeIdx = rows.findIndex((r) => /東証プライム|TSE Prime/.test(String(r[1])));
  if (primeIdx === -1 || !rows[primeIdx + 1]) throw new Error("新形式：東証プライムの行が見つかりません");
  const valueRow = rows[primeIdx + 1];
  if (!/金額|Value/.test(String(valueRow[2]))) throw new Error("新形式：金額の行を特定できません");

  const nets = balanceCols.map((c) => toNum(valueRow[c]));
  if (nets.some((n) => !Number.isFinite(n))) throw new Error("新形式：数値の抽出に失敗しました");
  return nets.reduce((a, b) => a + b, 0); // 千円（法人＋個人）
}

/** 1ファイル分から「海外投資家」の買い越し額（千円）を抽出。新旧どちらの形式も読む */
function extractForeignNetThousandYen(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  if (!wb.SheetNames.includes(SHEET)) return extractForeignNetNewFormat(wb);

  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const idx = rows.findIndex((r) => r[0] === CATEGORY_LABEL);
  if (idx === -1 || !rows[idx + 1]) throw new Error(`「${CATEGORY_LABEL}」の行が見つかりません`);

  const sales = toNum(rows[idx][4]); // 売り（Sales）
  const purchases = toNum(rows[idx + 1][4]); // 買い（Purchases）
  if (!Number.isFinite(sales) || !Number.isFinite(purchases)) {
    throw new Error("数値の抽出に失敗しました");
  }
  return purchases - sales; // 買い越し(+) / 売り越し(-)、千円
}

export async function fetchForeignInvestorFlow() {
  const linksByMonth = new Map();

  for (const page of MONTHLY_PAGES) {
    try {
      const html = await fetchText(page);
      for (const { url, key } of extractMonthlyLinks(html)) {
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
      const netThousandYen = extractForeignNetThousandYen(buf);
      points.push({ t: key, value: Math.round((netThousandYen / 1e5) * 100) / 100 }); // 千円 → 億円
    } catch (err) {
      console.log(`    JPXファイル解析失敗（${key}）: ${err.message}`);
    }
    await sleep(250);
  }

  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points;
}
