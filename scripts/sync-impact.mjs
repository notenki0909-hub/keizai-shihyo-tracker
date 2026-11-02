/**
 * 波及の説明（impact.config.mjs / impact-sectors.config.mjs）の変更を、データを取得し直さずに
 * public/data/indicators.json の各指標の impact に反映する。
 *
 * 説明文だけを直したときに使う（通常は自動更新の取得処理が毎回 impact を書き込む）。
 * 取得元の障害などで取得し直せないときにも、説明文の変更だけを反映できる。
 * 内容に変化がなければ書き換えない。
 *
 * 使い方: npm run sync:impact
 *
 * このファイルは日米共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { IMPACT } from "./impact.config.mjs";
import { writeJsonIfChanged } from "./write-json-if-changed.mjs";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data/indicators.json");
const payload = JSON.parse(await readFile(file, "utf8"));

let changed = 0;
for (const ind of payload.indicators) {
  const next = IMPACT[ind.id] ?? undefined;
  if (JSON.stringify(ind.impact) !== JSON.stringify(next)) changed++;
  ind.impact = next;
}

const wrote = await writeJsonIfChanged(file, payload, 2);
console.log(wrote ? `${changed} 指標の impact を更新しました: ${file}` : "変更なし（indicators.json は書き換えない）");
