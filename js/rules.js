/*
 * 未来のクレーム（仮） - ルールベース予測エンジン（デモモード）
 * 外部APIを使わず、入力テキストのキーワードから将来のクレームを推定する。
 * ブラウザでは window.ClaimYobou.rules、Node では module.exports で公開。
 */
(function (root) {
  'use strict';

  var NS = (root.ClaimYobou = root.ClaimYobou || {});

  var LEVELS = ['高', '中', '低'];

  // カテゴリの表示順（同じ言われやすさのときの並び順にも使う）
  var CATEGORIES = [
    { id: 'condition', label: '商品状態' },
    { id: 'size', label: 'サイズ感' },
    { id: 'color', label: '色味の違い' },
    { id: 'shipping', label: '配送遅延' },
    { id: 'packaging', label: '梱包' },
    { id: 'price', label: '価格不満' },
    { id: 'usage', label: '使い方の誤解' },
    { id: 'material', label: '素材・アレルギー' }
  ];

  function labelOf(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i].label;
    }
    return id;
  }

  // 全角数字・記号を半角に寄せて判定しやすくする
  function normalize(str) {
    return String(str == null ? '' : str)
      .replace(/[０-９ａ-ｚＡ-Ｚ]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      })
      .replace(/，/g, ',')
      .replace(/．/g, '.');
  }

  function parsePrice(value) {
    var s = normalize(value).replace(/[,\s円¥￥]/g, '');
    var m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  var RE = {
    accessory: /ピアス|イヤリング|イヤーカフ|ネックレス|ブレスレット|アンクレット|リング|指輪|チャーム|ヘアゴム|ヘアピン|バレッタ|アクセ/,
    shoes: /スニーカー|靴|シューズ|ブーツ|サンダル|パンプス|ローファー/,
    clothes: /服|シャツ|Tシャツ|ワンピース|パンツ|スカート|ニット|パーカー|ジャケット|コート|帽子|バッグ|トート|ポーチ/,
    used: /中古|USED|ユーズド|古着|美品|使用感|使用済|数回使用|数回着用|一度着用/i,
    handmade: /ハンドメイド|手作り|手づくり|手染め|手編み|レジン|天然石|一点物|一点もの|受注生産|オーダー/,
    sizeValue: /\d+(?:\.\d+)?\s*(?:mm|cm|センチ|ミリ|号|インチ|inch)|(?:US|UK|EU)\s*\d|\b(?:XS|S|M|L|XL|XXL|F)\s*サイズ|フリーサイズ/i,
    sizeCompare: /着用|比較|実寸|手首周り|手首まわり|内周|足幅|ワイズ|甲|大きめ|小さめ|普段|ゆったり|ぴったり|対応サイズ|調整/,
    colorNote: /(?:モニター|画面|ディスプレイ|環境|撮影|光).{0,15}(?:色|異な|違)|色味?.{0,10}(?:異な|違|個体差)|色.{0,4}差/,
    noTracking: /定形外|定形郵便|普通郵便|ゆうメール|スマートレター|追跡なし|追跡無し/,
    tracked: /ネコポス|ゆうパケット|クリックポスト|宅急便|ゆうパック|レターパック|らくらくメルカリ|ゆうゆうメルカリ|匿名配送|追跡あり|追跡可/,
    leadTime: /\d+\s*(?:[〜~～\-]\s*\d+\s*)?(?:営業)?日(?:以内|程度|ほど|前後)?.{0,8}(?:発送|お届け|出荷)|発送まで|制作期間|お届けまで/,
    madeToOrder: /受注生産|受注制作|オーダー|予約/,
    fragile: /ガラス|レジン|陶器|天然石|ドライフラワー|キャンドル|割れ|壊れ|ピアス|イヤリング|ネックレス|ビーズ/,
    packNote: /梱包|包装|ラッピング|緩衝材|プチプチ|OPP|ギフトボックス|箱/,
    simplePack: /簡易(?:梱包|包装)/,
    shoeBox: /箱(?:なし|無し|付き|つき|あり|有り)|外箱|元箱/,
    valueReason: /手作業|手作り|ハンドメイド|一点物|一点もの|天然石|本革|制作時間|時間をかけ|丁寧|14kgf|K18|K10|シルバー925|SV925|正規品|限定|定価/i,
    care: /お手入れ|手入れ|保管|使い方|使用方法|取り扱い|取扱い|水濡れ|水に濡|汗|変色|メンテナンス|洗濯|洗え|外して|避けて/,
    allergySafe: /サージカルステンレス|ステンレス|チタン|樹脂|ニッケルフリー|ノンニッケル|シルバー925|SV925|14kgf|K18|K10|プラチナ/i,
    metalAny: /真鍮|メッキ|合金|金具|ゴールドカラー|シルバーカラー|ステンレス|チタン|シルバー925|14kgf/i,
    allergyNote: /アレルギー/,
    materialAny: /素材|材質|革|合皮|綿|コットン|麻|リネン|ポリエステル|ナイロン|ウール|ゴム|キャンバス|樹脂/,
    conditionDetail: /傷|キズ|汚れ|使用感|ソール|すり減|擦れ|スレ|黄ばみ|ダメージ|シミ|毛玉|ほつれ|ヨレ|劣化/,
    smellNote: /におい|匂い|臭い|喫煙|ペット/,
    stretchCord: /ゴム|テグス|オペロン|ストレッチ/
  };

  function makeContext(input) {
    var name = normalize(input.name).trim();
    var description = normalize(input.description);
    var shipping = normalize(input.shipping);
    var notes = normalize(input.notes);
    var all = [name, description, shipping, notes].join('\n');
    var body = [description, notes].join('\n');

    var type = 'general';
    if (RE.accessory.test(all)) type = 'accessory';
    else if (RE.shoes.test(all)) type = 'shoes';
    else if (RE.clothes.test(all)) type = 'clothes';

    return {
      name: name || 'この商品',
      description: description,
      shipping: shipping,
      notes: notes,
      all: all,
      body: body,
      type: type,
      used: RE.used.test(all),
      handmade: RE.handmade.test(all),
      price: parsePrice(input.price)
    };
  }

  function card(id, likelihood, timing, title, example, reason, prevention) {
    return {
      category: id,
      categoryLabel: labelOf(id),
      likelihood: likelihood,
      timing: timing,
      title: title,
      example: example,
      reason: reason,
      prevention: prevention
    };
  }

  // ---- 各カテゴリのルール ------------------------------------------------

  function ruleSize(c) {
    var hasSize = RE.sizeValue.test(c.all);
    var hasCompare = RE.sizeCompare.test(c.body);
    var level = !hasSize ? '高' : !hasCompare ? '中' : '低';
    var reason = !hasSize
      ? '説明文に具体的なサイズ（mm・cm・号など）が見つかりませんでした。'
      : !hasCompare
        ? 'サイズの数値はありますが、着用イメージや比較の情報がありません。'
        : 'サイズと着用イメージの記載があります。念のための予防策です。';

    if (c.type === 'shoes') {
      return card('size', level, '到着直後（試し履き）',
        '表記サイズなのに合わない',
        '「いつもと同じサイズを買ったのに、つま先がきつくて履けませんでした。幅が狭いなら書いておいてほしかったです。」',
        reason, {
          sentence: '実寸：アウトソール全長◯cm・最大幅◯cm。普段◯cmの出品者が履いてちょうど良いサイズ感です（幅はやや細めです）。',
          photos: ['ソールにメジャーを当てた実寸写真', '真上から見た全体写真（幅が分かるもの）', 'サイズ表記タグのアップ'],
          faq: { q: 'サイズ感は普通ですか？', a: '表記どおりですが幅はやや細めです。実寸（全長◯cm・幅◯cm）をお手持ちの靴と比べてご判断ください。' }
        });
    }
    if (c.type === 'accessory') {
      return card('size', level, '到着直後（開封時）',
        '思っていたより小さい・大きい',
        '「写真だともっと大きく見えたのに、実物は小さくて存在感がありませんでした。」',
        reason, {
          sentence: 'サイズ：モチーフ部分 縦◯mm × 横◯mm（金具を含む全長◯mm）。',
          photos: ['定規を添えたサイズ比較写真', '実際に着用した写真（顔まわり・手首など）', '1円玉など身近な物と並べた写真'],
          faq: { q: '実物の大きさはどのくらいですか？', a: 'モチーフは約◯mm（1円玉より少し小さいくらい）です。着用写真もあわせてご確認ください。' }
        });
    }
    if (c.type === 'clothes') {
      return card('size', level, '到着直後（試着）',
        'サイズ感がイメージと違う',
        '「Mサイズと書いてあったのに、着てみたら小さくて肩がきつかったです。」',
        reason, {
          sentence: '実寸（平置き）：着丈◯cm／身幅◯cm／肩幅◯cm／袖丈◯cm。身長◯cmで着用するとややゆったりめです。',
          photos: ['平置きでメジャーを当てた実寸写真', '着用写真（身長も記載）'],
          faq: { q: '普段Mサイズでも着られますか？', a: '実寸（身幅◯cm・着丈◯cm）をお手持ちの服と比べてご判断ください。' }
        });
    }
    return card('size', level, '到着直後（開封時）',
      '思っていたサイズと違う',
      '「' + c.name + '、もっと大きいと思っていました。サイズをちゃんと書いてほしかったです。」',
      reason, {
        sentence: 'サイズ：縦◯cm × 横◯cm × 高さ◯cm（重さ約◯g）です。',
        photos: ['定規・メジャーを添えた写真', '手に持った・置いた状態の写真（大きさが伝わるもの）'],
        faq: { q: '大きさはどのくらいですか？', a: '縦◯cm × 横◯cmです。手に持った写真も掲載していますのでご参考ください。' }
      });
  }

  function ruleColor(c) {
    var hasNote = RE.colorNote.test(c.body);
    var level = hasNote ? '低' : c.handmade || c.type !== 'general' ? '高' : '中';
    var reason = hasNote
      ? '色味の差についての注意書きがあります。念のための予防策です。'
      : c.handmade
        ? 'ハンドメイド・素材感のある商品で、色味の見え方に関する注意書きがありません。'
        : '画面と実物の色の違いについての注意書きがありません。';
    return card('color', level, '到着直後（開封時）',
      '写真と色が違う',
      '「写真ではもっと鮮やかな色だったのに、届いた実物はくすんだ色に見えました。」',
      reason, {
        sentence: 'お使いの画面や撮影時の光の加減により、実物と色味が多少異なって見える場合があります。',
        photos: ['自然光（昼間の窓際）で撮った写真', '室内照明で撮った写真（見え方の違いが分かるもの）', '白い紙の上で撮った色味の分かる写真'],
        faq: { q: '写真と実物の色は同じですか？', a: 'できるだけ実物に近い色で撮影していますが、画面の設定や光の加減で多少異なって見える場合があります。自然光の写真が最も実物に近いです。' }
      });
  }

  function ruleShipping(c) {
    var noTracking = RE.noTracking.test(c.shipping);
    var tracked = RE.tracked.test(c.shipping);
    var hasLead = RE.leadTime.test(c.all);
    var made = RE.madeToOrder.test(c.all);
    var level;
    var reason;
    if (!c.shipping.trim()) {
      level = hasLead ? '中' : '高';
      reason = '発送方法の記載がありません。';
    } else if (noTracking) {
      level = hasLead ? '中' : '高';
      reason = '追跡のない発送方法（' + c.shipping.trim() + '）のため、「届かない」不安が出やすいです。';
    } else if (made && !hasLead) {
      level = '高';
      reason = '受注生産・予約ですが、発送までの日数の記載がありません。';
    } else if (tracked) {
      level = hasLead ? '低' : '中';
      reason = hasLead ? '追跡ありの発送方法で、発送日数の記載もあります。念のための予防策です。' : '追跡ありの発送方法ですが、発送までの日数の記載がありません。';
    } else {
      level = hasLead ? '中' : '高';
      reason = '追跡の有無が分かりにくい発送方法です。';
    }
    return card('shipping', level, '購入直後（発送待ちの間）',
      'なかなか届かない',
      noTracking
        ? '「購入から1週間たってもまだ届きません。追跡もできないので本当に発送されたのか不安です。」'
        : '「購入してから3日たちますが、まだ発送の連絡がありません。いつ届きますか？」',
      reason, {
        sentence: noTracking
          ? 'ご入金確認後◯日以内に発送します。' + (c.shipping.trim() || '普通郵便') + 'は追跡がなく、お届けまで発送から2〜4日ほどかかります（土日祝は配達なし）。'
          : 'ご入金確認後◯日以内に発送します。発送後は追跡番号でお届け状況をご確認いただけます。',
        photos: ['発送方法・お届け日数をまとめた画像（説明の最後に1枚）'],
        faq: { q: 'いつ届きますか？', a: 'ご入金確認後◯日以内に発送し、発送から通常◯日ほどでお届けします。発送時にご連絡します。' }
      });
  }

  function rulePackaging(c) {
    var fragile = RE.fragile.test(c.all);
    var hasNote = RE.packNote.test(c.body);
    var simple = RE.simplePack.test(c.body);

    if (c.type === 'shoes') {
      var hasBox = RE.shoeBox.test(c.body);
      return card('packaging', hasBox ? '低' : '中', '到着直後（開封時）',
        '箱がない・箱が潰れていた',
        '「箱付きだと思っていたのに、袋に入っただけで届きました。プレゼント用だったので困ります。」',
        hasBox ? '箱の有無の記載があります。念のための予防策です。' : '箱の有無・梱包方法の記載がありません。',
        {
          sentence: '外箱はございません。防水のため袋に入れ、型崩れしないよう詰め物をして発送します。',
          photos: ['発送時の梱包イメージ写真', '付属品（箱・替え紐など）の有無が分かる写真'],
          faq: { q: '箱は付いていますか？', a: '箱は付属しません（箱ありの場合は潰れ防止のため◯◯で梱包します）。' }
        });
    }

    var level = fragile && !hasNote ? '高' : fragile && simple ? '中' : !hasNote ? '中' : '低';
    var reason = fragile && !hasNote
      ? '壊れやすい・繊細な商品ですが、梱包方法の記載がありません。'
      : fragile && simple
        ? '繊細な商品を簡易梱包で送る旨の記載があり、破損時のトラブルになりやすいです。'
        : !hasNote
          ? '梱包方法の記載がありません。'
          : '梱包の記載があります。念のための予防策です。';
    return card('packaging', level, '到着直後（開封時）',
      fragile ? '届いたら壊れていた・梱包が雑' : '梱包が簡素すぎる',
      fragile
        ? '「封筒にそのまま入っていて、届いたときにはパーツが外れていました。もう少し丁寧に梱包してほしかったです。」'
        : '「ギフトにするつもりだったのに、ビニール袋だけで届いてがっかりしました。」',
      reason, {
        sentence: '商品はOPP袋に入れ、緩衝材で包んで発送します。ラッピングは簡易包装のみです（ギフト包装をご希望の方はご相談ください）。',
        photos: ['実際の梱包状態の写真（袋・緩衝材・台紙など）', 'ギフト包装の見本写真（対応する場合）'],
        faq: { q: 'プレゼント用に包装してもらえますか？', a: '基本は簡易包装です。ギフト包装は＋◯円で承ります（ご購入前にコメントください）。' }
      });
  }

  function rulePrice(c) {
    var p = c.price;
    var hasReason = RE.valueReason.test(c.all);
    var level;
    var reason;
    if (p == null) {
      level = '中';
      reason = '価格が入力されていないため、一般的な傾向で予測しています。';
    } else if (p >= 5000) {
      level = hasReason ? '中' : '高';
      reason = p.toLocaleString('ja-JP') + '円は比較的高めの価格帯で、' + (hasReason ? '価値の説明はありますが期待値も上がります。' : '価格の理由（素材・手間など）の説明が見当たりません。');
    } else if (p >= 2000) {
      level = hasReason ? '低' : '中';
      reason = hasReason ? '価格に対する価値の説明があります。念のための予防策です。' : '価格の理由（素材・手間など）の説明が見当たりません。';
    } else {
      level = '低';
      reason = '手に取りやすい価格帯のため、価格への不満は出にくいと予測しました。';
    }
    var example = c.used
      ? '「中古なのに新品とあまり変わらない値段で、状態のわりに高かったと思います。」'
      : '「この値段なら、もう少ししっかりした作りだと思っていました。正直ちょっと安っぽく感じます。」';
    return card('price', level, '到着直後（実物を見たとき）',
      '値段に見合わない',
      example, reason, {
        sentence: c.used
          ? '定価◯円・購入時期◯年◯月頃。使用感を考慮した価格設定にしています。'
          : '素材の◯◯から選び、一つずつ手作業で仕上げています（制作時間：約◯時間）。',
        photos: ['素材・パーツのアップ写真（質感が伝わるもの）', '制作途中の写真や作業風景'],
        faq: { q: '値下げはできますか？', a: '素材と制作の手間を考えた価格のため、値下げは控えさせていただいています。ご理解いただけるとうれしいです。' }
      });
  }

  function ruleUsage(c) {
    var hasCare = RE.care.test(c.body);
    var level = hasCare ? '低' : c.type === 'accessory' ? '高' : '中';
    var reason = hasCare
      ? '取り扱いの注意書きがあります。念のための予防策です。'
      : '使い方・お手入れ・保管方法の注意書きがありません。';

    if (c.type === 'accessory') {
      var stretch = RE.stretchCord.test(c.all);
      return card('usage', level, '使用1週間後',
        stretch ? 'すぐに切れた・伸びた' : '変色した・すぐ壊れた',
        stretch
          ? '「毎日つけていたら1週間でゴムが伸びて、昨日ついに切れてしまいました。不良品ではないですか？」'
          : '「お風呂や寝るときもつけっぱなしにしていたら、1週間で金具が黒っぽく変色しました。」',
        reason, {
          sentence: stretch
            ? 'ゴムは消耗品です。着脱の際は強く引っぱらず、手首をすぼめて転がすように通してください。'
            : '入浴・水仕事・就寝時は外してください。汗や水分は変色の原因になるため、使用後は柔らかい布で拭いてから保管してください。',
          photos: ['お手入れ・保管方法をまとめた画像', '付属の保管袋など同梱物の写真'],
          faq: stretch
            ? { q: 'ゴムが切れたら直してもらえますか？', a: 'お届けから◯日以内は無料、それ以降は送料のみでゴム交換を承ります。' }
            : { q: 'つけたままお風呂に入っても大丈夫ですか？', a: '変色の原因になるため、入浴・水仕事の際は外してください。' }
        });
    }
    if (c.type === 'shoes') {
      return card('usage', level, '使用1週間後',
        '雨の日に履いたら傷んだ',
        '「雨の日に履いたらシミになって取れなくなりました。水に弱いなら教えてほしかったです。」',
        reason, {
          sentence: '素材の性質上、水濡れでシミになる場合があります。ご使用前に防水スプレーのご使用をおすすめします。',
          photos: ['素材感が分かるアップ写真', 'お手入れ方法の説明画像'],
          faq: { q: '洗っても大丈夫ですか？', a: '丸洗いは型崩れ・変色の原因になります。汚れは固く絞った布で拭き取ってください。' }
        });
    }
    return card('usage', level, '使用1週間後',
      '思っていた使い方ができない',
      '「洗濯機で洗ったら縮んで形が崩れてしまいました。手洗いのみなら書いておいてください。」',
      reason, {
        sentence: 'お手入れ：手洗いのみ・陰干ししてください。直射日光の当たる場所での保管は色あせの原因になります。',
        photos: ['使用シーンの写真', 'お手入れ方法をまとめた画像'],
        faq: { q: '洗濯機で洗えますか？', a: '型崩れの原因になるため、手洗い・陰干しをおすすめしています。' }
      });
  }

  function ruleMaterial(c) {
    var level;
    var reason;
    if (c.type === 'accessory') {
      var safe = RE.allergySafe.test(c.all);
      var metal = RE.metalAny.test(c.all);
      var note = RE.allergyNote.test(c.all);
      if (!safe && !note) {
        level = '高';
        reason = metal ? '金具の素材がアレルギー対応か分からず、注意書きもありません。' : '肌に触れるアクセサリーですが、金具の素材の記載がありません。';
      } else if (safe && !note) {
        level = '中';
        reason = '金具の素材の記載はありますが、アレルギーについての注意書きがありません。';
      } else {
        level = '低';
        reason = '素材・アレルギーについての記載があります。念のための予防策です。';
      }
      return card('material', level, '着用数時間〜数日後',
        '金属アレルギーで肌が荒れた',
        '「つけて数時間で耳がかゆくなって赤く腫れました。金具の素材を書いておいてほしかったです。」',
        reason, {
          sentence: '金具：◯◯（ニッケルフリー）を使用しています。金属アレルギーの方は樹脂ピアス・チタン金具への変更も承ります（＋◯円）。',
          photos: ['金具部分のアップ写真', '金具の種類（変更オプション）の比較写真'],
          faq: { q: '金属アレルギーでも使えますか？', a: '金具は◯◯を使用しています。すべての方に反応が出ないとは言えないため、ご心配な方は樹脂・チタン金具への変更をおすすめします。' }
        });
    }
    var hasMat = RE.materialAny.test(c.all);
    level = hasMat ? '低' : c.type === 'general' ? '低' : '中';
    reason = hasMat ? '素材の記載があります。念のための予防策です。' : '素材・材質の記載がありません。';
    return card('material', level, '使用数日後',
      '素材がイメージと違う',
      c.type === 'shoes'
        ? '「本革だと思っていたら合皮でした。素材をはっきり書いてほしかったです。」'
        : '「肌に触れる部分がチクチクして、かゆくなりました。素材を確認しておけばよかったです。」',
      reason, {
        sentence: '素材：◯◯（◯%）／◯◯。肌の弱い方は直接触れる部分の素材をご確認ください。',
        photos: ['素材感が分かるアップ写真', '品質表示タグの写真（ある場合）'],
        faq: { q: '素材は何ですか？', a: '◯◯を使用しています。詳しい素材構成は説明文の「素材」欄をご覧ください。' }
      });
  }

  function ruleCondition(c) {
    if (!c.used) return null;
    var detail = RE.conditionDetail.test(c.body);
    var smell = RE.smellNote.test(c.body);
    var level = !detail ? '高' : smell ? '低' : '中';
    var reason = !detail
      ? '中古品ですが、傷・汚れ・使用感の具体的な記載がありません。'
      : !smell
        ? '状態の記載はありますが、においや保管環境についての記載がありません。'
        : '状態とにおいについての記載があります。念のための予防策です。';
    return card('condition', level, '到着直後（開封時）',
      '説明より状態が悪い',
      '「「目立つ傷なし」と書いてあったのに、かかとの内側に擦れがあり、においも気になりました。」',
      reason, {
        sentence: '使用回数：約◯回。目立つ傷はありませんが、◯◯に小さな擦れがあります（写真◯枚目）。喫煙者・ペットのいない環境で保管していました。',
        photos: ['傷・汚れ部分のアップ写真（全箇所）', 'ソール・裏面・内側など見えにくい部分の写真', '全体を明るい場所で撮った写真'],
        faq: { q: '写真以外に傷や汚れはありますか？', a: '確認できた傷・汚れはすべて写真に載せています。中古品のため、細かな使用感はご了承ください。' }
      });
  }

  var RULES = [ruleCondition, ruleSize, ruleColor, ruleShipping, rulePackaging, rulePrice, ruleUsage, ruleMaterial];

  function sortCards(cards) {
    var order = CATEGORIES.map(function (x) { return x.id; });
    return cards.slice().sort(function (a, b) {
      var d = LEVELS.indexOf(a.likelihood) - LEVELS.indexOf(b.likelihood);
      return d !== 0 ? d : order.indexOf(a.category) - order.indexOf(b.category);
    });
  }

  /**
   * 入力から予測カードの配列を作る。
   * @param {{name?:string, description?:string, price?:string|number, shipping?:string, notes?:string}} input
   */
  function analyze(input) {
    var c = makeContext(input || {});
    var cards = [];
    RULES.forEach(function (rule) {
      var result = rule(c);
      if (result) cards.push(result);
    });
    return {
      cards: sortCards(cards),
      meta: { itemType: c.type, isUsed: c.used, isHandmade: c.handmade, price: c.price }
    };
  }

  NS.rules = {
    analyze: analyze,
    sortCards: sortCards,
    parsePrice: parsePrice,
    LEVELS: LEVELS,
    CATEGORIES: CATEGORIES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS.rules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
