/** イベント取得スクリプト共通のユーティリティ（HTML取得・整形・差分計算） */

const UA = "Mozilla/5.0 (compatible; us-economic-tracker; +https://github.com/notenki0909-hub/us-economic-tracker)";

/** 取得に失敗してもスクリプト全体を止めないよう、{ ok, status, text } を返す */
export async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    return { ok: true, status: res.status, text: await res.text() };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—" };

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m] ?? m);
}

export function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function ymd(d) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

/**
 * トークン列aからbへのLCS差分。同種のトークンが連続する区間は1つのセグメントにまとめる。
 * 戻り値: [{ t: "same" | "add" | "del", s: "連結した文字列" }, ...]
 */
export function diffTokens(a, b, joiner = " ") {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ t: "same", s: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ t: "del", s: a[i++] });
    } else {
      raw.push({ t: "add", s: b[j++] });
    }
  }
  while (i < n) raw.push({ t: "del", s: a[i++] });
  while (j < m) raw.push({ t: "add", s: b[j++] });

  const merged = [];
  for (const seg of raw) {
    const last = merged.at(-1);
    if (last && last.t === seg.t) last.s += joiner + seg.s;
    else merged.push({ ...seg });
  }
  return merged;
}
