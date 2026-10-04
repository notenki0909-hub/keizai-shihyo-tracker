/**
 * 経済指標以外のイベント（日銀の金融政策決定会合・展望レポート・主な意見・議事要旨・総裁会見）を
 * 取得して public/data/events.json に書き出す。
 *
 * 指標データ（fetch-indicators.mjs）とは別ファイル・別プロセスにしている。日銀のページ構造が
 * 変わってイベント取得が失敗しても、指標データの更新を止めないため。取得に失敗した取得元の
 * イベントは、既存のevents.jsonの内容をそのまま維持する。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBojEvents } from "./fetch-boj-events.mjs";
import { isoDate, addDays } from "./events-util.mjs";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data");
const OUT_FILE = resolve(OUT_DIR, "events.json");
const KEEP_PAST_DAYS = 400;

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUT_FILE, "utf8")).events ?? [];
  } catch {
    return [];
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const existing = await loadExisting();
  const now = new Date();
  const todayStr = isoDate(now);
  const cutoff = isoDate(addDays(now, -KEEP_PAST_DAYS));

  const { events: fresh, failedSrc } = await buildBojEvents(existing, now);
  if (failedSrc.size) console.warn(`取得に失敗した取得元（既存データを維持）: ${[...failedSrc].join(", ")}`);

  // 今回生成されなかった既存イベントのうち、(a) 過去のもの（履歴）、(b) 取得に失敗した取得元のものは残す。
  // 未来の日付で今回は出てこなかったものは、延期・中止の可能性があるため落とす。
  const freshIds = new Set(fresh.map((e) => e.id));
  const kept = existing.filter(
    (e) => !freshIds.has(e.id) && (e.date < todayStr || failedSrc.has(e.src))
  );
  const events = [...fresh, ...kept]
    .filter((e) => e.date >= cutoff)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

  if (!events.length) {
    console.error("イベントを1件も取得できませんでした。既存の JSON は変更しません。");
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "日本銀行の公式ページ（金融政策決定会合）",
    eventCount: events.length,
    events,
  };
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 1) + "\n", "utf8");
  const byType = events.reduce((acc, e) => ((acc[e.type] = (acc[e.type] ?? 0) + 1), acc), {});
  console.log(`書き出し: ${OUT_FILE}`);
  console.log(`イベント ${events.length} 件:`, byType);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
