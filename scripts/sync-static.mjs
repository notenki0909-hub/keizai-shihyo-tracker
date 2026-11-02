/**
 * 設定ファイルにある「固定の文章」の変更を、データを取得し直さずに public/data/indicators.json へ反映する。
 *   - 波及の説明（impact.config.mjs / impact-sectors.config.mjs）→ 各指標の impact
 *   - 波及ルート（indicators.config.mjs の ripple と ripple-extra.config.mjs）→ 各指標の ripple
 *   - カテゴリごとの「①まず見る／②次に見る」ガイド（indicators.config.mjs の CATEGORY_GUIDES）→ categoryGuides
 *
 * 説明文だけを直したときに使う（通常は自動更新の取得処理が毎回これらを書き込む）。
 * 取得元の障害などで取得し直せないときにも、文章の変更だけを反映できる。
 * 内容に変化がなければ書き換えない。
 *
 * 使い方: npm run sync:static
 *
 * このファイルは日米共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { IMPACT } from "./impact.config.mjs";
import { INDICATORS, CATEGORY_GUIDES } from "./indicators.config.mjs";
import { writeJsonIfChanged } from "./write-json-if-changed.mjs";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data/indicators.json");
const payload = JSON.parse(await readFile(file, "utf8"));

const rippleById = new Map(INDICATORS.map((i) => [i.id, i.ripple ?? undefined]));

const changes = [];
for (const ind of payload.indicators) {
  const next = IMPACT[ind.id] ?? undefined;
  if (JSON.stringify(ind.impact) !== JSON.stringify(next)) changes.push(`impact:${ind.id}`);
  ind.impact = next;

  const nextRipple = rippleById.get(ind.id);
  if (JSON.stringify(ind.ripple) !== JSON.stringify(nextRipple)) changes.push(`ripple:${ind.id}`);
  ind.ripple = nextRipple;
}
if (JSON.stringify(payload.categoryGuides) !== JSON.stringify(CATEGORY_GUIDES)) changes.push("categoryGuides");
payload.categoryGuides = CATEGORY_GUIDES;

const wrote = await writeJsonIfChanged(file, payload, 2);
console.log(wrote ? `${changes.length} 件を更新しました（${changes.join(", ")}）: ${file}` : "変更なし（indicators.json は書き換えない）");
