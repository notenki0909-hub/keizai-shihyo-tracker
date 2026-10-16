/**
 * 自動更新（GitHub Actions）の「最終チェック」を、ヘッダーの更新情報の横に表示する。
 *
 * 背景：データに変化がない回はファイルを書き換えず、コミットも再公開もしない（無駄を省くため）。そのため
 * 「データの最終更新」は、データが実際に変わった時刻になる。取得は毎回行っていることを示すため、
 * GitHubの公開API（認証不要）から、定期実行の直近の実行時刻と結果を取得して表示する。
 *   https://api.github.com/repos/<owner>/<repo>/actions/workflows/deploy.yml/runs?event=schedule
 * APIの利用制限（未認証は1時間60回／IP）に配慮して、10分間はブラウザ（sessionStorage）にキャッシュする。
 * 取得できないときは何も表示しない（サイト本体の表示には影響しない）。
 *
 * このファイルは日米共通（us-economic-tracker が原本、keizai-shihyo-tracker へコピー）。
 */
const OWNER = "notenki0909-hub";
const CACHE_MS = 10 * 60 * 1000;

async function loadLatestRun(repo) {
  const key = `fetch-status-${repo}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.run;
  } catch {
    // キャッシュが使えなくても取得は続ける
  }
  try {
    const url = `https://api.github.com/repos/${OWNER}/${repo}/actions/workflows/deploy.yml/runs?event=schedule&per_page=1`;
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const r = (await res.json()).workflow_runs?.[0];
    if (!r) return null;
    const run = { time: r.updated_at, status: r.status, conclusion: r.conclusion };
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), run }));
    } catch {
      // 保存できなくても表示には影響しない
    }
    return run;
  } catch {
    return null;
  }
}

const pad = (n) => String(n).padStart(2, "0");
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}`;
};

/** #fetch-status に、直近の自動更新の実行時刻と結果を表示する */
export async function showFetchStatus(repo) {
  const el = document.getElementById("fetch-status");
  if (!el) return;
  const run = await loadLatestRun(repo);
  if (!run) return;
  if (run.status !== "completed") {
    el.textContent = `　／　自動更新：実行中（${fmtDateTime(run.time)}）`;
  } else if (run.conclusion === "success") {
    el.innerHTML = `　／　自動更新の最終チェック：${fmtDateTime(run.time)} <span class="fetch-status__ok" title="データに変化がない回も、毎回取得してチェックしています。変化がなければ更新・公開はしません。">✓ 正常</span>`;
  } else {
    el.innerHTML = `　／　<span class="fetch-status__ng">⚠ 直近の自動更新が失敗しました（${fmtDateTime(run.time)}）</span>`;
  }
}
