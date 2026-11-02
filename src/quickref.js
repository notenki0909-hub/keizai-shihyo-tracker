/**
 * 早見表。経済状況サマリーの「日本株に影響を与える米国の指標」の上に、折りたたんだ状態で置く。日米共通のファイル。
 *   1. 全体の流れ：経済指標 → 中央銀行 → 金利 → 為替 → 企業業績 → 業界 → 株価
 *   2. 代表的な波及ルート：各指標カードの「波及ルート」を、同じルートの指標ごとにまとめた一覧（データから自動生成）
 *   3. 「金利」「ドル円」「景気」「原材料費」が上がったとき／下がったときに、有利・不利になりやすい業種と、
 *      そのとき同時に動きやすい指標（↑上がる／↓下がる）
 *
 * 方針：AIによる予測・分析ではなく、各指標の詳細画面の「追い風・向かい風になりやすい業種」
 * （scripts/impact-sectors.config.mjs）と同じ、一般に説明される典型的な傾向の整理。
 * 個別企業の業績や株価を示すものではない（投資助言ではない）。業種名は日本株を想定している。
 * 指標名は、そのサイトに存在する指標のときだけクリックで詳細が開く（ids に日米それぞれの id を書く）。
 */

// 再描画（カレンダーの月切り替えなど）しても、開いたままにする
let isOpen = false;

const I = (label, dir, ids = {}, note = "") => ({ label, dir, ids, note });

