/**
 * 日本銀行「時系列統計データ検索サイト」のAPIから、日銀短観（全国企業短期経済観測調査）の
 * 業況判断DI（実績）を取得する。利用登録・APIキーは不要。
 *
 * API: https://www.stat-search.boj.or.jp/api/v1/getDataCode
 * 系列コード（DB=CO）:
 *   TK99F1000601GCQ01000 … D.I./業況/大企業/製造業/実績
 *   TK99F2000601GCQ01000 … D.I./業況/大企業/非製造業/実績
 * 日付は "YYYYQQ"（QQ=01〜04 ＝ 3・6・9・12月調査）で返る。本ツールでは "2026 Q3" の形式に直す。
 */
const API = "https://www.stat-search.boj.or.jp/api/v1/getDataCode";

export async function fetchTankanDi(code, { since = "199001" } = {}) {
  const url = `${API}?${new URLSearchParams({ format: "json", lang: "jp", db: "CO", code, startDate: since })}`;
  const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.STATUS !== 200) throw new Error(`BOJ API: ${json.MESSAGE ?? json.STATUS}`);
  const series = json.RESULTSET?.[0]?.VALUES;
  const dates = series?.SURVEY_DATES ?? [];
  const values = series?.VALUES ?? [];
  const points = [];
  for (let i = 0; i < dates.length; i++) {
    const m = String(dates[i]).match(/^(\d{4})(\d{2})$/);
    const v = values[i];
    if (!m || v == null || !Number.isFinite(Number(v))) continue;
    const q = Number(m[2]);
    if (q < 1 || q > 4) continue;
    const year = Number(m[1]);
    points.push({
      t: `${year} Q${q}`,
      date: `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`,
      value: Number(v),
    });
  }
  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
