/**
 * e-Stat 統計ダッシュボードが取得できないときに使う「予備の取得先」。
 *
 * 統計ダッシュボードは各機関の統計をまとめて配信しているため、元の公表機関から直接取れる指標は
 * そちらを予備にする。予備に切り替えるのは、統計ダッシュボードの取得に失敗したときだけで、
 * 通常時の取得元・表示内容は変わらない（indicators.config.mjs の `fallback` で指定する）。
 *
 *   provider: "boj-stat"  日本銀行 時系列統計データ検索サイト API（利用登録・APIキー不要）
 *                          https://www.stat-search.boj.or.jp/api/v1/getDataCode
 *                          db=データベース名、code=系列コード（月次のみ対応。日付は "YYYYMM"）
 *   provider: "fred-csv"  FRED（OECD系の月次系列）。更新が遅れることがあるため appendOnly: true と併用し、
 *                          前回までの値は残して、新しい月だけを足す（過去分の定義の違いで履歴が変わらないように）
 *   latestProvisional: true  最新月を「速報」扱いにする（企業物価など、翌月に確報へ改定される統計用）
 */
import { fetchFredSeries } from "./fetch-fred-series.mjs";

const BOJ_API = "https://www.stat-search.boj.or.jp/api/v1/getDataCode";

export async function fetchBojMonthly({ db, code, since }) {
  const url = `${BOJ_API}?${new URLSearchParams({ format: "json", lang: "jp", db, code, startDate: since })}`;
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
    const value = values[i];
    if (!m || value == null || !Number.isFinite(Number(value))) continue; // 欠測は除外
    points.push({ t: `${m[1]}-${m[2]}`, date: `${m[1]}-${m[2]}-01`, value: Number(value) });
  }
  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * @param {object} fb indicators.config.mjs の `fallback`
 * @param {Array<{t:string,value:number,provisional?:boolean}>|undefined} prevPoints 前回の points（appendOnly 用）
 * @returns {Promise<{points: object[], source: object}>}
 */
export async function fetchFallbackSeries(fb, prevPoints) {
  let points;
  let provider;
  switch (fb.provider) {
    case "boj-stat":
      points = await fetchBojMonthly(fb);
      provider = "日本銀行 時系列統計データ検索サイト";
      break;
    case "fred-csv":
      points = (await fetchFredSeries(fb.seriesId)).map((p) => ({ ...p, t: p.date.slice(0, 7) }));
      provider = "FRED（セントルイス連邦準備銀行）";
      break;
    default:
      throw new Error(`未対応の予備取得先: ${fb.provider}`);
  }

  if (fb.appendOnly && prevPoints?.length) {
    const lastT = prevPoints.at(-1).t;
    const kept = prevPoints.map((p) => ({ ...p, date: p.date ?? `${p.t}-01` })); // 出力では date を省いているので復元する
    points = [...kept, ...points.filter((p) => p.t > lastT)];
  }

  // 統計ダッシュボードは最新月に「速報」フラグを付けるが、予備の取得先にはその情報がない。
  // 最新月が速報で翌月に確報へ改定される統計（企業物価など）は、設定で最新月を速報扱いにする
  if (fb.latestProvisional && !points.at(-1).provisional) {
    points = [...points.slice(0, -1), { ...points.at(-1), provisional: true }];
  }

  return {
    points,
    source: {
      provider,
      statName: `${fb.statName}（統計ダッシュボードが取得できなかったため、こちらから取得）`,
      sourceUrl: fb.sourceUrl,
    },
  };
}
