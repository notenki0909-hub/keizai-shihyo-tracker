/**
 * FRED（セントルイス連邦準備銀行）のCSV配信から日次系列を取得する汎用関数。
 * 利用登録不要・APIキー不要で `fredgraph.csv?id=<SERIES_ID>` から直接取得できる。
 *
 * 日経平均株価（NIKKEI225）はNikkei Inc.の著作物で、FREDが許諾を得て再配布している
 * （FRED該当ページ: "Copyright, Nikkei Inc. Reprinted with permission."）。
 * 本ツールは非商用の公開ダッシュボードとしてこのFRED経由のデータを表示する。
 *
 * 参照: https://fred.stlouisfed.org/series/NIKKEI225
 */
const SINCE = "2016-01-01";

export async function fetchFredSeries(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    if (!date || date < SINCE) continue;
    const trimmed = (raw ?? "").trim();
    // 欠測（休場日等）は空文字列や "." で表される。Number("") は 0 になるため明示的に除外する
    if (trimmed === "" || trimmed === ".") continue;
    const value = Number(trimmed);
    if (!Number.isFinite(value)) continue;
    points.push({ t: date, date, value });
  }

  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
