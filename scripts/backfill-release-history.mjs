/**
 * 発表履歴（public/data/releases.json）を、gitに残っている過去の indicators.json から復元する（一度だけ実行）。
 *
 *   node scripts/backfill-release-history.mjs --tz 0 --official all     （米国版）
 *   node scripts/backfill-release-history.mjs --tz 9 --official kind    （日本版）
 *
 * indicators.json を変更したコミットを古い順にたどり、隣り合う2つを比べて、新しい期間の値が増えて
 * いたら release-history.mjs と同じ規則で履歴に追記する。実行日（日付）はコミット時刻から決める。
 *   --tz       日付を決めるUTCオフセット（時間）。米国版 0、日本版 9。
 *   --official 発表日に前回データの nextRelease を使ってよい指標：all＝全指標（FRED等）、kind＝nextReleaseKind が official のものだけ。
 * 既存の履歴は残したまま追記する（同じ指標・同じ対象期間は重複しない）。
 */
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectRelease, addRelease, pruneAndSort, readReleases, dateInTz, RETENTION_DAYS } from "./release-history.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const tz = Number(arg("tz", "0"));
const officialMode = arg("official", "all");
const isOfficial = officialMode === "kind" ? (ind) => ind.nextReleaseKind === "official" : () => true;

const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" });

const FILE = "public/data/indicators.json";
const commits = git("log", "--reverse", "--format=%H %ct", "--", FILE)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [hash, ct] = l.split(" ");
    return { hash, date: dateInTz(new Date(Number(ct) * 1000), tz) };
  });

const out = resolve(root, "public/data/releases.json");
const releases = await readReleases(out);
let prev = null;
let added = 0;
for (const c of commits) {
  let cur;
  try {
    cur = JSON.parse(git("show", `${c.hash}:${FILE}`)).indicators;
  } catch {
    continue; // 解析できない（競合マーカーなど）コミットは飛ばす
  }
  if (prev) {
    const prevById = new Map(prev.map((i) => [i.id, i]));
    for (const ind of cur) {
      const entry = detectRelease(prevById.get(ind.id), ind, { runDate: c.date, isOfficial });
      if (entry && addRelease(releases, ind.id, entry)) added++;
    }
  }
  prev = cur;
}

const today = dateInTz(new Date(), tz);
pruneAndSort(releases, today);
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), retentionDays: RETENTION_DAYS, releases }, null, 1) + "\n", "utf8");
console.log(`コミット ${commits.length} 件を走査、${added} 件を追記 → ${out}`);
const n = Object.values(releases).reduce((a, l) => a + l.length, 0);
console.log(`履歴の合計 ${n} 件（${Object.keys(releases).length} 指標）`);
