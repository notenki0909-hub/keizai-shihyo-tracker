/**
 * 追跡する経済指標の定義（統計ダッシュボードAPI / e-Stat・利用登録不要）
 * https://dashboard.e-stat.go.jp/
 *
 * cycle:  1=月, 2=四半期, 3=年, 4=年度
 * rank:   2=全国（日本）
 * sa:     1=原数値, 2=季節調整値
 * betterWhen: 値が上がると景気にとって望ましい方向（up / down / neutral）
 *             → UI で前月比の色分けに使う
 */
export const INDICATORS = [
  {
    id: "gdp_real_growth",
    name: "実質GDP成長率",
    shortName: "実質GDP",
    category: "景気",
    unit: "%",
    unitLabel: "前期比年率 %",
    frequency: "quarterly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "国内総生産（支出側・実質）の前期比年率。景気の総合的な拡大・縮小を示す最重要指標。四半期公表。",
    api: { indicatorCode: "0705020501000060000", cycle: "2", rank: "2", sa: "2", statName: "国民経済計算" },
  },
  {
    id: "coincident_ci",
    name: "景気動向指数 CI一致指数",
    shortName: "CI一致指数",
    category: "景気",
    unit: "",
    unitLabel: "指数（2020年=100）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "生産・雇用など複数指標を合成した景気の一致指数。足元の景気の強さを月次で把握できる。2020年基準。",
    api: { indicatorCode: "0706010500000090010", cycle: "1", rank: "2", sa: "1", statName: "景気動向指数" },
  },
  {
    id: "industrial_production",
    name: "鉱工業生産指数",
    shortName: "鉱工業生産",
    category: "景気",
    unit: "",
    unitLabel: "指数（2020年=100）",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "製造業を中心とした国内生産活動の水準。輸出・在庫循環の影響を強く受け、景気の先行きを読む材料になる。2020年基準。",
    api: { indicatorCode: "0502070301000090010", cycle: "1", rank: "2", sa: "2", statName: "鉱工業生産・出荷・在庫指数" },
  },
  {
    id: "machinery_orders",
    name: "機械受注（船舶・電力除く民需）",
    shortName: "機械受注",
    category: "景気",
    unit: "百万円",
    unitLabel: "百万円",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "企業が機械メーカーに発注した設備投資の先行指標。振れは大きいが、6〜9か月先の設備投資動向を映す。",
    api: { indicatorCode: "0701030000000010010", cycle: "1", rank: "2", sa: "2", statName: "機械受注統計調査" },
  },
  {
    id: "cpi_core_yoy",
    name: "コアCPI（生鮮食品除く総合）",
    shortName: "コアCPI",
    category: "物価",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "変動の大きい生鮮食品を除いた消費者物価の前年同月比。日銀の物価目標（2%）の主対象で、金融政策を左右する。2025年基準。",
    api: { indicatorCode: "0703010601010030010", cycle: "1", rank: "2", sa: "1", statName: "消費者物価指数" },
  },
  {
    id: "unemployment_rate",
    name: "完全失業率",
    shortName: "失業率",
    category: "雇用・所得",
    unit: "%",
    unitLabel: "%",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "down",
    description:
      "労働力人口に占める完全失業者の割合。雇用の需給を示す代表指標で、低いほど労働需給は引き締まっている。",
    api: { indicatorCode: "0301010000020020010", cycle: "1", rank: "2", sa: "2", statName: "労働力調査" },
  },
  {
    id: "jobs_to_applicants_ratio",
    name: "有効求人倍率",
    shortName: "有効求人倍率",
    category: "雇用・所得",
    unit: "倍",
    unitLabel: "倍",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "求職者1人あたりの求人数。1倍を超えると人手不足方向。失業率と並ぶ雇用の需給指標で、景気に連動しやすい。",
    api: { indicatorCode: "0301020001000010010", cycle: "1", rank: "2", sa: "2", statName: "一般職業紹介状況" },
  },
  {
    id: "real_wage_index_yoy",
    name: "実質賃金指数（現金給与総額）",
    shortName: "実質賃金",
    category: "雇用・所得",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "名目賃金を物価で割り引いた購買力ベースの賃金の前年同月比。プラスなら家計の実質的な所得が増えていることを示す。",
    api: { indicatorCode: "0302030201010030010", cycle: "1", rank: "2", sa: "1", statName: "毎月勤労統計調査" },
  },
  {
    id: "trade_balance",
    name: "貿易収支",
    shortName: "貿易収支",
    category: "対外",
    unit: "億円",
    unitLabel: "億円",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "輸出額から輸入額を引いた収支。資源価格や為替、海外需要の影響を受け、黒字なら対外的な稼ぎが多いことを示す。国際収支ベース。",
    api: { indicatorCode: "1601010101000010020", cycle: "1", rank: "2", sa: "2", statName: "国際収支統計" },
  },
  {
    id: "current_account",
    name: "経常収支",
    shortName: "経常収支",
    category: "対外",
    unit: "億円",
    unitLabel: "億円",
    frequency: "monthly",
    seasonalAdjustment: "季節調整値",
    betterWhen: "up",
    description:
      "貿易・サービス・第一次所得などを合計した対外収支の総合指標。日本は所得収支の黒字が大きく、恒常的な黒字構造。",
    api: { indicatorCode: "1601010100000010000", cycle: "1", rank: "2", sa: "2", statName: "国際収支統計" },
  },
  {
    id: "jgb_10y_yield",
    name: "新発10年国債利回り",
    shortName: "10年金利",
    category: "金利",
    unit: "%",
    unitLabel: "% （月末終値）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "長期金利の代表値。日銀の金融政策スタンスや将来の景気・物価見通しを織り込んで動く。住宅ローンや企業の調達金利の基準。",
    api: { indicatorCode: "0702020300000010020", cycle: "1", rank: "2", sa: "1", statName: "金融経済統計" },
  },
];

export const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利"];
