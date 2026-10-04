/**
 * 日本銀行の金融政策決定会合まわりのイベント（会合・展望レポート・主な意見・議事要旨・
 * 総裁定例記者会見）の日程と、発表済みの会合結果（政策金利・賛否・前回公表文との文言差分）を、
 * 日銀公式の「金融政策決定会合」一覧ページとその公表文PDFから取得する。
 * AIによる要約・解釈は行わず、公式文書の記載をそのまま構造化／リンクする。
 *
 * 取得元:
 *  - https://www.boj.or.jp/mopo/mpmsche_minu/index.htm （年ごとの表：開催日、各資料の公表日とリンク）
 *  - 各会合の「金融市場調節方針に関する公表文」PDF（政策金利・賛否・本文）
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fetchText, stripTags, ymd, isoDate, addDays, diffTokens } from "./events-util.mjs";
import {
  bodyHeightOf,
  statementItems,
  outlookExcerpt,
  opinionExcerpt,
  minutesExcerpt,
  pressExcerpt,
} from "./boj-excerpts.mjs";

const BASE = "https://www.boj.or.jp";
const SCHEDULE_URL = `${BASE}/mopo/mpmsche_minu/index.htm`;
const WINDOW_PAST_DAYS = 400;
const WINDOW_FUTURE_DAYS = 400;
const PDFJS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/pdfjs-dist");

/** "1月22日（木）・23日（金）" / "2027年 1月27日（水）" → Date[]（月・年は直前の値を引き継ぐ） */
export function parseJaDates(text, defaultYear) {
  const out = [];
  let year = defaultYear;
  let month = null;
  for (const m of text.matchAll(/(?:(\d{4})年\s*)?(?:(\d{1,2})月\s*)?(\d{1,2})日/g)) {
    if (m[1]) year = Number(m[1]);
    if (m[2]) month = Number(m[2]);
    if (month == null) continue;
    out.push(new Date(Date.UTC(year, month - 1, Number(m[3]))));
  }
  return out;
}

/** 一覧ページの年別の表から、会合ごとの行を取り出す */
export function parseSchedule(html) {
  const meetings = [];
  for (const table of html.matchAll(/<table>\s*<caption[^>]*>\s*表[\s　]*(\d{4})年\s*<\/caption>([\s\S]*?)<\/table>/g)) {
    const year = Number(table[1]);
    const tbody = table[2].slice(table[2].indexOf("<tbody>"));
    for (const tr of tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (tds.length < 5) continue;
      const cells = tds.map((td) => {
        const href = td.match(/href="([^"]+)"/)?.[1];
        return { url: href ? new URL(href, BASE).href : null, dates: parseJaDates(stripTags(td), year) };
      });
      const dates = cells[0].dates;
      if (!dates.length) continue;
      meetings.push({
        start: dates[0],
        end: dates.at(-1),
        statementUrl: cells[0].url,
        outlook: cells[1],
        opinion: cells[2],
        minutes: cells[3],
        press: cells[4],
      });
    }
  }
  return meetings.sort((a, b) => a.end - b.end);
}

/** PDFを行単位に分解して返す。[{ p, x, h, t }]（tは空白を除いたNFKC正規化済みの文字列） */
async function fetchPdfLines(url, maxPages = Infinity) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    const doc = await getDocument({
      data: new Uint8Array(await res.arrayBuffer()),
      cMapUrl: resolve(PDFJS_DIR, "cmaps") + "/",
      cMapPacked: true,
      standardFontDataUrl: resolve(PDFJS_DIR, "standard_fonts") + "/",
    }).promise;
    const pages = [];
    const count = new Map();
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const items = (await (await doc.getPage(p)).getTextContent()).items;
      pages.push(items);
      for (const it of items) if (it.height > 0) count.set(it.height, (count.get(it.height) ?? 0) + it.str.length);
    }
    const bodyH = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const lines = [];
    pages.forEach((items, idx) => {
      const p = idx + 1;
      let cur = "";
      let x = null;
      let h = 0;
      const flush = () => {
        const t = cur.normalize("NFKC").replace(/\s+/g, "");
        if (t) lines.push({ p, x: x ?? 0, h, t });
        cur = "";
        x = null;
        h = 0;
      };
      for (const it of items) {
        // 脚注番号・「（注）」など、本文よりずっと小さい文字は取り込まない
        const tiny = it.height > 0 && it.height < bodyH * 0.8;
        if (!tiny) {
          if (x === null && it.str.trim()) x = it.transform[4];
          cur += it.str;
          h = Math.max(h, it.height);
        }
        if (it.hasEOL) flush();
      }
      flush();
    });
    return lines;
  } catch {
    return null;
  }
}

