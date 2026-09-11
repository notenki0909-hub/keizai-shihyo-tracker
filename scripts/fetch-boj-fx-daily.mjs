/**
 * 日本銀行「時系列統計データ検索サイト」から、東京インターバンク相場
 * （ドル・円スポット・17時時点）の日次系列を取得する。
 *
 * e-Statの統計ダッシュボードは月末値までしか提供していないため、より新鮮な値を
 * 表示するためにBOJの一次ソースから日次で直接取得する。
 *
 * 参照ページ: https://www.stat-search.boj.or.jp/ssi/mtshtml/fm08_d_1_en.html
 * （系列コード FM08'FXERD04。全期間が1ページのHTMLテーブルに収録されている）
 */
const URL = "https://www.stat-search.boj.or.jp/ssi/mtshtml/fm08_d_1_en.html";

// データ量・表示性能のバランスを考え、直近の期間のみを対象にする
const SINCE = "2016-01-01";

const ROW_RE = /<tr nowrap align=right><th[^>]*>(\d{4})\/(\d{2})\/(\d{2})<\/th><td>\s*([-\d.]+|NA|ND)\s*<\/td>/g;

export async function fetchUsdJpyDaily() {
  const res = await fetch(URL, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const points = [];
  let m;
  while ((m = ROW_RE.exec(html))) {
    const [, y, mo, d, raw] = m;
    const date = `${y}-${mo}-${d}`;
    if (date < SINCE) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue; // NA/ND（休日・欠測）は除外
    points.push({ t: date, date, value });
  }

  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