const THEMES = [
  {
    title: "金利",
    sub: "日本・米国の長期金利、政策金利",
    upLabel: "金利が上がったら",
    downLabel: "金利が下がったら",
    up: {
      tail: [
        ["銀行", "貸出の利ざやが広がる"],
        ["保険", "運用利回りが改善する"],
      ],
      head: [
        ["不動産・REIT", "借入コストが増え、物件の利回りの魅力が下がる"],
        ["住宅・建設", "住宅ローン金利が上がり、需要が減る"],
        ["ハイテク・成長株", "将来利益の評価が下がる"],
        ["借入の多い企業（電力・ガス・運輸など）", "利払いが増える"],
      ],
      ind: [
        I("長期金利（日本10年国債）", "up", { jp: "jgb_10y_yield" }),
        I("長期金利（米10年国債）", "up", { us: "treasury_10y_us" }),
        I("政策金利（FF金利・無担保コールレート）", "up", { us: "fed_funds_rate_us", jp: "call_rate" }),
        I("住宅ローン金利（米30年固定）", "up", { us: "mortgage_rate_us" }),
        I("新設住宅着工（日）・新築住宅販売（米）", "down", { us: "new_home_sales_us", jp: "housing_starts" }),
        I("ドル円", "up", {}, "米国の金利が上がるとき（円安方向）"),
        I("ドル円", "down", {}, "日本の金利が上がるとき（円高方向）"),
      ],
    },
    down: {
      tail: [
        ["不動産・REIT", "借入コストが減り、物件の利回りの魅力が高まる"],
        ["住宅・建設", "ローン負担が減り、需要が増える"],
        ["ハイテク・成長株", "将来利益の評価が上がる"],
        ["借入の多い企業（電力・ガス・運輸など）", "利払いが減る"],
      ],
      head: [
        ["銀行", "貸出の利ざやが縮む"],
        ["保険", "運用利回りが低下する"],
      ],
      ind: [
        I("長期金利（日本10年国債）", "down", { jp: "jgb_10y_yield" }),
        I("長期金利（米10年国債）", "down", { us: "treasury_10y_us" }),
        I("政策金利（FF金利・無担保コールレート）", "down", { us: "fed_funds_rate_us", jp: "call_rate" }),
        I("住宅ローン金利（米30年固定）", "down", { us: "mortgage_rate_us" }),
        I("新設住宅着工（日）・新築住宅販売（米）", "up", { us: "new_home_sales_us", jp: "housing_starts" }),
        I("ドル円", "down", {}, "米国の金利が下がるとき（円高方向）"),
        I("ドル円", "up", {}, "日本の金利が下がるとき（円安方向）"),
      ],
    },
  },
  {
    title: "ドル円",
    sub: "上がる＝円安、下がる＝円高",
    upLabel: "ドル円が上がったら（円安）",
    downLabel: "ドル円が下がったら（円高）",
    up: {
      tail: [
        ["輸出企業（自動車・電機・機械）", "円換算の売上・利益が増える"],
        ["観光・百貨店（インバウンド）", "訪日客の割安感が増え、売上が増える"],
      ],
      head: [
        ["食品・小売", "輸入原材料が高くなり、利益を圧迫する"],
        ["電力・ガス", "燃料の輸入コストが増える"],
        ["航空", "燃料費が増える"],
      ],
      ind: [
        I("日経平均株価", "up", { jp: "nikkei225" }, "輸出株が追い風を受けやすい"),
        I("貿易収支（日）", "down", { jp: "trade_balance" }, "輸入額が増え、赤字方向"),
        I("消費者物価（日）", "up", { jp: "cpi_total_yoy" }, "輸入物価を通じて、時間差で"),
        I("企業物価（日）", "up", { jp: "ppi_yoy" }, "輸入物価が上がる"),
        I("実質賃金（日）", "down", { jp: "real_wage_index_yoy" }, "物価上昇に賃金が追いつかない"),
        I("ドル指数（米）", "up", { us: "dollar_index_us" }, "ドル全体が強い局面"),
      ],
    },
    down: {
      tail: [
        ["食品・小売", "輸入原材料が安くなり、利益が改善する"],
        ["電力・ガス", "燃料の輸入コストが減る"],
        ["航空", "燃料費が減る"],
      ],
      head: [
        ["輸出企業（自動車・電機・機械）", "円換算の売上・利益が目減りする"],
        ["観光・百貨店（インバウンド）", "訪日客の割安感が薄れる"],
      ],
      ind: [
        I("日経平均株価", "down", { jp: "nikkei225" }, "輸出株が逆風を受けやすい"),
        I("貿易収支（日）", "up", { jp: "trade_balance" }, "輸入額が減り、黒字方向"),
        I("消費者物価（日）", "down", { jp: "cpi_total_yoy" }, "輸入物価を通じて、時間差で"),
        I("企業物価（日）", "down", { jp: "ppi_yoy" }, "輸入物価が下がる"),
        I("実質賃金（日）", "up", { jp: "real_wage_index_yoy" }, "物価の上昇が和らぐ"),
        I("ドル指数（米）", "down", { us: "dollar_index_us" }, "ドル全体が弱い局面"),
      ],
    },
  },
  {
    title: "景気",
    sub: "GDP・生産・雇用など景気全体の強さ",
    upLabel: "景気が良くなったら",
    downLabel: "景気が悪くなったら",
    up: {
      tail: [
        ["機械・工作機械・素材", "企業の設備投資が増え、受注が増える"],
        ["小売・外食・観光", "所得が増え、消費が伸びる"],
        ["人材サービス", "求人が増える"],
        ["銀行", "資金需要が増え、貸出が伸びる"],
      ],
      head: [
        ["医薬・食品・電力・ガス（ディフェンシブ）", "景気に左右されにくく、相対的に伸びが小さい"],
        ["不動産・借入の多い企業", "強すぎると利上げ観測で金利が上がり、重荷になる"],
      ],
      ind: [
        I("GDP成長率", "up", { us: "gdp_growth_us", jp: "gdp_real_growth" }),
        I("鉱工業生産", "up", { us: "industrial_production_us", jp: "industrial_production" }),
        I("機械受注（日）", "up", { jp: "machinery_orders" }),
        I("景気ウォッチャー調査（日）", "up", { jp: "economy_watchers" }),
        I("失業率", "down", { us: "unemployment_rate_us", jp: "unemployment_rate" }),
        I("有効求人倍率（日）", "up", { jp: "jobs_to_applicants_ratio" }),
        I("小売売上高（米）", "up", { us: "retail_sales_us" }),
        I("長期金利（日本10年・米10年）", "up", { us: "treasury_10y_us", jp: "jgb_10y_yield" }, "利上げ観測が強まる"),
      ],
    },
    down: {
      tail: [["医薬・食品・電力・ガス（ディフェンシブ）", "景気に左右されにくく、売上が安定する"]],
      head: [
        ["機械・工作機械・素材", "企業の設備投資が減り、受注が減る"],
        ["小売・外食・観光・自動車", "消費が減り、売上が減る"],
        ["人材サービス", "求人が減る"],
        ["銀行", "貸倒れが増えやすい"],
      ],
      ind: [
        I("GDP成長率", "down", { us: "gdp_growth_us", jp: "gdp_real_growth" }),
        I("鉱工業生産", "down", { us: "industrial_production_us", jp: "industrial_production" }),
        I("機械受注（日）", "down", { jp: "machinery_orders" }),
        I("景気ウォッチャー調査（日）", "down", { jp: "economy_watchers" }),
        I("失業率", "up", { us: "unemployment_rate_us", jp: "unemployment_rate" }),
        I("有効求人倍率（日）", "down", { jp: "jobs_to_applicants_ratio" }),
        I("サーム・ルール（米・景気後退シグナル）", "up", { us: "sahm_rule_us" }),
        I("長期金利（日本10年・米10年）", "down", { us: "treasury_10y_us", jp: "jgb_10y_yield" }, "利下げ観測が強まる"),
      ],
    },
  },
  {
    title: "原材料費",
    sub: "原油・資源価格、企業物価（仕入れコスト）",
    upLabel: "原材料費が上がったら",
    downLabel: "原材料費が下がったら",
    up: {
      tail: [
        ["商社・資源・エネルギー（石油・ガス）", "販売価格が上がり、売上・利益が増える"],
        ["価格転嫁できる企業", "値上げで売上高が増える"],
      ],
      head: [
        ["航空・運輸", "燃料費が増え、利益を圧迫する"],
        ["電力・ガス", "燃料の調達コストが増える"],
        ["化学・食品", "原料コストが増える"],
        ["小売・外食", "仕入れが増え、家計の余裕も減る"],
      ],
      ind: [
        I("WTI原油価格（米）", "up", { us: "wti_oil_us" }),
        I("企業物価（国内企業物価・生産者物価）", "up", { us: "ppi_core_yoy_us", jp: "ppi_yoy" }),
        I("消費者物価", "up", { us: "cpi_yoy_us", jp: "cpi_total_yoy" }, "時間差で"),
        I("貿易収支（日）", "down", { jp: "trade_balance" }, "輸入額が増え、赤字方向"),
        I("実質賃金（日）", "down", { jp: "real_wage_index_yoy" }, "物価上昇に賃金が追いつかない"),
      ],
    },
    down: {
      tail: [
        ["航空・運輸", "燃料費が減り、利益が増える"],
        ["電力・ガス", "燃料の調達コストが減る"],
        ["化学・食品", "原料コストが減る"],
        ["小売・外食", "仕入れが減り、家計の余裕も増える"],
      ],
      head: [["商社・資源・エネルギー（石油・ガス）", "販売価格が下がり、売上・利益が減る"]],
      ind: [
        I("WTI原油価格（米）", "down", { us: "wti_oil_us" }),
        I("企業物価（国内企業物価・生産者物価）", "down", { us: "ppi_core_yoy_us", jp: "ppi_yoy" }),
        I("消費者物価", "down", { us: "cpi_yoy_us", jp: "cpi_total_yoy" }, "時間差で"),
        I("貿易収支（日）", "up", { jp: "trade_balance" }, "輸入額が減り、黒字方向"),
        I("実質賃金（日）", "up", { jp: "real_wage_index_yoy" }, "物価の上昇が和らぐ"),
      ],
    },
  },
];

