'use strict';
// スマホ幅のブラウザで index.html を開いて基本操作を確認するスモークテスト。
// 実行: npm run test:e2e   （Playwright が必要）
// SCREENSHOT_DIR を指定するとスクリーンショットを保存する。

const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url);
  let passed = 0;
  const ok = (name) => { passed++; console.log('ok -', name); };

  assert.ok(await page.getByText('実際の商品テストではなく、購入者の声の予測です').first().isVisible());
  ok('免責文が表示される');

  const href = await page.locator('footer a').getAttribute('href');
  assert.equal(href, 'https://koki-works.booth.pm/');
  ok('フッターにショップリンクがある');

  const sampleBtns = page.locator('#samples .sample-btn');
  assert.equal(await sampleBtns.count(), 3);
  const labels = (await sampleBtns.allInnerTexts()).map((t) => t.replace(/\s+/g, ''));
  ['ハンドメイドピアス', 'ハンドメイドブレスレット', '中古スニーカー'].forEach((l, i) => assert.ok(labels[i].includes(l), labels[i]));
  assert.equal(await page.locator('#sample-status').isVisible(), false);
  ok('サンプルが個別ボタン3つで表示される');

  // ブレスレット（低2件を含む）で絞り込みを確認
  await sampleBtns.nth(1).click();
  assert.equal(await page.locator('#sample-status').innerText(), '読み込んだサンプル：ハンドメイドブレスレット');
  assert.equal(await sampleBtns.nth(1).getAttribute('aria-pressed'), 'true');
  ok('読み込んだサンプル名が表示される');

  await page.click('button[type=submit]');
  await page.waitForSelector('#results:not([hidden]) .card');
  const filterAll = page.locator('.filter__btn[data-filter=all]');
  const filterHM = page.locator('.filter__btn[data-filter=highmid]');
  assert.equal(await filterHM.getAttribute('aria-pressed'), 'true');
  assert.equal(await filterHM.innerText(), '高・中のみ（4件）');
  assert.equal(await filterAll.innerText(), 'すべて（6件）');
  assert.equal(await page.locator('.card').count(), 4);
  assert.equal(await page.locator('.card--low').count(), 0);
  assert.match(await page.locator('#filter-note').innerText(), /「低」の2件/);
  ok('初期表示は「高・中のみ」で、低は隠れ件数が表示される');

  await filterAll.click();
  assert.equal(await page.locator('.card').count(), 6);
  assert.equal(await page.locator('.card--low').count(), 2);
  assert.equal(await page.locator('#filter-note').isVisible(), false);
  await filterHM.click();
  assert.equal(await page.locator('.card').count(), 4);
  ok('「すべて」で低も表示され、「高・中のみ」に戻せる');

  await page.fill('#form [name=price]', '4800');
  assert.match(await page.locator('#sample-status').innerText(), /編集済み/);
  ok('サンプルを編集すると編集済みと表示される');

  await sampleBtns.nth(0).click();
  assert.match(await page.inputValue('#form [name=name]'), /ピアス/);
  await page.click('button[type=submit]');
  await page.waitForSelector('#results:not([hidden]) .card');
  assert.ok((await page.locator('.card').count()) >= 5);
  assert.match(await page.locator('#summary').innerText(), /サンプル出力/);
  ok('サンプルの予測カードが表示される');

  const first = page.locator('.card').first();
  for (const t of ['言われやすさ', '説明文に足す一文', '追加すべき写真', 'FAQ文案']) {
    assert.match(await first.innerText(), new RegExp(t));
  }
  ok('カードに必須項目がそろっている');

  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'sample.png'), fullPage: true });
  }

  await page.click('#clear');
  assert.equal(await page.locator('#sample-status').isVisible(), false);
  assert.equal(await page.locator('#results').isVisible(), false);
  ok('クリアでサンプル名と結果が消える');

  await page.fill('#form [name=name]', '<img src=x onerror=alert(1)>手編みマフラー');
  await page.fill('#form [name=description]', 'ウールの手編みマフラーです');
  await page.fill('#form [name=price]', '5800');
  await page.fill('#form [name=shipping]', 'ゆうパケット');
  await page.click('button[type=submit]');
  await page.waitForSelector('#results:not([hidden]) .card');
  assert.match(await page.locator('#summary').innerText(), /デモモード/);
  assert.equal(await page.locator('.card img').count(), 0);
  ok('任意入力でルールベースのカードが表示され、HTMLが挿入されない');

  await page.click('#clear');
  await page.click('button[type=submit]');
  assert.ok(await page.locator('#error').isVisible());
  ok('空入力でエラーが表示される');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  ok('横スクロールが発生しない（375px幅）');

  assert.deepEqual(errors, []);
  ok('JavaScriptエラーがない');

  await browser.close();
  console.log(`\n${passed} passed`);
})().catch((e) => {
  console.error('not ok -', e.message);
  process.exit(1);
});
