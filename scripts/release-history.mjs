/**
 * 経済指標の「発表履歴」（いつ・どの期間の・いくつの値が出たか）を public/data/releases.json に蓄積する。
 *
 * 背景：カレンダーに載せる「次回発表予定日」は指標ごとに1つだけで、発表されると次回の日付に
 * 切り替わり、発表日そのものはデータから消える。そこで、自動更新のたびに「前回のデータより新しい
 * 期間の値が増えたか」を比べて、増えていたら発表があったとみなして履歴に追記する。
 *
 * 発表日の決め方：
 *   - 前回データの nextRelease が公式（FRED等）で、実行日以前かつ14日以内ならその日付（kind: "official"）。
 *   - それ以外（推定日しかない指標・日付が合わない場合）は、データが反映されたことを検出した実行日
 *     （kind: "detected"）。日本版は日本時間の日付。実際の発表日と1日程度ずれることがある。
 *
 * 対象外：日次の指標（毎日値が増えるため「発表」ではない）、次回発表予定日を持たない指標
 *   （カレンダーに載らない指標。日本版の無担保コールレート等）。
 * 保持期間は RETENTION_DAYS（365日）。古い履歴は更新のたびに削除する。
 *
 * このファイルは日米で共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */
import { readFile, writeFile } from "node:fs/promises";

export const RETENTION_DAYS = 365;

/** 現在時刻を指定のUTCオフセット（時間）の日付文字列 "YYYY-MM-DD" にする */
export function dateInTz(now, tzOffsetHours) {
  return new Date(now.getTime() + tzOffsetHours * 3600e3).toISOString().slice(0, 10);
}

const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);

/**
 * @param prevInd 前回の indicators.json の指標レコード
 * @param newInd 今回の指標レコード
 * @param {{runDate: string, isOfficial: (ind: object) => boolean}} opts
 * @returns 履歴1件 または null（発表なし／対象外）
 */
export function detectRelease(prevInd, newInd, { runDate, isOfficial }) {
  if (!prevInd || !newInd) return null;
  if (newInd.frequency === "daily") return null;
  if (!prevInd.nextRelease && !newInd.nextRelease) return null;
  const prevLast = prevInd.points?.at(-1);
  const last = newInd.points?.at(-1);
  if (!prevLast || !last || !(last.t > prevLast.t)) return null;

  const official =
    isOfficial(prevInd) &&
    prevInd.nextRelease &&
    prevInd.nextRelease <= runDate &&
    dayDiff(prevInd.nextRelease, runDate) <= 14;

  const entry = {
    date: official ? prevInd.nextRelease : runDate,
    t: last.t,
    value: last.value,
    kind: official ? "official" : "detected",
  };
  const prevPoint = newInd.points.at(-2);
  if (prevPoint) entry.prev = prevPoint.value;
  if (last.provisional) entry.provisional = true;
  return entry;
}

/** 履歴に1件追記する（同じ指標・同じ対象期間があれば何もしない）。追記したら true */
export function addRelease(releases, id, entry) {
  const list = (releases[id] ??= []);
  if (list.some((r) => r.t === entry.t)) return false;
  list.push(entry);
  return true;
}

/** 保持期間より古い履歴を削除し、日付順に並べる */
export function pruneAndSort(releases, runDate) {
  const cutoffMs = Date.parse(runDate) - RETENTION_DAYS * 86400e3;
  for (const id of Object.keys(releases)) {
    releases[id] = releases[id].filter((r) => Date.parse(r.date) >= cutoffMs).sort((a, b) => a.date.localeCompare(b.date) || a.t.localeCompare(b.t));
    if (!releases[id].length) delete releases[id];
  }
  return releases;
}

export async function readReleases(file) {
  try {
    const json = JSON.parse(await readFile(file, "utf8"));
    return json.releases && typeof json.releases === "object" ? json.releases : {};
  } catch {
    return {};
  }
}

/**
 * 自動更新の1回分：前回の指標データ（prevIndicators）と今回（newIndicators）を比べて履歴を更新し、
 * 内容が変わったときだけ file に書き出す。戻り値は追記件数。
 */
export async function updateReleaseHistory({ file, prevIndicators, newIndicators, runDate, isOfficial }) {
  const releases = await readReleases(file);
  const before = JSON.stringify(releases);
  const prevById = new Map((prevIndicators ?? []).map((i) => [i.id, i]));
  let added = 0;
  for (const ind of newIndicators) {
    const entry = detectRelease(prevById.get(ind.id), ind, { runDate, isOfficial });
    if (entry && addRelease(releases, ind.id, entry)) added++;
  }
  pruneAndSort(releases, runDate);
  if (JSON.stringify(releases) !== before) {
    const payload = { generatedAt: new Date().toISOString(), retentionDays: RETENTION_DAYS, releases };
    await writeFile(file, JSON.stringify(payload, null, 1) + "\n", "utf8");
  }
  return added;
}