// 全体の流れ（経済指標が動いてから、株価に表れるまでの大きな見取り図）
const FLOW = [
  ["経済指標", "物価・雇用・景気"],
  ["中央銀行", "日銀・FRBの判断"],
  ["金利", "政策金利・長期金利"],
  ["為替", "日米金利差など"],
  ["企業業績", "売上・コスト・利益"],
  ["業界", "業界ごとの明暗"],
  ["株価", "期待と織り込み"],
];

const DIR = { up: ["↑", "上がる"], down: ["↓", "下がる"] };

/** 各指標カードの「波及ルート」を、同じ内容のものごとにまとめた一覧（データから自動生成） */
function routesHtml(indicators) {
  const groups = new Map();
  for (const ind of indicators) {
    if (!ind.ripple) continue;
    const key = JSON.stringify(ind.ripple);
    if (!groups.has(key)) groups.set(key, { ripple: ind.ripple, inds: [] });
    groups.get(key).inds.push(ind);
  }
  if (!groups.size) return "";
  const cards = [...groups.values()]
    .map(({ ripple, inds }) => {
      const names = inds
        .map((i) => `<button type="button" class="quickref__ind-btn" data-id="${i.id}">${i.shortName ?? i.name}</button>`)
        .join("・");
      const steps = ripple.route
        .split("→")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => `<li><span class="quickref__step">${x}</span></li>`)
        .join("");
      return `
        <div class="quickref__route">
          <div class="quickref__route-head"><span>この波及ルートを載せている指標</span>${names}</div>
          <ol class="quickref__steps quickref__steps--route">
            <li><span class="quickref__step quickref__step--trigger"><small>きっかけ</small>${ripple.trigger}</span></li>${steps}
          </ol>
          <p class="quickref__route-sectors"><b>影響を受けやすい業界の例</b>${ripple.sectors}</p>
        </div>`;
    })
    .join("");
  return `
    <section class="quickref__section">
      <h3>代表的な波及ルート<span>各指標カードの「波及ルート」の一覧</span></h3>
      <div class="quickref__routes">${cards}</div>
    </section>`;
}

