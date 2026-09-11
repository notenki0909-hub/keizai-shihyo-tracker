const FAV_KEY = "keizai-tracker-favorites"; // localStorage: 指標idの配列（JSON）

function readFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set(); // プライベートブラウジング等でlocalStorageが使えない場合は毎回空扱い
  }
}

function writeFavorites(set) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
  } catch {
    /* 保存できなくても表示上の切り替え自体は機能する（次回訪問時には引き継がれない） */
  }
}

export function isFavorite(id) {
  return readFavorites().has(id);
}

export function getFavorites() {
  return readFavorites();
}

/** お気に入りの状態を反転させ、切替後の状態（true=お気に入り）を返す */
export function toggleFavorite(id) {
  const set = readFavorites();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  writeFavorites(set);
  return set.has(id);
}
