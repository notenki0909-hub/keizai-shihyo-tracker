/**
 * FRED各系列ページに掲載されている「Next Release Date」を取得する。
 * 本ツールでFRED経由（api.provider === "fred-csv"）のデータを使っているのは日経平均株価のみ。
 * Nikkei Inc. の公式発表スケジュールをFRED自身がメタデータとして保持しているため、
 * 新たなデータソース・規約リスクを増やさずに「次回発表予定日」を表示できる。
 *
 * e-Stat・JPX・BOJ由来の指標にはこの種の公式メタデータが存在しないため、
 * fetch-indicators.mjs 側で releaseSchedule の目安からの推定値（nextReleaseRule）を使う。
 */
export async function fetchNextReleaseDate(seriesId) {
  const url = `https://fred.stlouisfed.org/series/${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" } });
  if (!res.ok) return null;
  const html = await res.text();

  const idx = html.indexOf("Next Release Date:");
  if (idx === -1) return null;
  const chunk = html.slice(idx, idx + 200);
  const m = chunk.match(/Next Release Date:\s*<span[^>]*>([^<]+)</);
  if (!m) return null;

  const d = new Date(m[1].trim()); // 例: "Oct 2, 2026"
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
