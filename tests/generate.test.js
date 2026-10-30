'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generate, setProvider, demoProvider } = require('../js/generate.js');
const rules = require('../js/rules.js');
const samples = require('../js/samples.js');

const LEVELS = ['高', '中', '低'];
const REQUIRED = ['size', 'color', 'shipping', 'packaging', 'price', 'usage', 'material'];

function assertCardShape(card) {
  assert.ok(card.category, 'category');
  assert.ok(card.categoryLabel, 'categoryLabel');
  assert.ok(LEVELS.includes(card.likelihood), `likelihood: ${card.likelihood}`);
  assert.ok(card.timing && card.timing.length > 0, 'timing');
  assert.ok(card.title, 'title');
  assert.ok(card.example && card.example.length > 5, 'example');
  assert.ok(card.prevention, 'prevention');
  assert.ok(card.prevention.sentence, 'prevention.sentence');
  assert.ok(Array.isArray(card.prevention.photos) && card.prevention.photos.length > 0, 'prevention.photos');
  assert.ok(card.prevention.faq && card.prevention.faq.q && card.prevention.faq.a, 'prevention.faq');
}

function byCat(cards, id) {
  return cards.find((c) => c.category === id);
}

test('任意入力ではルールベースで7カテゴリすべてを返す', async () => {
  const r = await generate({ name: '木製コースター', description: 'ナチュラルな木のコースターです。', price: '1200', shipping: 'ゆうパケット', notes: '' });
  assert.equal(r.mode, 'demo');
  const cats = r.cards.map((c) => c.category);
  for (const id of REQUIRED) assert.ok(cats.includes(id), `missing ${id}`);
  r.cards.forEach(assertCardShape);
});

test('結果は 高 → 中 → 低 の順に並び、summary の件数が一致する', async () => {
  const r = await generate({ name: 'ピアス', description: 'かわいいピアス', price: '6000', shipping: '定形外郵便' });
  const idx = r.cards.map((c) => LEVELS.indexOf(c.likelihood));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  const total = r.summary['高'] + r.summary['中'] + r.summary['低'];
  assert.equal(total, r.cards.length);
});

test('サイズ記載がないと「サイズ感」は高、実寸と着用イメージがあれば低', () => {
  const none = rules.analyze({ name: 'ネックレス', description: '華奢なネックレスです' });
  assert.equal(byCat(none.cards, 'size').likelihood, '高');
  const full = rules.analyze({ name: 'ネックレス', description: 'チェーン長さ40cm。鎖骨あたりにくる長さで、着用写真もあります' });
  assert.equal(byCat(full.cards, 'size').likelihood, '低');
});

test('追跡なしの発送方法は「配送遅延」が高、追跡あり＋発送日数ありは低', () => {
  const noTrack = rules.analyze({ name: 'しおり', description: '押し花のしおり', shipping: '定形外郵便' });
  assert.equal(byCat(noTrack.cards, 'shipping').likelihood, '高');
  const tracked = rules.analyze({ name: 'しおり', description: '押し花のしおり。ご入金後3日以内に発送します', shipping: 'クリックポスト' });
  assert.equal(byCat(tracked.cards, 'shipping').likelihood, '低');
});

test('アクセサリーで金具素材の記載がないと「素材・アレルギー」が高、記載と注意書きがあれば低', () => {
  const none = rules.analyze({ name: 'パールピアス', description: '上品なパールピアスです' });
  assert.equal(byCat(none.cards, 'material').likelihood, '高');
  const ok = rules.analyze({ name: 'パールピアス', description: '金具はサージカルステンレスです。金属アレルギーの方にも比較的安心です' });
  assert.equal(byCat(ok.cards, 'material').likelihood, '低');
});

test('色味の注意書きがあれば「色味の違い」は低', () => {
  const r = rules.analyze({ name: '手染めハンカチ', description: '手染めのハンカチ', notes: 'お使いのモニターにより実物と色味が異なる場合があります' });
  assert.equal(byCat(r.cards, 'color').likelihood, '低');
});

test('高価格で価値の説明がないと「価格不満」が高', () => {
  const r = rules.analyze({ name: 'トートバッグ', description: 'シンプルなトートです', price: '¥8,000' });
  assert.equal(byCat(r.cards, 'price').likelihood, '高');
});

test('全角数字や円記号つきの価格も解釈できる', () => {
  assert.equal(rules.parsePrice('３，５００円'), 3500);
  assert.equal(rules.parsePrice('¥12,800'), 12800);
  assert.equal(rules.parsePrice(''), null);
});

test('中古品には「商品状態」カードが追加される', () => {
  const used = rules.analyze({ name: '中古 ブーツ', description: '数回着用しました' });
  assert.ok(byCat(used.cards, 'condition'));
  assert.equal(byCat(used.cards, 'condition').likelihood, '高');
  const fresh = rules.analyze({ name: '新品 ブーツ', description: '未使用です' });
  assert.equal(byCat(fresh.cards, 'condition'), undefined);
});

test('組み込みサンプル3件は用意済みの出力を返し、必須項目がそろっている', async () => {
  assert.equal(samples.list.length, 3);
  for (const s of samples.list) {
    const r = await generate({ ...s.input });
    assert.equal(r.mode, 'sample', s.id);
    assert.equal(r.sampleId, s.id);
    assert.ok(r.cards.length >= 5, `${s.id} cards`);
    r.cards.forEach(assertCardShape);
  }
});

test('サンプル3件で必須7カテゴリがすべて網羅されている', () => {
  const cats = new Set(samples.list.flatMap((s) => s.cards.map((c) => c.category)));
  for (const id of REQUIRED) assert.ok(cats.has(id), `missing ${id}`);
});

test('サンプルを1文字でも編集するとルールベースに切り替わる', async () => {
  const s = samples.list[0];
  const r = await generate({ ...s.input, price: '3000' });
  assert.equal(r.mode, 'demo');
});

test('商品名と説明文が両方空ならエラー', async () => {
  await assert.rejects(generate({ name: '  ', description: '' }), { code: 'EMPTY_INPUT' });
});

test('setProvider で生成処理を差し替えられ、元に戻せる', async () => {
  const fake = {
    category: 'size', categoryLabel: 'サイズ感', likelihood: '中', timing: '到着直後', title: 't', example: '「テストです」',
    prevention: { sentence: 's', photos: ['p'], faq: { q: 'q', a: 'a' } }
  };
  setProvider(async (input) => ({ mode: 'ai', cards: [{ ...fake, title: input.name }] }));
  try {
    const r = await generate({ name: 'AI商品' });
    assert.equal(r.mode, 'ai');
    assert.equal(r.cards[0].title, 'AI商品');
    assert.equal(r.summary['中'], 1);
  } finally {
    setProvider(null);
  }
  const back = await generate({ name: 'AI商品' });
  assert.equal(back.mode, 'demo');
  assert.equal(typeof demoProvider, 'function');
});
