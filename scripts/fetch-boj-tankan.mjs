/**
 * 日本銀行「時系列統計データ検索サイト」のAPIから、日銀短観（全国企業短期経済観測調査）の
 * 業況判断DI（実績・先行き）と設備投資計画を取得する。利用登録・APIキーは不要。
 *
 * API: https://www.stat-search.boj.or.jp/api/v1/getDataCode
 * 系列コード（DB=CO）:
 *   TK99F1000601GCQ01000 … D.I./業況/大企業/製造業/実績
 *   TK99F2000601GCQ01000 … D.I./業況/大企業/非製造業/実績
 *   TK99F1000601GCQ11000 … D.I./業況/大企業/製造業/予測（先行き）
 *   TK99F2000601GCQ11000 … D.I./業況/大企業/非製造業/予測（先行き）
 *   TK99G0000109CFY{51,41,31,21}000 … 設備投資額（含む土地投資額）/前年比・年度/大企業/全産業
 *                                       （3月・6月・9月・12月調査それぞれの当年度計画）
 * 日付は "YYYYQQ"（QQ=01〜04 ＝ 3・6・9・12月調査）で返る。本ツールでは "2026 Q3" の形式に直す。
 *
 * 注意：「予測（先行き）」系列は、調査月ではなく「予測の対象四半期」で保存されている
 * （例：2020年3月調査の先行き−11は 202002 に入っている）。調査月に合わせるため1四半期戻す。
 * 設備投資の年度系列（ANNUAL）は、日付が「年度の開始年」（例：2023＝2023年度）。
 */
const API = "https://www.stat-search.boj.or.jp/api/v1/getDataCode";

async function fetchSeriesValues(code, since) {
  const url = `${API}?${new URLSearchParams({ format: "json", lang: "jp", db: "CO", code, startDate: since })}`;
  const res = await fetch(url, { headers: { "User-Agent": "keizai-shihyo-tracker" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.STATUS !== 200) throw new Error(`BOJ API: ${json.MESSAGE ?? json.STATUS}`);
  const series = json.RESULTSET?.[0]?.VALUES;
  return { dates: series?.SURVEY_DATES ?? [], values: series?.VALUES ?? [] };
}

function quarterPoint(year, q, value) {
  return {
    t: `${year} Q${q}`,
    date: `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`,
    value,
  };
}

/**
 * @param {string} code 系列コード
 * @param {{since?: string, forecast?: boolean}} [opts] forecast=true は「先行き」系列（対象四半期を調査月に直す）
 */
export async function fetchTankanDi(code, { since = "199001", forecast = false } = {}) {
  const { dates, values } = await fetchSeriesValues(code, since);
  const points = [];
  for (let i = 0; i < dates.length; i++) {
    const m = String(dates[i]).match(/^(\d{4})(\d{2})$/);
    const v = values[i];
    if (!m || v == null || !Number.isFinite(Number(v))) continue;
    let year = Number(m[1]);
    let q = Number(m[2]);
    if (q < 1 || q > 4) continue;
    if (forecast) {
      q -= 1;
      if (q === 0) {
        q = 4;
        year -= 1;
      }
    }
    points.push(quarterPoint(year, q, Number(v)));
  }
  // 先行きは調査月に直すと開始時点が1四半期手前にずれるため、実績系列と同じ開始時点にそろえる
  const sinceDate = `${since.slice(0, 4)}-${String((Number(since.slice(4, 6)) - 1) * 3 + 1).padStart(2, "0")}-01`;
  const kept = forecast ? points.filter((p) => p.date >= sinceDate) : points;
  if (!kept.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return kept.sort((a, b) => a.date.localeCompare(b.date));
}

/** 調査月（Q1〜Q4＝3・6・9・12月調査）ごとの「当年度の設備投資計画（前年比%）」の系列コード */
const CAPEX_VINTAGES = [
  { q: 1, code: "TK99G0000109CFY51000" },
  { q: 2, code: "TK99G0000109CFY41000" },
  { q: 3, code: "TK99G0000109CFY31000" },
  { q: 4, code: "TK99G0000109CFY21000" },
];

/**
 * 大企業・全産業の設備投資計画（含む土地投資額）の前年比を、調査ごとの時系列にする。
 * 各調査時点で「その年度（4月始まり）の計画」が何%と答えられたかを並べる。
 */
export async function fetchTankanCapexPlan({ sinceYear = 1990 } = {}) {
  const points = [];
  for (const { q, code } of CAPEX_VINTAGES) {
    const { dates, values } = await fetchSeriesValues(code, String(sinceYear));
    for (let i = 0; i < dates.length; i++) {
      const year = Number(dates[i]);
      const v = values[i];
      if (!Number.isInteger(year) || v == null || !Number.isFinite(Number(v))) continue;
      points.push(quarterPoint(year, q, Number(v)));
    }
  }
  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
