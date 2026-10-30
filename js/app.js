/* 未来のクレーム（仮） - 画面の処理 */
(function () {
  'use strict';

  var NS = window.ClaimYobou;
  var form = document.getElementById('form');
  var resultsEl = document.getElementById('results');
  var cardsEl = document.getElementById('cards');
  var summaryEl = document.getElementById('summary');
  var errorEl = document.getElementById('error');
  var samplesEl = document.getElementById('samples');

  var LEVEL_CLASS = { '高': 'high', '中': 'mid', '低': 'low' };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readInput() {
    var input = {};
    NS.samples.FIELDS.forEach(function (k) {
      input[k] = form.elements[k].value;
    });
    return input;
  }

  function fillInput(input) {
    NS.samples.FIELDS.forEach(function (k) {
      form.elements[k].value = input[k] || '';
    });
  }

  function copyText(text, button) {
    function done() {
      var old = button.textContent;
      button.textContent = 'コピーしました';
      setTimeout(function () { button.textContent = old; }, 1500);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  function copyButton(text) {
    var b = el('button', 'copy', 'コピー');
    b.type = 'button';
    b.addEventListener('click', function () { copyText(text, b); });
    return b;
  }

  function renderCard(card) {
    var level = LEVEL_CLASS[card.likelihood] || 'mid';
    var article = el('article', 'card card--' + level);

    var head = el('div', 'card__head');
    head.appendChild(el('span', 'card__cat', card.categoryLabel));
    var badge = el('span', 'badge badge--' + level, '言われやすさ：' + card.likelihood);
    head.appendChild(badge);
    article.appendChild(head);

    article.appendChild(el('h3', 'card__title', card.title));
    article.appendChild(el('p', 'card__timing', '🕒 ' + card.timing));
    article.appendChild(el('blockquote', 'card__quote', card.example));
    if (card.reason) article.appendChild(el('p', 'card__reason', '予測の理由：' + card.reason));

    var p = card.prevention || {};
    var prev = el('div', 'prev');
    prev.appendChild(el('h4', 'prev__title', '予防策'));

    var s1 = el('section', 'prev__item');
    var s1h = el('div', 'prev__label');
    s1h.appendChild(el('span', null, '✍️ 説明文に足す一文'));
    s1h.appendChild(copyButton(p.sentence || ''));
    s1.appendChild(s1h);
    s1.appendChild(el('p', 'prev__text', p.sentence || ''));
    prev.appendChild(s1);

    var s2 = el('section', 'prev__item');
    s2.appendChild(el('div', 'prev__label', '📷 追加すべき写真'));
    var ul = el('ul', 'prev__list');
    (p.photos || []).forEach(function (ph) { ul.appendChild(el('li', null, ph)); });
    s2.appendChild(ul);
    prev.appendChild(s2);

    if (p.faq) {
      var s3 = el('section', 'prev__item');
      var s3h = el('div', 'prev__label');
      s3h.appendChild(el('span', null, '💬 FAQ文案'));
      s3h.appendChild(copyButton('Q. ' + p.faq.q + '\nA. ' + p.faq.a));
      s3.appendChild(s3h);
      var faq = el('dl', 'faq');
      faq.appendChild(el('dt', null, 'Q. ' + p.faq.q));
      faq.appendChild(el('dd', null, 'A. ' + p.faq.a));
      s3.appendChild(faq);
      prev.appendChild(s3);
    }

    article.appendChild(prev);
    return article;
  }

  function render(result) {
    cardsEl.innerHTML = '';
    summaryEl.innerHTML = '';

    var modeLabel = result.mode === 'sample' ? 'サンプル出力' : result.mode === 'ai' ? 'AI予測' : 'デモモード（ルールベース）';
    summaryEl.appendChild(el('span', 'mode', modeLabel));
    ['高', '中', '低'].forEach(function (lv) {
      summaryEl.appendChild(el('span', 'count count--' + LEVEL_CLASS[lv], lv + ' ' + result.summary[lv] + '件'));
    });

    result.cards.forEach(function (card) { cardsEl.appendChild(renderCard(card)); });
    resultsEl.hidden = false;
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    NS.generate(readInput())
      .then(render)
      .catch(function (err) {
        errorEl.textContent = err.message || '予測に失敗しました。';
        errorEl.hidden = false;
      })
      .then(function () { btn.disabled = false; });
  });

  NS.samples.list.forEach(function (s) {
    var b = el('button', 'chip', s.emoji + ' ' + s.label);
    b.type = 'button';
    b.dataset.sample = s.id;
    b.addEventListener('click', function () {
      fillInput(s.input);
      errorEl.hidden = true;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    samplesEl.appendChild(b);
  });

  document.getElementById('clear').addEventListener('click', function () {
    form.reset();
    resultsEl.hidden = true;
    errorEl.hidden = true;
  });
})();