/** @param {{site: "us"|"jp", has: (id: string) => boolean, indicators: object[]}} ctx */
export function quickRefHtml({ site, has, indicators = [] }) {
  const sectors = (list, kind, label) =>
    list.length
      ? `<div class="quickref__row quickref__row--${kind}"><b>${label}</b><ul>${list
          .map(([name, reason]) => `<li><span class="quickref__name">${name}</span>${reason}</li>`)
          .join("")}</ul></div>`
      : "";

  const indicatorRows = (list) => {
    const chips = list
      .map(({ label, dir, ids, note }) => {
        const id = ids[site];
        const name = id && has(id) ? `<button type="button" class="quickref__ind-btn" data-id="${id}">${label}</button>` : `<span>${label}</span>`;
        const [arrow, word] = DIR[dir];
        return `<li class="quickref__ind"><span class="quickref__ind-name">${name}</span><i class="quickref__arrow quickref__arrow--${dir}">${arrow}${word}</i>${note ? `<small>${note}</small>` : ""}</li>`;
      })
      .join("");
    return `<div class="quickref__row quickref__row--ind"><b>関係する指標（このとき）</b><ul>${chips}</ul></div>`;
  };

  const cell = (data, label, kind) => `
    <div class="quickref__cell quickref__cell--${kind}">
      <h5>${kind === "up" ? "▲" : "▼"} ${label}</h5>
      ${sectors(data.tail, "tail", "↗ 有利になりやすい業種")}
      ${sectors(data.head, "head", "↘ 不利になりやすい業種")}
      ${indicatorRows(data.ind)}
    </div>`;

  const themes = THEMES.map(
    (t) => `
    <section class="quickref__theme">
      <h4>${t.title}<span>${t.sub}</span></h4>
      <div class="quickref__grid">${cell(t.up, t.upLabel, "up")}${cell(t.down, t.downLabel, "down")}</div>
    </section>`
  ).join("");

  const flow = FLOW.map(([title, sub]) => `<li><span class="quickref__step"><b>${title}</b><small>（${sub}）</small></span></li>`).join("");

  return `
    <details class="quickref"${isOpen ? " open" : ""}>
      <summary>📋 早見表：全体の流れ・波及ルート・金利／ドル円／景気／原材料費（有利・不利な業種と、関係する指標）</summary>
      <section class="quickref__section">
        <h3>全体の流れを見る<span>経済指標から株価まで</span></h3>
        <ol class="quickref__steps quickref__steps--flow">${flow}</ol>
        <p class="quickref__flow-note">経済指標が動くと、中央銀行の判断が変わり、金利・為替を通じて企業の業績へ、そして業界ごとの明暗へと広がります。株価は、結果そのものより「期待と、すでに織り込まれた予想とのズレ」で動くことがあります（良い指標でも下がることがあるのはこのためです）。実際は、順番が入れ替わったり同時に起きたりする、大きな見取り図です。</p>
      </section>
      ${routesHtml(indicators)}
      <section class="quickref__section">
        <h3>金利・ドル円・景気・原材料費が動いたら<span>有利・不利になりやすい業種と、関係する指標</span></h3>
        <p class="quickref__lead">4つのテーマが<b>上がったとき／下がったとき</b>に、有利・不利になりやすい業種と、そのとき同時に動きやすい指標（<b>↑上がる／↓下がる</b>）をまとめました。指標名をクリックすると詳細が開きます。</p>
        ${themes}
      </section>
      <p class="quickref__note">※ 一般に説明される典型的な傾向の整理です（AIによる予測・分析ではありません）。同じ業種でも企業によって逆になることがあり、時期や他の要因・時間差でも変わります。個別企業の業績や株価を示すものではなく、投資助言ではありません。業種ごとの理由は、各指標の詳細画面の「追い風／向かい風になりやすい業種」でも確認できます。</p>
    </details>`;
}

/** innerHTML を差し替えたあとに呼ぶ。指標名のクリックで詳細を開き、開閉状態を覚える */
export function bindQuickRef(root, openDetail) {
  const details = root.querySelector(".quickref");
  details?.addEventListener("toggle", () => {
    isOpen = details.open;
  });
  root.querySelectorAll(".quickref__ind-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}
