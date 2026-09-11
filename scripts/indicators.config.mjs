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
 *
 * importance: 重要度（1〜5の★）。株価・日本経済全体への影響力を基準に評価。
 *             → UI で★表示、CATEGORY_GUIDES の「まず見る／次に見る」選定の根拠にもなる
 */
export const INDICATORS = [
  {
    id: "gdp_real_growth",
    importance: 4,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 45 },
    api: { indicatorCode: "0705020501000060000", cycle: "2", rank: "2", sa: "2", statName: "国民経済計算" },
  },
  {
    id: "coincident_ci",
    importance: 2,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 35 },
    api: { indicatorCode: "0706010500000090010", cycle: "1", rank: "2", sa: "1", statName: "景気動向指数" },
  },
  {
    id: "industrial_production",
    importance: 3,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 30 },
    api: { indicatorCode: "0502070301000090010", cycle: "1", rank: "2", sa: "2", statName: "鉱工業生産・出荷・在庫指数" },
  },
  {
    id: "machinery_orders",
    importance: 3,
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
    // 単月の振れが大きい指標のため、詳細グラフに3か月移動平均を重ねて基調を見やすくする
    movingAverage: { window: 3, label: "3か月移動平均" },
    releaseSchedule: "内閣府が対象月の翌々月上旬ごろ8:50に公表。",
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 38 },
    api: { indicatorCode: "0701030000000010010", cycle: "1", rank: "2", sa: "2", statName: "機械受注統計調査" },
  },
  {
    id: "cpi_core_yoy",
    importance: 5,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 20 },
    api: { indicatorCode: "0703010601010030010", cycle: "1", rank: "2", sa: "1", statName: "消費者物価指数" },
  },
  {
    id: "ppi_yoy",
    importance: 3,
    name: "国内企業物価指数（PPI）",
    shortName: "企業物価指数",
    category: "物価",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "企業間で取引される財（原材料・中間財・最終財）の価格変動を示す前年同月比。日本銀行が公表。" +
      "消費者物価指数（CPI）より川上（企業間取引段階）の物価を捉えるため、CPIに数か月先行して動くことが多い『物価の先行指標』。",
    judgment: {
      summary:
        "コアCPIと同様、高すぎても低すぎても望ましくない。PPIがCPIを大きく上回る状態が続くと、企業がコスト上昇を販売価格に転嫁しきれていない可能性を示す。",
      goodWhen: "2%前後で安定し、かつCPIとの乖離が小さい状態（コスト上昇を適切に価格転嫁できている）。",
      badWhen: "PPIがCPIを大きく上回り続ける状態（企業マージン圧迫＝将来の業績下押し要因）。または急激な低下（デフレ圧力の再燃）。",
      caveat: "為替・原油価格など海外要因の影響を強く受けるため、単月の振れだけで国内の実力ベースの物価動向と誤解しないよう注意。コアCPIと並べて見ると転嫁の進み具合が分かる。",
    },
    referenceLines: [
      { value: 2, label: "目安 2%（物価目標と同水準）", kind: "target" },
      { value: 0, label: "0%＝デフレとの分岐", kind: "neutral" },
    ],
    releaseSchedule: "日本銀行が対象月の翌月上旬（8営業日目ごろ）8:50に公表。",
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 12 },
    api: { indicatorCode: "0703040400000030010", cycle: "1", rank: "2", sa: "1", statName: "企業物価指数＜日本銀行＞" },
  },
  {
    id: "unemployment_rate",
    importance: 2,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 30 },
    api: { indicatorCode: "0301010000020020010", cycle: "1", rank: "2", sa: "2", statName: "労働力調査" },
  },
  {
    id: "jobs_to_applicants_ratio",
    importance: 2,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 30 },
    api: { indicatorCode: "0301020001000010010", cycle: "1", rank: "2", sa: "2", statName: "一般職業紹介状況" },
  },
  {
    id: "real_wage_index_yoy",
    importance: 4,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 38 },
    api: { indicatorCode: "0302030201010030010", cycle: "1", rank: "2", sa: "1", statName: "毎月勤労統計調査" },
  },
  {
    id: "trade_balance",
    importance: 3,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 20 },
    api: { indicatorCode: "1601010101000010020", cycle: "1", rank: "2", sa: "2", statName: "国際収支統計" },
  },
  {
    id: "current_account",
    importance: 2,
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
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 38 },
    api: { indicatorCode: "1601010100000010000", cycle: "1", rank: "2", sa: "2", statName: "国際収支統計" },
  },
  {
    id: "call_rate",
    importance: 5,
    name: "無担保コールレート（政策金利）",
    shortName: "政策金利",
    category: "金利",
    unit: "%",
    unitLabel: "％（無担保コール翌日物・年率）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "日本銀行が金融政策の誘導目標として運営する、金融機関同士が担保なしで資金を融通し合う際の翌日物（オーバーナイト）金利。" +
      "実質的な政策金利であり、日銀の利上げ・利下げの結果がそのまま反映される。あらゆる金利・為替・株価の土台となる基準金利。",
    judgment: {
      summary:
        "『高い・低い』自体に良し悪しはなく、変化の方向とその理由（景気拡大に伴う正常化か、景気後退への対応か）が重要。急激な変化は市場に強いショックを与える。",
      goodWhen: "緩やかな利上げ（経済の正常な成長・物価安定を反映）、または景気後退局面での機動的な利下げ。",
      badWhen: "急激な利上げ（借入コスト急増・株式のバリュエーション悪化、特に成長株に逆風）、または後手に回った緩和（デフレ長期化のサイン）。",
      caveat:
        "日銀の金融政策決定会合（年8回）の結果を受けて段階的に変わるため、会合前後で市場の思惑により振れやすい。10年国債利回りと合わせて見ると、短期・長期の金利差（イールドカーブ）から金融環境をより正確に把握できる。",
    },
    referenceLines: [{ value: 0, label: "0%＝マイナス金利との分岐", kind: "neutral" }],
    releaseSchedule: "日本銀行が毎営業日、市場実勢レートを公表。金融政策決定会合（年8回）の翌日に、政策変更があれば大きく変動する。",
    api: { indicatorCode: "0702020300000010010", cycle: "1", rank: "2", sa: "1", statName: "コール市場統計＜日本銀行＞" },
  },
  {
    id: "jgb_10y_yield",
    importance: 5,
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
  {
    id: "monetary_base_yoy",
    importance: 3,
    name: "マネタリーベース",
    shortName: "マネタリーベース",
    category: "金利",
    unit: "%",
    unitLabel: "前年同月比 %",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "日本銀行が供給する資金の総量（日銀当座預金＋銀行券発行高＋貨幣流通高）の前年同月比。日銀の量的緩和（QE）・量的引き締め（QT）の" +
      "規模を直接映す指標で、大規模緩和からの『出口』局面では大きくマイナスに振れる。",
    judgment: {
      summary: "水準そのものより、増加から減少への転換など『方向性の変化』が金融市場にとって重要なシグナルとなる。",
      goodWhen: "市場の予想の範囲内で緩やかに推移している状態（政策の予見可能性が高い）。",
      badWhen: "急激な減少（QTの急加速＝市場から資金が急速に吸収される）や、逆に急激な増加（金融不安への緊急対応のサイン）。",
      caveat:
        "2024年以降、日銀は国債買入れの段階的縮小（QT）を進めており、前年同月比はマイナス圏で推移しやすい局面にある。マイナス自体が『異常事態』を意味するわけではない点に注意。",
    },
    referenceLines: [{ value: 0, label: "0%＝拡大・縮小の分岐", kind: "neutral" }],
    releaseSchedule: "日本銀行が対象月終了後、翌月初旬に公表。",
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 7 },
    api: { indicatorCode: "0702010102000030010", cycle: "1", rank: "2", sa: "1", statName: "マネタリーベース統計＜日本銀行＞" },
  },
  {
    id: "usdjpy",
    importance: 5,
    name: "ドル円レート",
    shortName: "ドル円",
    category: "為替・市場",
    unit: "円",
    unitLabel: "円（対米ドル・17時時点、日次終値）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "neutral",
    description:
      "東京市場で取引される円・ドルの為替レート（17時時点、日次終値）。日本経済にとって最も影響の大きい価格の一つで、" +
      "特に輸出企業の比率が高い日経平均株価とは強い相関を持つ。日本銀行の一次データから日次で直接取得している" +
      "（2016年以降。表示・容量の都合上、それ以前は対象外）。",
    judgment: {
      summary:
        "円安（数値上昇）は輸出企業の円建て収益を押し上げ株価にプラスに働きやすい一方、輸入物価上昇を通じた家計負担増というマイナス面もある。円高はその逆。",
      goodWhen: "（株式市場にとっては）緩やかな円安、または行き過ぎた円高からの是正。ただし家計にとって望ましい水準とは一致しない。",
      badWhen: "急激な変動（数か月で10円以上動くような『無秩序な』円安・円高）。企業の想定為替レートを狂わせ、業績予想の不確実性を高める。",
      caveat:
        "輸出企業には円安が有利、輸入依存企業・家計には円高が有利と、立場によって『良い』の意味が逆転する典型的な指標。日米の金利差（政策金利差）が主な変動要因の一つ。",
    },
    referenceLines: [],
    releaseSchedule: "日本銀行が毎営業日、17時時点の実勢レートを翌営業日にかけて公表・更新。",
    nextReleaseRule: { type: "nextBusinessDay" },
    api: {
      provider: "boj-fx-daily",
      statName: "外国為替相場（東京インターバンク相場）＜日本銀行＞",
      sourceUrl: "https://www.stat-search.boj.or.jp/ssi/mtshtml/fm08_d_1_en.html",
    },
  },
  {
    id: "nikkei225",
    importance: 5,
    name: "日経平均株価",
    shortName: "日経平均",
    category: "為替・市場",
    unit: "円",
    unitLabel: "円（日次終値）",
    frequency: "daily",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "日本経済新聞社が算出する、東証プライム市場上場銘柄のうち代表的な225銘柄の株価平均。日本株式市場全体の動向を示す" +
      "最も知名度の高い指数で、値がさ株（株価の高い銘柄）の影響を受けやすい『価格加重平均』という特徴を持つ。" +
      "日次終値は米セントルイス連邦準備銀行（FRED）がNikkei Inc.の許諾を得て再配布しているデータを利用している" +
      "（2016年以降。表示・容量の都合上、それ以前は対象外）。",
    judgment: {
      summary: "他の指標と異なり、これ自体が市場参加者による経済の先読みの結果。上昇は景気拡大・企業業績改善への期待、下落はその逆を織り込む。",
      goodWhen: "緩やかな右肩上がりのトレンド（企業業績の拡大を伴う持続的な上昇）。",
      badWhen: "急落（数日〜数週間で10%を超えるような下落）や、ファンダメンタルズと乖離した過熱感を伴う急騰の反動。",
      caveat:
        "225銘柄という限られた構成銘柄、かつ値がさ株（値嵩株）の影響を強く受けるため、市場全体の実態を見るには時価総額加重のTOPIXと合わせて見る方がよい。",
    },
    referenceLines: [],
    releaseSchedule: "取引時間中は常時更新。日次終値を翌営業日にかけてFRED経由で取得・反映。",
    nextReleaseRule: { type: "fred" },
    api: {
      provider: "fred-csv",
      seriesId: "NIKKEI225",
      statName: "Nikkei Stock Average, Nikkei 225（原典：日本経済新聞社／配信：FRED）",
      sourceUrl: "https://fred.stlouisfed.org/series/NIKKEI225",
    },
  },
  {
    id: "topix",
    importance: 4,
    name: "TOPIX（東証株価指数）",
    shortName: "TOPIX",
    category: "為替・市場",
    unit: "",
    unitLabel: "指数（1968年1月4日=100）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "東京証券取引所プライム市場に上場する全銘柄を対象とした時価総額加重型の株価指数。1968年1月4日の時価総額を100として算出。" +
      "日経平均より広範な銘柄をカバーし、市場全体の実勢をより正確に反映するとされる。",
    judgment: {
      summary:
        "日経平均と同様、市場参加者による経済・企業業績の先読みを映す。時価総額加重のため、大型株（特に金融・輸出関連の主力株）の動きが指数全体を左右しやすい。",
      goodWhen: "日経平均と歩調を合わせた緩やかな上昇（特定の値がさ株だけでなく、市場全体に資金が向かっている状態）。",
      badWhen: "日経平均だけが上昇しTOPIXが低迷する『物色の偏り』（市場の地合いの弱さを示唆）、または急落局面。",
      caveat: "日経平均との倍率（NT倍率）を見ることで、値がさ株主導の相場か、市場全体に資金が向かう相場かを判断する材料になる。",
    },
    referenceLines: [],
    releaseSchedule: "取引時間中は常時更新。本ツールは月末値を採用。",
    api: { indicatorCode: "0702020590000090010", cycle: "1", rank: "2", sa: "1", statName: "日本取引所グループ統計月報" },
  },
  {
    id: "foreign_investor_flow",
    importance: 5,
    name: "海外投資家 売買動向（東証プライム）",
    shortName: "海外投資家動向",
    category: "為替・市場",
    unit: "億円",
    unitLabel: "億円（月間・買い越し＋／売り越し－）",
    frequency: "monthly",
    seasonalAdjustment: "原数値",
    betterWhen: "up",
    description:
      "東京証券取引所（JPX）が毎月公表する『投資部門別売買状況』のうち、東証プライム市場における" +
      "海外投資家の株式売買代金（買い越し／売り越し）の月間集計。海外投資家は売買代金の6割超を占める" +
      "最大の取引主体で、日本株相場全体の値動きに最も直接的な影響を与える主体とされる。",
    judgment: {
      summary:
        "買い越し（プラス）が続くと株価の下支え・押し上げ要因、売り越し（マイナス）が続くと下押し要因になりやすい。" +
        "海外投資家は市場の『スマートマネー』として注目されることが多い。",
      goodWhen: "複数か月連続の買い越し（海外マネーが日本株に向かっている状態）。",
      badWhen: "複数か月連続の大幅な売り越し、特に急激な売り越し転換（リスクオフのサインとされやすい）。",
      caveat:
        "月次の値は振れが大きく、先物・オプションを通じたヘッジ取引や大口の自社株TOB関連取引などで" +
        "一時的に大きく振れることがある。東証プライム市場（2022年4月発足）のみが対象で、" +
        "それ以前の『市場第一部』時代とは母集団が異なるため連続しない。",
    },
    referenceLines: [{ value: 0, label: "0＝買い越し・売り越しの分岐", kind: "neutral" }],
    releaseSchedule:
      "東京証券取引所（JPX）が翌月初旬（前月最終週の週間発表と同日、毎月第4営業日ごろ）15:30に月間データを公表。" +
      "※JPXは2026年10月8日公表分からファイル形式を変更予定のため、本ツールの取得ロジックは将来的な追随が必要。",
    nextReleaseRule: { type: "periodLag", daysAfterPeriodEnd: 6 },
    api: {
      provider: "jpx-investor-type",
      statName: "投資部門別売買状況＜JPX＞",
      sourceUrl: "https://www.jpx.co.jp/markets/statistics-equities/investor-type/00-01.html",
    },
  },
];

