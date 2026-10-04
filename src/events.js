/**
 * 経済指標以外のイベント（FOMC・議事要旨・ベージュブック・FRB高官の講演・ジャクソンホール会議など）の
 * 読み込みと、カレンダー用ピル／詳細ダイアログの描画。データは public/data/events.json
 * （scripts/fetch-events.mjs が公式ページから取得）。要約・解釈は行わず、公式の記載を
 * そのまま構造化・リンクしている。
 */

const EVENTS_URL = import.meta.env.BASE_URL + "data/events.json";

export const EVENT_TYPES = {
  fomc: { icon: "🏛️", label: "FOMC" },
  minutes: { icon: "📝", label: "議事要旨" },
  beige: { icon: "📒", label: "ベージュブック" },
  speech: { icon: "🎤", label: "講演・発言" },
  testimony: { icon: "⚖️", label: "議会証言" },
  jackson: { icon: "🏔️", label: "ジャクソンホール" },
  boj: { icon: "🏦", label: "日銀会合" },
  boj_outlook: { icon: "📘", label: "展望レポート" },
  boj_opinion: { icon: "💬", label: "主な意見" },
  boj_minutes: { icon: "📝", label: "議事要旨" },
  boj_press: { icon: "🎙️", label: "総裁会見" },
};

const ACTION_LABEL = { hike: "利上げ", cut: "利下げ", hold: "据え置き" };
const ACTION_SHORT = { hike: "▲利上げ", cut: "▼利下げ", hold: "据置" };
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function loadEvents() {
  try {
    const res = await fetch(EVENTS_URL, { cache: "no-cache" });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.events) ? json.events : [];
  } catch {
    return [];
  }
}

/** 日付文字列("YYYY-MM-DD") → イベント配列 のMap */
export function groupEventsByDate(events) {
  const map = new Map();
  for (const ev of events) {
    if (!map.has(ev.date)) map.set(ev.date, []);
    map.get(ev.date).push(ev);
  }
  return map;
}

