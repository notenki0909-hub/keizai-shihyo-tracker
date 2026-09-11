/**
 * 追跡する経済指標の定義（統計ダッシュボードAPI / e-Stat・利用登録不要）
 * https://dashboard.e-stat.go.jp/
 *
 * cycle:  1=月, 2=四半期, 3=年, 4=年度
 * rank:   2=全国（日本）
 * sa:     1=原数値, 2=季節調整値
 *
 * betterWhen: 値が上がると景気にとって望ましい方向（up / down / neutral）
 *             → UI で前月比・前年比の色分けに使う
 *
 * judgment: この数値をどう読むかの解説
 *   - summary : 判断基準の要約
 *   - goodWhen: 「良い」とされる状態の目安
 *   - badWhen : 「注意が必要」とされる状態の目安
 *   - caveat  : 数値を読む上での注意点・落とし穴
 *
 * referenceLines: グラフに重ねる目安ライン（値は points の生の単位と揃える）
 *   - value: ラインの値
 *   - label: ラインの説明
 *   - kind : "target"（目標・分岐となる基準値）/ "neutral"（プラマイの分岐点）/ "context"（水準の目安・絶対的な良否ではない）
 *
 * releaseSchedule: 公表機関・おおよその公表タイミング（年ごとに数日前後することがある目安）
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
      "内閣府が四半期ごとに公表する国内総生産（GDP）の実質値をもとにした、季節調整済み前期比を年率換算した数値。" +
      "個人消費・設備投資・輸出入など、国内で生み出された付加価値の合計が3か月前と比べてどれだけ伸びた（縮んだ）かを示す、" +
      "景気の体温計にあたる最重要指標。速報（QE）の後、1次・2次と改定され、数値が変わることがある。",
    judgment: {
      summary:
        "0%を上回れば拡大、下回れば縮小。ただし1四半期のマイナスだけで『不況』と決めつけず、複数四半期の傾向で見る。",
      goodWhen: "プラス成長が複数四半期続いている状態。年率2%前後まではおおむね健全な拡大とされる。",
      badWhen: "2四半期連続のマイナス成長（景気後退の目安の一つ）。マイナス幅が大きく続くほど深刻。",
      caveat:
        "外需や一時的要因（うるう年、天候、大型連休の並び等）で数値が大きく振れやすい。単月・単四半期でなく数四半期の流れで判断する。",
    },
    referenceLines: [{ value: 0, label: "0%＝拡大・縮小の分岐", kind: "neutral" }],
    releaseSchedule:
      "内閣府が四半期終了の約1.5か月後（2月・5月・8月・11月の中旬ごろ）8:50に速報を公表。1か月後をめどに改定値。",
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
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "生産・雇用・所得など景気に敏感な複数指標を合成し、現在の景気の状況を1つの指数にまとめたもの。内閣府が公表。" +
      "『水準』よりも『方向（上向きか下向きか）』を見る指標で、内閣府はこの推移をもとに景気の『山』『谷』を事後的に認定する。",
    judgment: {
      summary: "絶対水準そのものに良し悪しの基準はなく、前月からの向き（上昇=拡大局面、下降=後退局面）で判断する。",
      goodWhen: "数か月連続で上昇している状態。",
      badWhen: "数か月連続で下降している状態（景気後退局面入りのサイン）。",
      caveat:
        "基準年（2020年）を100とした指数で、水準の大小自体に意味はない。単月の上下ではなく3か月以上のトレンドで見る。",
    },
    referenceLines: [{ value: 100, label: "基準年(2020年)=100", kind: "context" }],
    releaseSchedule: "内閣府が対象月の約5週間後、14:00ごろに速報を公表。翌月に改定値。",
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
      "製造業を中心とした鉱業・工業の生産活動の水準を指数化したもの。経済産業省が公表。" +
      "輸出や在庫の動きと連動しやすく、GDPより早く動く『景気の先行指標』としても使われる。",
    judgment: {
      summary: "前月比・前年比のプラスマイナスで生産活動の拡大・縮小を判断する。",
      goodWhen:
        "前月比プラスが連続している状態。経済産業省自身も生産・出荷・在庫の変化幅から『拡大』『持ち直し』『弱含み』等の基調判断を公表している。",
      badWhen: "前月比マイナスが連続、あるいは在庫指数の増加を伴う生産減（作りすぎて売れていないサイン）。",
      caveat:
        "自動車など特定業種の一時的な生産調整（部品供給問題など）で大きく振れることがある。生産・出荷・在庫をセットで見るとより正確。",
    },
    referenceLines: [{ value: 100, label: "基準年(2020年)=100", kind: "context" }],
    releaseSchedule: "経済産業省が対象月の翌月末ごろ8:30に速報を公表、翌々月中旬に確報。",
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
      "機械メーカーが受注した設備投資向け機械の金額（船舶・電力を除く民需分）。内閣府が公表。" +
      "企業は半年〜1年先を見据えて発注するため、設備投資の動きを半年ほど先取りする代表的な先行指標とされる。",
    judgment: {
      summary: "単月の増減は振れが大きいため、内閣府自身も3か月移動平均や3か月連続の前月比で基調を判断している。",
      goodWhen: "3か月連続で前月比プラス、または3か月移動平均が上向き（設備投資意欲の高まり）。",
      badWhen: "3か月連続で前月比マイナス（内閣府の基調判断で『減少』とされる典型的な目安）。",
      caveat: "月によっては大型受注1件で数十%動くこともあるほど振れ幅が大きい。単月の増減だけで判断しない。",
    },
    referenceLines: [],
    releaseSchedule: "内閣府が対象月の翌々月上旬ごろ8:50に公表。",
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
      "生鮮食品を除く総合指数の前年同月比で、価格変動の大きい生鮮食品の影響を取り除いた『基調的な物価動向』を示す。" +
      "総務省統計局が公表し、日本銀行の金融政策運営における最重要参照指標の一つ。",
    judgment: {
      summary:
        "日本銀行は『物価安定の目標』として2%を掲げている。0%近辺はデフレ懸念、行き過ぎたプラスは生活費圧迫や利上げ観測につながるため、高ければ良い・低ければ良いと単純には言えない。",
      goodWhen: "2%前後で安定的に推移している状態（賃金上昇を伴っていればなお望ましい）。",
      badWhen: "0%以下（デフレ懸念）、または4%を超えるような急激な上昇（家計負担増・実質賃金の下押し）。",
      caveat:
        "エネルギー・食料品価格や政府の物価対策（電気代補助等）で一時的に振れることがある。『生鮮食品及びエネルギーを除く総合』（コアコアCPI）と合わせて見ると基調がより分かりやすい。",
    },
    referenceLines: [
      { value: 2, label: "日銀の物価目標 2%", kind: "target" },
      { value: 0, label: "0%＝デフレとの分岐", kind: "neutral" },
    ],
    releaseSchedule: "総務省統計局が対象月の翌月中旬〜下旬に8:30発表（東京都区部の速報は対象月内に先行公表）。",
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
      "労働力人口（就業者＋完全失業者）のうち、職を探しているが仕事に就けていない人の割合。" +
      "総務省統計局『労働力調査』による、雇用情勢を測る最も基本的な指標。景気の変化から少し遅れて動く『遅行指標』としての性質も持つ。",
    judgment: {
      summary: "低いほど雇用情勢は良好とされるが、下がりすぎると人手不足による人件費上昇・供給制約という副作用も出てくる。",
      goodWhen: "2%台前半〜半ば。日本では2.5%前後が、これ以上は下げにくいとされる『構造的・摩擦的失業率』の目安。",
      badWhen: "3%を超えて上昇傾向にある状態。過去のバブル崩壊後・リーマンショック後には5%台まで悪化した局面もある。",
      caveat:
        "求職をあきらめた人は『非労働力人口』に分類され失業率には表れないため、実態より低く出ることがある。有効求人倍率と合わせて見ると需給がより正確に分かる。",
    },
    referenceLines: [{ value: 2.5, label: "構造的失業率の目安 2.5%", kind: "target" }],
    releaseSchedule: "総務省統計局が対象月の翌月末（月末最終営業日）8:30に公表。有効求人倍率と同日発表。",
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
      "ハローワークに登録された求職者1人あたり何件の求人があるかを示す。厚生労働省『一般職業紹介状況』による。" +
      "完全失業率と対になる雇用の需給指標で、企業の採用意欲を直接反映するため景気にやや先行して動く。",
    judgment: {
      summary: "1.0倍が需要と供給の分岐点。1倍を超えると求人数が求職者数を上回る『売り手市場』、下回ると『買い手市場』。",
      goodWhen: "1倍を上回り、緩やかに上昇している状態（企業の採用意欲が旺盛）。",
      badWhen: "1倍を下回る、または急速に低下している状態（採用意欲の減退＝景気減速のサイン）。",
      caveat: "パートタイムを含む数字であり、正社員に限った倍率（正社員有効求人倍率）はこれより低いのが通例。地域差も大きい。",
    },
    referenceLines: [{ value: 1, label: "1倍＝需給均衡ライン", kind: "target" }],
    releaseSchedule: "厚生労働省が対象月の翌月末ごろ8:30に公表（完全失業率と同日）。",
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
      "名目の現金給与総額（基本給＋残業代＋賞与など）を物価変動で割り引き、購買力ベースでの賃金の伸びを示す前年同月比。" +
      "厚生労働省『毎月勤労統計調査』による、家計の実感に近い『暮らし向き』の指標。",
    judgment: {
      summary:
        "プラスなら物価上昇を上回るペースで賃金が伸びている（実質的な購買力が増加）、マイナスなら物価上昇に賃金が追いついていない状態。",
      goodWhen: "プラス圏で推移し、コアCPIの伸びを上回っている状態。",
      badWhen: "マイナスが継続している状態（名目賃金が増えていても物価上昇に負けている＝実質的な生活水準の低下）。",
      caveat: "ボーナス支給月（6月・12月など）は振れが大きい。基本給の伸び（所定内給与）と合わせて見ると基調が分かりやすい。",
    },
    referenceLines: [{ value: 0, label: "0%＝実質増減の分岐", kind: "neutral" }],
    releaseSchedule: "厚生労働省が対象月の翌々月上旬ごろ8:30に速報を公表。",
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
      "モノの輸出額から輸入額を差し引いた収支。財務省『貿易統計』による。資源価格（原油等）や為替レート、海外景気の影響を強く受ける。",
    judgment: {
      summary:
        "黒字（プラス）か赤字（マイナス）かだけでなく、なぜそうなっているか（輸出が伸びているのか、資源高で輸入が膨らんでいるのか）を合わせて見る必要がある。",
      goodWhen: "輸出の増加を伴う黒字拡大（海外需要の強さを反映）。",
      badWhen: "資源価格高騰や円安による輸入額急増を主因とする赤字拡大（国富の海外流出）。",
      caveat: "円安は輸出企業の円建て収益を押し上げる一方、輸入コストも増やすため、『円安＝黒字化』とは一概に言えない。",
    },
    referenceLines: [{ value: 0, label: "0＝黒字・赤字の分岐", kind: "neutral" }],
    releaseSchedule: "財務省が対象月の翌月20日ごろ8:50に公表。",
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
      "貿易収支にサービス収支・第一次所得収支（海外投資からの利子・配当）・第二次所得収支を加えた、対外的な総合的な稼ぎを示す指標。" +
      "財務省・日本銀行『国際収支統計』による。",
    judgment: {
      summary:
        "日本は近年、貿易収支が赤字でも海外投資からの配当・利子収入（第一次所得収支）が大きく、経常収支全体では黒字を維持しやすい構造になっている。",
      goodWhen: "黒字を維持・拡大している状態（対外的な稼ぐ力が保たれている）。",
      badWhen: "赤字に転落、または黒字幅が急速に縮小している状態。",
      caveat:
        "内訳（貿易収支か所得収支か）を見ないと『稼ぐ力』の実態を誤解しやすい。所得収支頼みの黒字は、輸出競争力の低下を映している可能性もある。",
    },
    referenceLines: [{ value: 0, label: "0＝黒字・赤字の分岐", kind: "neutral" }],
    releaseSchedule: "財務省が対象月の翌々月上旬ごろ8:50に公表。",
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
      "新たに発行された10年満期の国債が市場で取引される利回り（月末終値）。長期金利の代表的な指標で、" +
      "住宅ローン金利や企業の資金調達コストの目安になるほか、日本銀行の金融政策（利上げ・利下げ、YCC等）の効果を映す。",
    judgment: {
      summary:
        "『高い・低い』の良し悪しは景気局面や見る立場によって変わるため一概には言えない。上昇局面か低下局面かという方向と、その背景（景気拡大による上昇か、財政不安による上昇か）を見ることが重要。",
      goodWhen: "景気拡大・緩やかな物価上昇を伴う『良い金利上昇』（預金者・年金運用者にはプラス）。",
      badWhen: "急激な上昇（住宅ローン・企業の借入コスト急増）や、財政不安を反映した上昇。",
      caveat: "借り手（住宅ローン利用者・企業）にとっては低いほど有利、貸し手・年金運用者にとっては高いほど有利と、立場によって『良い』の意味が逆転する。",
    },
    referenceLines: [{ value: 0, label: "0%＝マイナス金利との分岐", kind: "neutral" }],
    releaseSchedule: "日々の市場取引で決まる。特定の公表時刻はなく随時更新され、本ツールは月末値を採用。",
    api: { indicatorCode: "0702020300000010020", cycle: "1", rank: "2", sa: "1", statName: "金融経済統計" },
  },
];

export const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利"];