export const CATEGORIES = ["景気", "物価", "雇用・所得", "対外", "金利", "為替・市場"];

/**
 * カテゴリごとの「まず見る指標／次に見る指標（補完）」ガイド。
 * id は INDICATORS の id と対応させる。
 */
export const CATEGORY_GUIDES = {
  景気: {
    first: {
      id: "gdp_real_growth",
      reason:
        "経済活動の合計そのもので、景気の拡大・縮小を最も包括的に示す『結果』の指標。ただし四半期に1度、対象期間終了から約1.5か月後という遅いペースでしか発表されない。",
    },
    second: {
      id: "coincident_ci",
      reason:
        "GDPは速報性に欠けるため、毎月発表される景気動向指数CI一致指数で補う。生産・雇用などの動きを毎月合成した指数で、次のGDP発表までの『空白期間』の景気動向を先取りして確認できる。",
    },
  },
  物価: {
    first: {
      id: "cpi_core_yoy",
      reason: "消費者が実際に直面する物価の動きを示し、日銀の金融政策判断（利上げ・利下げ）の主要な材料になる、最も注目度の高い物価指標。",
    },
    second: {
      id: "ppi_yoy",
      reason:
        "CPIは消費者向け価格の指標で、企業間取引段階のコスト変動（PPI）が転嫁されて反映されるまでに数か月かかる。PPIを合わせて見ることで、これから消費者物価に波及しうる『先行きの価格圧力』を早めに察知できる。",
    },
  },
  "雇用・所得": {
    first: {
      id: "unemployment_rate",
      reason: "雇用情勢を測る最も基本的で認知度の高い指標。ただし景気の変化から少し遅れて動く『遅行指標』でもある。",
    },
    second: {
      id: "real_wage_index_yoy",
      reason:
        "完全失業率や有効求人倍率は『雇用の量』（仕事があるかどうか）を示すが、暮らし向きに直結するのは『所得の質』。実質賃金指数を合わせて見ることで、物価上昇に賃金が追いついているか＝実質的な購買力まで確認できる。",
    },
  },
  対外: {
    first: {
      id: "current_account",
      reason: "貿易・サービス・海外投資からの所得まで含めた、対外的な『稼ぐ力』の総合指標。ニュースでも最初に報じられる包括的な数字。",
    },
    second: {
      id: "trade_balance",
      reason:
        "経常収支は海外投資からの配当・利子（所得収支）に大きく左右され、それだけでは実体経済の『モノを売る力』が見えにくい。貿易収支を合わせて見ることで、稼ぎが輸出競争力によるものか、過去の対外投資の果実によるものかを切り分けられる。",
    },
  },
  金利: {
    first: {
      id: "call_rate",
      reason: "日銀が金融政策の誘導目標として運営する、実質的な政策金利。利上げ・利下げという金融政策そのものの動きを直接示す起点となる金利。",
    },
    second: {
      id: "jgb_10y_yield",
      reason:
        "政策金利は『いま』の短期金利にすぎない。新発10年国債利回り（長期金利）を合わせて見ることで、市場が将来の利上げ・利下げや景気・物価見通しをどう織り込んでいるかという『将来予想』を補完できる。",
    },
  },
  "為替・市場": {
    first: {
      id: "nikkei225",
      reason: "日本株式市場全体の『いま』を示す、最も知名度の高い指数。まずはここで市場の値動きの大きさを把握する。",
    },
    second: {
      id: "foreign_investor_flow",
      reason:
        "日経平均の動き（結果）だけでは『なぜ動いたか』が分からない。売買代金の6割超を占める海外投資家の買い越し・売り越し動向を合わせて見ることで、値動きの背景にある実際の資金フローを確認できる。",
    },
  },
};