export function eventPillHtml(ev) {
  const t = EVENT_TYPES[ev.type] ?? { icon: "📌", label: "" };
  const action = ev.result?.action ? ` ${ACTION_SHORT[ev.result.action] ?? ""}` : "";
  const done = ev.status === "done" ? " calendar__pill--done" : "";
  return `<button type="button" class="calendar__pill calendar__pill--event calendar__pill--ev-${esc(ev.type)}${done}" data-event-id="${esc(ev.id)}" title="${esc(ev.title)}">${t.icon} ${esc(ev.short ?? ev.title)}${esc(action)}</button>`;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${wd}）`;
}

function fmtRange(low, high) {
  return `${low.toFixed(2)}–${high.toFixed(2)}%`;
}

/** 声明文の差分。長い「変更なし」部分は前後だけ残して省略する */
function diffHtml(diff) {
  const parts = diff.segments.map((seg) => {
    if (seg.t === "add") return `<ins>${esc(seg.s)}</ins>`;
    if (seg.t === "del") return `<del>${esc(seg.s)}</del>`;
    const s = seg.s;
    if (s.length <= 220) return esc(s);
    return `${esc(s.slice(0, 90))}<span class="ev-diff__skip"> …（変更なし）… </span>${esc(s.slice(-90))}`;
  });
  return parts.join(" ");
}

function voteText(vote) {
  if (!vote) return "";
  if (vote.unanimous) return "投票：全員一致";
  return `投票：賛成 ${vote.for}・反対 ${vote.against}${vote.against ? "（反対者あり）" : "（全会一致）"}`;
}

function resultHtml(ev) {
  const r = ev.result;
  if (!r) return "";
  let html = "";
  if (ev.type === "boj" && r.rate != null) {
    const delta = r.prevRate != null ? Math.round((r.rate - r.prevRate) * 100) : null;
    const deltaText = delta ? `${delta > 0 ? "+" : ""}${delta}bp` : "変更なし";
    html += `
      <div class="ev-result">
        <div class="ev-result__label">政策金利（無担保コールレート・オーバーナイト物の誘導目標）</div>
        <div class="ev-result__main">${r.rate.toFixed(2)}%
          ${r.action ? `<span class="ev-result__badge ev-result__badge--${r.action}">${ACTION_LABEL[r.action]}（${deltaText}）</span>` : ""}</div>
        <div class="ev-result__meta">
          ${r.prevRate != null ? `前回 ${r.prevRate.toFixed(2)}%` : ""}
          ${r.vote ? `${r.prevRate != null ? "　／　" : ""}${voteText(r.vote)}` : ""}
        </div>
      </div>`;
  } else if (ev.type === "fomc" && r.action && r.rangeLow != null) {
    const prev = r.prevRangeLow != null ? fmtRange(r.prevRangeLow, r.prevRangeHigh) : null;
    const delta = r.prevRangeLow != null ? Math.round((r.rangeHigh - r.prevRangeHigh) * 100) : null;
    const deltaText = delta ? `${delta > 0 ? "+" : ""}${delta}bp` : "変更なし";
    html += `
      <div class="ev-result">
        <div class="ev-result__label">政策金利（FFレートの誘導目標レンジ）</div>
        <div class="ev-result__main">${fmtRange(r.rangeLow, r.rangeHigh)}
          <span class="ev-result__badge ev-result__badge--${r.action}">${ACTION_LABEL[r.action]}（${deltaText}）</span></div>
        <div class="ev-result__meta">
          ${prev ? `前回 ${prev}` : ""}
          ${r.vote ? `${prev ? "　／　" : ""}${voteText(r.vote)}` : ""}
        </div>
      </div>`;
  } else if (r.headline) {
    html += `<div class="ev-result"><div class="ev-result__label">講演タイトル（公式・英語）</div><div class="ev-result__main ev-result__main--sm">${esc(r.headline)}</div></div>`;
  }
  return html;
}

function sepHtml(sep) {
  if (!sep) return "";
  const head = sep.years.map((y) => `<th>${esc(y)}</th>`).join("");
  const rows = sep.rows
    .map((row) => {
      const cells = row.median
        .map((v, i) => {
          const prev = row.prev?.[i];
          const note = prev && prev !== v ? `<span class="ev-sep__prev">前回 ${esc(prev)}</span>` : "";
          return `<td>${esc(v) || "–"}${note}</td>`;
        })
        .join("");
      return `<tr><th scope="row">${esc(row.name)}</th>${cells}</tr>`;
    })
    .join("");
  return `
    <section class="ev-section">
      <h3>経済見通し（SEP）：参加者見通しの中央値（%）</h3>
      <div class="ev-sep__wrap"><table class="ev-sep"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="ev-note">各年末の見通し。前回（直前のSEP）から変わった項目には前回値を併記。</p>
    </section>`;
}

export function renderEventDetail(ev) {
  const t = EVENT_TYPES[ev.type] ?? { icon: "📌", label: "" };
  const statusBadge =
    ev.status === "done"
      ? `<span class="ev-status ev-status--done">発表済み</span>`
      : `<span class="ev-status">予定</span>`;
  const dateText =
    ev.endDate && ev.endDate !== ev.date ? `${fmtDate(ev.date)} 〜 ${fmtDate(ev.endDate)}` : fmtDate(ev.date);
  const isSentenceDiff = ev.diff?.unit === "sentence";
  const diffBlock = ev.diff
    ? `<section class="ev-section">
        <h3>${isSentenceDiff ? "公表文" : "声明文"}の変更点（${esc(fmtDate(ev.diff.prevDate))}の${isSentenceDiff ? "公表文" : "声明"}との比較）</h3>
        <p class="ev-diff">${diffHtml(ev.diff)}</p>
        <p class="ev-note">公式の${isSentenceDiff ? "公表文（日本語）を文単位" : "声明文（英語）を単語単位"}で機械的に比較したもの。<del>取り消し線</del>＝前回にあって削除された文言、<ins>下線</ins>＝今回追加された文言。</p>
      </section>`
    : "";
  const links = (ev.links ?? [])
    .map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`)
    .join("");
  return `
    <div class="event-detail__head">
      <span class="tag ev-tag ev-tag--${esc(ev.type)}">${t.icon} ${esc(t.label)}</span>${statusBadge}
      <h2>${esc(ev.title)}</h2>
      <p class="event-detail__when">${esc(dateText)}${ev.time ? `　${esc(ev.time)}` : ""}</p>
      ${ev.subtitle ? `<p class="event-detail__sub">${esc(ev.subtitle)}</p>` : ""}
    </div>
    <div class="event-detail__body">
      ${resultHtml(ev)}
      ${sepHtml(ev.sep)}
      ${diffBlock}
      ${links ? `<section class="ev-section"><h3>公式資料</h3><ul class="ev-links">${links}</ul></section>` : ""}
      <p class="ev-note ev-note--foot">※ 公式ページの記載を機械的に抽出・比較したもので、内容の解釈・要約・将来予測は含みません（AIによる分析ではありません）。結果は定期更新のタイミングで反映されるため、発表直後は未反映の場合があります。</p>
    </div>`;
}
