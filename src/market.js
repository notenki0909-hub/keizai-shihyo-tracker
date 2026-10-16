/**
 * マーケットボード（経済状況サマリーの最上部に出す主要6銘柄：ドル円・日米10年国債利回り・WTI原油・S&P500・日経平均株価）。
 * データは public/data/market.json（scripts/fetch-market-board.mjs が自動更新のたびに取得）。
 * このファイルは日米共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */

const MARKET_URL = import.meta.env.BASE_URL + "data/market.json";

/** 失敗時は空のボード（サマリー本体の表示には影響しない） */
export async function loadMarket() {
  try {
    const res = await fetch(MARKET_URL, { cache: "no-cache" });
    if (!res.ok) return { items: [] };
    const json = await res.json();
    return Array.isArray(json.items) ? json : { items: [] };
  } catch {
    return { items: [] };
  }
}

const fmtNum = (v, digits) =>
  Number(v).toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtSigned = (v, digits) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNum(Math.abs(v), digits);

/** "2026-10-15" → "10/15" */
const fmtMd = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

function sparkSvg(values, dir) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 84;
  const h = 26;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return `<svg class="mb-spark mb-spark--${dir}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/**
 * @param market loadMarket() の結果
 * @param {(id: string) => boolean} hasIndicator このサイトに存在する指標idか（クリックで詳細を開けるか判定）
 */
export function marketBoardHtml(market, hasIndicator) {
  const items = market?.items ?? [];
  if (!items.length) return "";

  const nowMs = market.generatedAt ? Date.parse(market.generatedAt) : Date.now();
  const cards = items
    .map((it) => {
      const diff = it.latest.value - it.prev.value;
      const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "―";
      const pct = it.prev.value ? (diff / Math.abs(it.prev.value)) * 100 : 0;
      const changeText =
        it.change === "pct"
          ? `${fmtSigned(diff, it.digits)}（${fmtSigned(pct, 2)}%）`
          : `${fmtSigned(diff, it.digits)} pt`;
      const staleDays = (nowMs - Date.parse(it.latest.t)) / 86400e3;
      const stale = staleDays > 5 ? `<span class="mb-stale">更新待ち</span>` : "";
      const detailId = (it.detailIds ?? []).find((id) => hasIndicator(id));
      const inner = `
        <span class="mb-label">${it.label}</span>
        <span class="mb-value">${fmtNum(it.latest.value, it.digits)}<small>${it.unit ? " " + it.unit : ""}</small></span>
        <span class="mb-change mb-change--${dir}">${arrow} ${changeText}</span>
        ${sparkSvg(it.spark, dir)}
        <span class="mb-meta">${fmtMd(it.latest.t)}時点（前営業日比）${stale}<br>${it.source}</span>`;
      return detailId
        ? `<button type="button" class="mb-item mb-item--link" data-id="${detailId}" title="${it.label}の推移を見る">${inner}</button>`
        : `<div class="mb-item">${inner}</div>`;
    })
    .join("");

  return `
    <div class="market-board" aria-label="主要マーケット">
      <div class="market-board__grid">${cards}</div>
      <p class="market-board__note">緑＝前営業日より上昇、赤＝下落（値動きの向きで、良し悪しの評価ではありません）。各データの最新の営業日の値で、自動更新のたびに取り直しています。為替・利回り・原油は元データの公表が1〜2営業日遅れることがあります。</p>
    </div>`;
}
