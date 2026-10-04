/**
 * 内閣府「景気ウォッチャー調査」の、景気の現状判断DI（全国・合計）を取得する。
 *
 * 統計表（Excel）: https://www5.cao.go.jp/keizai3/watcher.html の「I．全国の分野・業種別ＤＩの推移」
 * （watcher/watcher3.xls）。シート「1.景気の現状判断（方向性）」は、B列に年（1月の行のみ「2026年」）、
 * C列に月（「１月」）、D列に「合計」＝全国の現状判断DI（季節調整値）が縦に並ぶ形式。
 */
import XLSX from "xlsx";

const URL = "https://www5.cao.go.jp/keizai3/watcher/watcher3.xls";
const SHEET = "1.景気の現状判断（方向性）";

export function parseWatchersSheet(rows) {
  let year = null;
  const points = [];
  for (const r of rows) {
    const y = String(r[1] ?? "").normalize("NFKC").match(/^(\d{4})年/);
    if (y) year = Number(y[1]);
    const m = String(r[2] ?? "").normalize("NFKC").match(/^(\d{1,2})月/);
    const v = r[3];
    if (!year || !m || typeof v !== "number" || !Number.isFinite(v)) continue;
    const mm = String(m[1]).padStart(2, "0");
    points.push({ t: `${year}-${mm}`, date: `${year}-${mm}-01`, value: v });
  }
  return points;
}

export async function fetchWatchersDi() {
  const res = await fetch(URL, { headers: { "User-Agent": "keizai-shihyo-tracker" }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const sheet = wb.Sheets[SHEET] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("シートが見つかりません");
  const points = parseWatchersSheet(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }));
  if (!points.length) throw new Error("有効なデータ点を1件も取得できませんでした");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
