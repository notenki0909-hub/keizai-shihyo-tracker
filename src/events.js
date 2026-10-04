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

/** 各イベントが何なのか（初心者向けの説明）。ポップアップ冒頭の「このイベントとは」に表示 */
const EVENT_INTRO = {
  fomc: "FOMC（連邦公開市場委員会）は、米国の中央銀行であるFRBが「政策金利」を決める会議です。年8回開かれ、会合の最終日に結論（利上げ・据え置き・利下げ）が発表されます。金利は株価・為替（ドル円）・住宅ローン金利などに広く影響するため、市場が最も注目するイベントのひとつです。",
  minutes: "FOMC会合で、委員がどんな議論をしたかを詳しくまとめた記録です。会合の3週間後に公表されます。結論だけでなく「委員が何を心配していたか」「利上げ・利下げにどのくらい前向きか」が分かるため、次の金利判断を考える材料になります。",
  beige: "全米12地区の連銀が、地元の企業などから聞き取った景気の実感（雇用・物価・消費・企業活動など）をまとめた報告書です。表紙が薄いベージュ色なので、この名前で呼ばれます。数字の統計より早く景気の変化が分かることがあり、FOMCの約2週間前に公表されます。",
  speech: "FRBの議長・副議長が、景気や金融政策について話す機会です。今後の金利の方針について、言い回しが少し変わるだけでも市場が反応することがあります。",
  testimony: "FRB議長が米議会に出向き、金融政策の状況を報告して議員の質問に答える場です（年2回が通例）。議長の考えを直接聞ける機会として、市場が注目します。",
  jackson: "米国のカンザスシティ連銀が毎年夏に開く、世界の中央銀行関係者や経済学者が集まる国際会議です。FRB議長がここで講演し、その後の金融政策の方向性を示すことがあるため、世界の市場が注目します。",
  boj: "日本銀行の金融政策決定会合は、日本の「政策金利」などを決める会議です。年8回、2日間の日程で開かれ、最終日に結論が公表されます。金利の動きは円相場・株価・住宅ローン金利などに影響します。",
  boj_outlook: "日銀が年4回（1・4・7・10月）、今後の経済成長率と物価上昇率の見通しを示すレポートです。見通しが変わると、利上げ・利下げの時期についての市場の予想も変わりやすくなります。",
  boj_opinion: "金融政策決定会合で出た委員の意見を、発言者が分からない形で要約したものです。会合の約10日後に公表され、委員の間で「利上げに前向きか、慎重か」といった雰囲気をつかめます。",
  boj_minutes: "会合での議論を詳しく記録した文書で、次の会合の後に公表されます。「主な意見」より詳しく、議論の流れが分かります。",
  boj_press: "会合の結果を受けて、日銀の総裁が記者の質問に答える会見です。今後の利上げなどの方針についての発言が注目され、市場が反応することがあります。",
};

const HELP = {
  rateFomc:
    "「政策金利」は、中央銀行が決める基準の金利です。ここが上がる（利上げ）と、預金や借入の金利も上がりやすく、景気を冷やして物価の上昇を抑える方向に働きます。下がる（利下げ）と、景気を後押しする方向に働きます。米国では「下限〜上限」のレンジで決めます。「bp」は0.01%のことで、+25bp＝0.25%の引き上げです。「投票」は決定に賛成・反対した委員の人数で、反対者がいると委員の意見が割れていることの目安になります。",
  rateBoj:
    "「無担保コールレート（オーバーナイト物）」は、銀行どうしが翌日返済を条件に、担保なしで資金を貸し借りするときの金利で、日銀が政策金利として誘導します。ここが上がる（利上げ）と、預金や借入の金利も上がりやすくなり、下がる（利下げ）と逆の動きになります。「bp」は0.01%のことで、+25bp＝0.25%の引き上げです。「投票」は決定に賛成・反対した委員の人数で、反対者がいると委員の意見が割れていることの目安になります。",
  headline: "講演の題名（公式・英語）です。話した内容は、下の「公式資料」にある講演原稿のリンクから読めます。",
  sep: "SEP（経済見通し）は、FOMCの参加者（約19人）が、3・6・9・12月の会合で公表する今後数年間の見通しです。表の数字は、参加者の予想の「中央値」で、各年の年末時点の値です。「政策金利」の行は、参加者が将来の金利水準をどう見ているかを表し、いわゆる「ドット・プロット」の中央値にあたります。この表の見通しが前回より上がった・下がったかで、今後の利上げ・利下げの方向感を探る人が多くいます。",
  diff: "中央銀行は、声明文の言い回しを慎重に選びます。そのため、1語の追加や削除でも、判断の変化のサインとして市場に注目されます。このツールは前回の文書との違いを色で示しているだけで、意味の解釈は行いません。変更が少ないときは、「基本方針は大きく変わっていない」と読むことが多くあります。",
  links: "判断の根拠になる原文は、公式サイトで誰でも読めます。このツールの表示は機械的に抜き出したものなので、詳しく知りたいときは、原文で確認してください。",
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
        <p class="ev-help">${HELP.rateBoj}</p>
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
        <p class="ev-help">${HELP.rateFomc}</p>
      </div>`;
  } else if (r.headline) {
    html += `<div class="ev-result"><div class="ev-result__label">講演タイトル（公式・英語）</div><div class="ev-result__main ev-result__main--sm">${esc(r.headline)}</div><p class="ev-help">${HELP.headline}</p></div>`;
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
      <p class="ev-help">${HELP.sep}</p>
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
        <p class="ev-help">${HELP.diff}</p>
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
      ${EVENT_INTRO[ev.type] ? `<section class="ev-section ev-intro"><h3>このイベントとは？</h3><p class="ev-help">${EVENT_INTRO[ev.type]}</p></section>` : ""}
      ${resultHtml(ev)}
      ${sepHtml(ev.sep)}
      ${diffBlock}
      ${links ? `<section class="ev-section"><h3>公式資料</h3><p class="ev-help">${HELP.links}</p><ul class="ev-links">${links}</ul></section>` : ""}
      <p class="ev-note ev-note--foot">※ 公式ページの記載を機械的に抽出・比較したもので、内容の解釈・要約・将来予測は含みません（AIによる分析ではありません）。結果は定期更新のタイミングで反映されるため、発表直後は未反映の場合があります。</p>
    </div>`;
}
