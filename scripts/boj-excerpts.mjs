/**
 * 日銀の公式PDF（行単位に分解済み）から、重要な部分を原文のまま抜き出す。要約・言い換えはしない。
 *
 * 入力の lines は [{ p: ページ, x: 行頭のX座標, h: 文字の高さ, t: 空白を除いたNFKC正規化済みの文字列 }]。
 * 戻り値の sections は [{ heading, paragraphs: [文字列...] }]。
 */

/** 最も多くの文字に使われている文字の高さ（＝本文の大きさ）。脚注・ページ番号はこれより小さい */
export function bodyHeightOf(lines) {
  const count = new Map();
  for (const l of lines) if (l.h > 0) count.set(l.h, (count.get(l.h) ?? 0) + l.t.length);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

const isBody = (l, bh) => l.h >= bh * 0.95;
const isHeading = (l, bh) => l.h > bh * 1.05;

/** 公表文の本文を、番号付きの項目（1. 2. 3. …）に分ける */
export function statementItems(text) {
  let start = text.search(/(?:1\.)?日本銀行は、本日/);
  if (start < 0) start = 0;
  const ref = text.indexOf("(参考)");
  const body = text.slice(start, ref > start ? ref : undefined);
  // 「1.」「2.」の項番号で分ける（「1.25%」のような小数や「(1)」は除く）
  const items = body.split(/(?=(?<![\d(])\d\.(?!\d))/).map((s) => s.trim()).filter(Boolean);
  return items.length ? [{ heading: "公表文の本文", paragraphs: items }] : [];
}

/** 「⚫」で始まる箇条書きに行を詰める */
function toBullets(lines) {
  const out = [];
  for (const l of lines) {
    if (l.t.startsWith("⚫")) out.push(l.t.slice(1));
    else if (out.length) out[out.length - 1] += l.t;
  }
  return out;
}

/** 展望レポート 基本的見解の「概要」（公式がまとめた要約部分）を抜き出す */
export function outlookExcerpt(lines) {
  const bh = bodyHeightOf(lines);
  const body = lines.filter((l) => isBody(l, bh) || isHeading(l, bh));
  const start = body.findIndex((l) => /^<概要>$/.test(l.t));
  if (start < 0) return [];
  let end = body.findIndex((l, i) => i > start && /^1\.わが国の経済・物価の現状/.test(l.t));
  if (end < 0) end = body.length;
  const bullets = toBullets(body.slice(start + 1, end));
  return bullets.length ? [{ heading: "基本的見解の概要（公式の要約部分）", paragraphs: bullets }] : [];
}

/** 主な意見：見出し（I. II. …／（経済情勢）等）ごとの箇条書き */
export function opinionExcerpt(lines) {
  const bh = bodyHeightOf(lines);
  let major = "";
  let minor = "";
  const sections = [];
  let current = null;
  for (const l of lines) {
    if (!(isBody(l, bh) || isHeading(l, bh))) continue;
    if (/^公表時間/.test(l.t) || /^\d+月\d+日\(.\)\d+時\d+分$/.test(l.t)) continue;
    if (isHeading(l, bh)) {
      if (/^[IVX]+\./.test(l.t)) {
        major = l.t;
        minor = "";
      } else if (/^\(.+\)$/.test(l.t) && major) {
        minor = l.t;
      } else continue;
      current = null;
      continue;
    }
    if (!major) continue;
    if (l.t.startsWith("⚫")) {
      if (!current) {
        current = { heading: minor ? `${major} ${minor}` : major, paragraphs: [] };
        sections.push(current);
      }
      current.paragraphs.push(l.t.slice(1));
    } else if (current?.paragraphs.length) {
      current.paragraphs[current.paragraphs.length - 1] += l.t;
    }
  }
  return sections;
}

/** 議事要旨：「金融政策運営に関する委員会の検討の概要」の章を段落ごとに抜き出す */
export function minutesExcerpt(lines) {
  const bh = bodyHeightOf(lines);
  const body = lines.filter((l) => isBody(l, bh) || isHeading(l, bh));
  const start = body.findIndex((l) => isHeading(l, bh) && /金融政策運営に関する委員会の検討の概要/.test(l.t));
  if (start < 0) return [];
  let end = body.findIndex((l, i) => i > start && isHeading(l, bh) && /^[IVX]+\./.test(l.t));
  if (end < 0) end = body.length;
  const chapter = body.slice(start + 1, end);
  // 段落の1行目は字下げされている（本文の行頭より右に始まる）
  const xs = new Map();
  for (const l of chapter) xs.set(Math.round(l.x), (xs.get(Math.round(l.x)) ?? 0) + 1);
  const baseX = [...xs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const paras = [];
  for (const l of chapter) {
    if (!paras.length || l.x > baseX + 8) paras.push(l.t);
    else paras[paras.length - 1] += l.t;
  }
  return paras.length ? [{ heading: body[start].t.replace(/^([IVX]+)\./, "$1. "), paragraphs: paras }] : [];
}

/** 総裁会見：最初の質問への答え（総裁の冒頭説明）を読みやすい長さの段落に分けて抜き出す */
export function pressExcerpt(lines) {
  const bh = bodyHeightOf(lines);
  const body = lines.filter((l) => isBody(l, bh));
  const start = body.findIndex((l) => l.t === "(答)");
  if (start < 0) return [];
  let end = body.findIndex((l, i) => i > start && l.t === "(問)");
  if (end < 0) end = body.length;
  const text = body.slice(start + 1, end).map((l) => l.t).join("");
  const paras = [];
  let cur = "";
  for (const s of text.split(/(?<=。)/)) {
    if (cur && cur.length + s.length > 260) {
      paras.push(cur);
      cur = "";
    }
    cur += s;
  }
  if (cur) paras.push(cur);
  return paras.length ? [{ heading: "最初の質問への総裁の説明（会見記録の冒頭）", paragraphs: paras }] : [];
}
