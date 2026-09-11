const THEME_KEY = "keizai-tracker-theme"; // localStorage: "light" | "dark"（未設定＝OS設定に追従）

export function isDarkNow() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function updateThemeToggleIcon() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const dark = isDarkNow();
  // 表示するのは「切り替えた先」のアイコン
  btn.textContent = dark ? "☀️" : "🌙";
  const label = dark ? "ライトモードに切り替え" : "ダークモードに切り替え";
  btn.setAttribute("aria-label", label);
  btn.title = label;
}

/** テーマ切替ボタンを初期化する。切替後に色を再描画したいページは onToggle に処理を渡す */
export function initTheme(onToggle) {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* プライベートブラウジング等でlocalStorageが使えない場合はOS設定に追従 */
  }
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  }
  updateThemeToggleIcon();

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = isDarkNow() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* 保存できなくても表示の切り替え自体は機能する */
    }
    updateThemeToggleIcon();
    onToggle?.();
  });
}
