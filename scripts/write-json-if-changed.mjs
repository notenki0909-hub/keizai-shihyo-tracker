/**
 * JSONの書き出し。内容に変化がなければ（取得時刻 generatedAt だけが違う場合は変化なしとみなす）ファイルを書き換えない。
 *
 * 理由：自動更新は1日に複数回走る。generatedAt が毎回変わるだけで「変更あり」になると、
 * データに変化がない回でも毎回コミット・再公開してしまう（コミット履歴の増加・無駄な再デプロイ）。
 * 書き換えなければ、ワークフローの「変更があればコミット」がそのまま「変更なし」で終わる。
 * 副作用：画面の「最終更新」は、データが実際に変わった回の時刻になる（取得を試みた時刻ではない）。
 *
 * このファイルは日米共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */
import { readFile, writeFile } from "node:fs/promises";

const stripTimestamps = (v) => JSON.stringify(v, (key, x) => (key === "generatedAt" ? undefined : x));

/** @returns {Promise<boolean>} 書き換えたら true */
export async function writeJsonIfChanged(file, payload, indent = 2) {
  let old = null;
  try {
    old = JSON.parse(await readFile(file, "utf8"));
  } catch {
    // 初回・読めない場合は書き出す
  }
  if (old && stripTimestamps(old) === stripTimestamps(payload)) return false;
  await writeFile(file, JSON.stringify(payload, null, indent) + "\n", "utf8");
  return true;
}