/** 本文だけの文字列（脚注・ページ番号を除く）。公表文の解析に使う */
function bodyText(lines) {
  const bh = bodyHeightOf(lines);
  return lines.filter((l) => l.h >= bh * 0.95).map((l) => l.t).join("");
}

/** 公表文のテキストから政策金利・賛否・本文（文単位）を取り出す */
export function parseStatementText(t) {
  const rate = t.match(/無担保コールレート\(オーバーナイト物\)を、?(\d+(?:\.\d+)?)%程度/);
  const v = t.match(/\((全員一致|賛成(\d+)反対(\d+))\)/);
  let bodyStart = t.search(/(?:1\.)?日本銀行は、本日/);
  if (bodyStart < 0) bodyStart = 0;
  const refIdx = t.indexOf("(参考)");
  const body = t.slice(bodyStart, refIdx > bodyStart ? refIdx : undefined);
  return {
    rate: rate ? Number(rate[1]) : null,
    vote: v ? (v[1] === "全員一致" ? { unanimous: true } : { for: Number(v[2]), against: Number(v[3]) }) : null,
    sentences: body.split(/(?<=。)/).filter(Boolean),
  };
}

function monthDay(d) {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** 日銀イベントをすべて組み立てる。existing: 既存のevents.jsonのevents */
export async function buildBojEvents(existing, now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const winStart = addDays(today, -WINDOW_PAST_DAYS);
  const winEnd = addDays(today, WINDOW_FUTURE_DAYS);
  const oldById = new Map(existing.map((e) => [e.id, e]));
  const failedSrc = new Set();
  const events = [];

  const sched = await fetchText(SCHEDULE_URL);
  if (!sched.ok) return { events, failedSrc: new Set(["boj"]) };
  const meetings = parseSchedule(sched.text);
  if (!meetings.length) return { events, failedSrc: new Set(["boj"]) };

  const stmtCache = new Map();
  const getStatement = async (m) => {
    if (!m.statementUrl) return null;
    if (!stmtCache.has(m.statementUrl)) {
      const lines = await fetchPdfLines(m.statementUrl);
      const text = lines ? bodyText(lines) : null;
      stmtCache.set(
        m.statementUrl,
        text ? { ...parseStatementText(text), excerpt: statementItems(text) } : null
      );
    }
    return stmtCache.get(m.statementUrl);
  };

  const push = (ev) => {
    const old = oldById.get(ev.id);
    events.push(
      old
        ? {
            ...ev,
            status: old.status === "done" ? "done" : ev.status,
            links: [...new Map([...(old.links ?? []), ...ev.links].map((l) => [l.url, l])).values()],
            result: ev.result ?? old.result,
            diff: ev.diff ?? old.diff,
            excerpt: ev.excerpt ?? old.excerpt,
          }
        : ev
    );
  };

  for (let i = 0; i < meetings.length; i++) {
    const m = meetings[i];
    if (m.end < winStart || m.end > winEnd) continue;
    const code = ymd(m.end);
    const range = `${monthDay(m.start)}–${monthDay(m.end)}`;

    /* 会合（政策金利の決定） */
    const id = `boj-${code}`;
    const old = oldById.get(id);
    const ev = {
      id,
      src: "boj",
      type: "boj",
      date: isoDate(m.end),
      title: "日銀 金融政策決定会合（政策金利の決定）",
      short: "日銀会合",
      subtitle: `${range}の2日間会合。決定は最終日に公表${m.outlook.dates.length ? "（展望レポートあり）" : ""}`,
      time: "",
      status: m.statementUrl ? "done" : "scheduled",
      links: m.statementUrl ? [{ label: "金融市場調節方針に関する公表文（日銀公式・PDF）", url: m.statementUrl }] : [],
    };
    if (old?.status === "done" && old.result && old.excerpt?.length) {
      events.push({ ...old, subtitle: ev.subtitle, short: ev.short });
    } else {
      if (m.statementUrl) {
        const cur = await getStatement(m);
        if (cur) {
          ev.result = { rate: cur.rate, vote: cur.vote };
          if (cur.excerpt.length) ev.excerpt = cur.excerpt;
          const prev = meetings[i - 1];
          const prevSt = prev ? await getStatement(prev) : null;
          if (prevSt) {
            ev.result.prevRate = prevSt.rate;
            if (cur.rate != null && prevSt.rate != null) {
              ev.result.action = cur.rate > prevSt.rate ? "hike" : cur.rate < prevSt.rate ? "cut" : "hold";
            }
            ev.diff = {
              prevDate: isoDate(prev.end),
              unit: "sentence",
              segments: diffTokens(prevSt.sentences, cur.sentences, ""),
            };
          }
        }
      }
      push(ev);
    }

    /* 関連する公表物：展望レポート・主な意見・議事要旨・総裁会見 */
    const related = [
      {
        key: "outlook",
        type: "boj_outlook",
        title: "日銀 経済・物価情勢の展望（展望レポート）",
        short: "展望レポート",
        subtitle: `${range}会合分。経済・物価の見通し（政策委員の見通しの中央値）。基本的見解は会合終了後直ちに、背景説明を含む全文は翌営業日14時に公表`,
        time: "会合終了後",
        linkLabel: "展望レポート 基本的見解（日銀公式・PDF）",
        extract: (lines) => outlookExcerpt(lines),
        maxPages: 8,
      },
      {
        key: "opinion",
        type: "boj_opinion",
        title: "日銀 金融政策決定会合における主な意見",
        short: "日銀 主な意見",
        subtitle: `${range}会合分。政策委員の主な意見の要約`,
        time: "08:50 JST",
        linkLabel: "主な意見（日銀公式・PDF）",
        extract: (lines) => opinionExcerpt(lines),
      },
      {
        key: "minutes",
        type: "boj_minutes",
        title: "日銀 金融政策決定会合 議事要旨",
        short: "日銀 議事要旨",
        subtitle: `${range}会合分。次回会合後に承認・公表される議事要旨`,
        time: "08:50 JST",
        linkLabel: "議事要旨（日銀公式・PDF）",
        extract: (lines) => minutesExcerpt(lines),
      },
      {
        key: "press",
        type: "boj_press",
        title: "日銀総裁 定例記者会見",
        short: "日銀総裁会見",
        subtitle: `${range}会合分。会見の記録は後日公表`,
        time: "",
        linkLabel: "総裁会見の記録（日銀公式・PDF）",
        extract: (lines) => pressExcerpt(lines),
        maxPages: 3,
      },
    ];
    for (const r of related) {
      const c = m[r.key];
      const d = c.dates.at(-1);
      if (!d) continue;
      const relId = `${r.type.replace("_", "-")}-${code}`;
      let excerpt = oldById.get(relId)?.excerpt;
      if (c.url && !excerpt?.length) {
        const lines = await fetchPdfLines(c.url, r.maxPages);
        excerpt = lines ? r.extract(lines) : undefined;
      }
      push({
        id: relId,
        ...(excerpt?.length ? { excerpt } : {}),
        src: "boj",
        type: r.type,
        date: isoDate(d),
        title: r.title,
        short: r.short,
        subtitle: r.subtitle,
        time: r.time,
        status: c.url || d < today ? "done" : "scheduled",
        links: c.url ? [{ label: r.linkLabel, url: c.url }] : [],
      });
    }
  }

  return { events, failedSrc };
}
