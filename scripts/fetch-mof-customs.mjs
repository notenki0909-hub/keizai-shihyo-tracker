/**
 * 財務省「貿易統計」（通関ベース）の月別時系列CSVから、貿易収支（輸出額−輸入額）を取得する。
 * 利用登録・APIキーは不要。
 *
 * CSV: https://www.customs.go.jp/toukei/suii/html/data/d41ma.csv
 *   - 文字コード Shift_JIS、単位は千円、1979年1月〜。未公表の月は 0 で埋められている。
 *   - 先頭の「【月別】」ブロックのみ使う（後半に【年別】ブロックが続く）。
 *   - 季節調整なしの原数値（1月は赤字になりやすいなど、季節要因が出る）。
 * 最新月は速報値（翌月に確報へ置き換わる）のため provisional を付ける。
 */
const URL_MONTHLY = "https://www.customs.go.jp/toukei/suii/html/data/d41ma.csv";

export async function fetchCustomsTradeBalance() {
  const res = await fetch(URL_MONTHLY, { headers: { "User-Agent": "keizai-shihyo-tracker" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = new TextDecoder("shift_jis").decode(await res.arrayBuffer());

  const points = [];
  for (const line of text.split(/\r?\n/)) {
    if (/【年別】|Calender Year/.test(line)) break; // 年別ブロックに入ったら終了
    const m = line.match(/^(\d{4})\/(\d{2}),\s*([\d.]+)\s*,\s*([\d.]+)\s*/);
    if (!m) continue;
    const exp = Number(m[3]);
    const imp = Number(m[4]);
    if (!(exp > 0) || !(imp > 0)) continue; // 未公表の月（0埋め）は除く
    points.push({
      t: `${m[1]}-${m[2]}`,
      date: `${m[1]}-${m[2]}-01`,
      value: Math.round((exp - imp) / 100000), // 千円 → 億円
    });
  }
  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  points.sort((a, b) => a.date.localeCompare(b.date));
  points[points.length - 1].provisional = true;
  return points;
}
