/*
 * 未来のクレーム（仮） - 生成の唯一の入口
 *
 * 画面は必ず ClaimYobou.generate(input) だけを呼ぶ。
 * 将来本物のAI APIに差し替えるときは、setProvider() で provider を登録する：
 *
 *   ClaimYobou.setProvider(async function (input) {
 *     const res = await fetch('/api/predict', { method: 'POST', body: JSON.stringify(input) });
 *     const json = await res.json();
 *     return { mode: 'ai', cards: json.cards };   // カードの形は README を参照
 *   });
 */
(function (root) {
  'use strict';

  var NS = (root.ClaimYobou = root.ClaimYobou || {});

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./rules.js');
    require('./samples.js');
  }

  /** デモモード：サンプルと完全一致なら用意済みの出力、それ以外はルールベース */
  function demoProvider(input) {
    var sample = NS.samples.find(input);
    if (sample) {
      return { mode: 'sample', sampleId: sample.id, cards: NS.rules.sortCards(sample.cards) };
    }
    var result = NS.rules.analyze(input);
    return { mode: 'demo', cards: result.cards, meta: result.meta };
  }

  var provider = demoProvider;

  function setProvider(fn) {
    provider = typeof fn === 'function' ? fn : demoProvider;
  }

  function validate(input) {
    var name = String((input && input.name) || '').trim();
    var desc = String((input && input.description) || '').trim();
    if (!name && !desc) {
      var err = new Error('商品名か商品説明文のどちらかを入力してください。');
      err.code = 'EMPTY_INPUT';
      throw err;
    }
  }

  /**
   * @param {{name, description, price, shipping, notes}} input
   * @returns {Promise<{mode: 'sample'|'demo'|'ai', cards: Array, summary: {高:number, 中:number, 低:number}}>}
   */
  function generate(input) {
    return Promise.resolve()
      .then(function () {
        validate(input);
        return provider(input);
      })
      .then(function (result) {
        var cards = (result && result.cards) || [];
        var summary = { '高': 0, '中': 0, '低': 0 };
        cards.forEach(function (card) {
          if (summary[card.likelihood] != null) summary[card.likelihood]++;
        });
        return Object.assign({}, result, { cards: cards, summary: summary });
      });
  }

  NS.generate = generate;
  NS.setProvider = setProvider;
  NS.demoProvider = demoProvider;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generate: generate, setProvider: setProvider, demoProvider: demoProvider };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
