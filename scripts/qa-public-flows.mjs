import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3100';
const profiles = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }]
];

async function expectText(page, text) {
  try {
    await page.getByText(text, { exact: true }).first().waitFor({ timeout: 10000 });
  } catch (error) {
    console.error('Expected text missing:', text, 'URL:', page.url(), 'Body:', await page.locator('body').innerText());
    throw error;
  }
}

async function ensureLocale(page, locale) {
  await page.waitForFunction(() => ['ru', 'ky'].includes(document.documentElement.lang), null, { timeout: 10000 });
  if ((await page.locator('html').getAttribute('lang')) === locale) return;

  const explicit = page.locator(`[data-language-option="${locale}"]:visible`).first();
  if (await explicit.count()) {
    await explicit.click();
  } else {
    const mobileToggle = page.locator('[data-language-toggle="mobile"]:visible').first();
    if (!(await mobileToggle.count())) throw new Error(`Locale control missing for ${locale}`);
    await mobileToggle.click();
  }

  await page.waitForFunction(expected => document.documentElement.lang === expected, locale, { timeout: 5000 });
  await page.waitForTimeout(250);
}

async function ensureRussian(page) {
  await ensureLocale(page, 'ru');
}

async function runClientFirstHomeGuard(page, label) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const body = await page.locator('body').innerText();
  for (const internalRole of ['Собственник', 'Администратор', 'Курьер']) {
    if (body.includes(internalRole)) throw new Error(`${label}: Public home leaks internal role ${internalRole}`);
  }
  // Original approved scene (not the temporary simplified React hero).
  // The original WAAPI transition and 3D parallax must remain functional.
  const visualFrame = page.locator('iframe[title="КӨЛ — оригинальные анимированные сцены"]');
  await visualFrame.waitFor({ state: 'visible', timeout: 10000 });
  const stage = page.frameLocator('iframe[title="КӨЛ — оригинальные анимированные сцены"]');
  await stage.locator('#top[data-scene="stay"]').waitFor({ state: 'visible', timeout: 10000 });
  if (await stage.locator('.thumb').count() !== 4) throw new Error(`${label}: original four-scene navigation missing`);
  if (await stage.locator('.art.is-active .art-par').count() !== 1) {
    throw new Error(`${label}: original parallax art layer missing`);
  }
  await stage.locator('#sn-next').click();
  await stage.locator('#top[data-scene="tours"]').waitFor({ timeout: 10000 });
  await stage.locator('.thumb[data-i="2"]').click();
  await stage.locator('#top[data-scene="delivery"]').waitFor({ timeout: 10000 });
  if (await stage.locator('#stage-cta').getAttribute('href') !== '/delivery') {
    throw new Error(`${label}: original delivery scene lost live route`);
  }
  await stage.locator('.thumb[data-i="3"]').click();
  await stage.locator('#top[data-scene="transfer"]').waitFor({ timeout: 10000 });
  if (await stage.locator('#stage-cta').getAttribute('href') !== '/transfer') {
    throw new Error(`${label}: original transfer scene lost live route`);
  }
  await stage.locator('.thumb[data-i="0"]').click();
  await stage.locator('#top[data-scene="stay"]').waitFor({ timeout: 10000 });
  // No global overflow from embedding an original standalone scene.
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) {
    throw new Error(`${label}: restored original scene causes horizontal page overflow`);
  }
  return { passed: true };
}

async function runTeamGatewayFlow(page, label) {
  await page.goto(base + '/team', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const previewMode = process.env.DATA_SOURCE_MODE !== 'supabase';
  await expectText(page, previewMode ? 'Посмотрите KÖL глазами каждой роли' : 'Вход для команды KÖL');
  if (previewMode) await expectText(page, 'Безопасное демо:');

  const expectedLinks = {
    owner: '/login?next=/owner',
    admin: '/login?next=/admin',
    partner: '/login?next=/partner',
    courier: '/login?next=/courier'
  };
  for (const [role, href] of Object.entries(expectedLinks)) {
    if (!(await page.locator(`a[href="${href}"]`).count())) throw new Error(`${label}: Team gateway is missing ${role} login link`);
  }

  await page.goto(base + '/login?next=/owner', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await page.getByText('Вход собственника', { exact: true }).last().waitFor({ timeout: 10000 });
  if ((await page.locator('input[name="next"]').getAttribute('value')) !== '/owner') {
    throw new Error(`${label}: Owner login lost workspace target`);
  }

  // Assert all public-to-workspace entry points preserve the intended, sanitized target.
  // This is a routing smoke test, not a substitute for authenticated role E2E.
  const workspaceEntries = [
    { next: '/admin', title: 'Вход администратора' },
    { next: '/partner', title: 'Вход партнёра' },
    { next: '/courier', title: 'Вход курьера' },
    { next: '/client', title: 'Вход в KÖL' }
  ];
  for (const entry of workspaceEntries) {
    await page.goto(base + '/login?next=' + encodeURIComponent(entry.next), { waitUntil: 'domcontentloaded' });
    await ensureRussian(page);
    await page.getByText(entry.title, { exact: true }).last().waitFor({ timeout: 10000 });
    const actual = await page.locator('input[name="next"]').getAttribute('value');
    if (actual !== entry.next) throw new Error(`${label}: ${entry.next} login lost target: ${actual}`);
    if (!(await page.locator('form input[name="email"]').count()) || !(await page.locator('form input[name="password"]').count())) {
      throw new Error(`${label}: ${entry.next} is missing the real authentication form`);
    }
  }

  return { passed: true };
}

async function runCatalogFlow(page, label) {
  await page.goto(base + '/stays', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await page.locator('input[name="q"]').fill('Бостери');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/stays' && url.searchParams.get('q') === 'Бостери'),
    page.getByRole('button', { name: 'Найти', exact: true }).click()
  ]);
  await expectText(page, 'Гостевой дом Бостери Үй');
  if ((await page.locator('text=Найдено:').first().innerText()).includes('0')) {
    throw new Error(`${label}: Stay filter returned zero results unexpectedly`);
  }
  await Promise.all([
    page.waitForURL(url => url.pathname === '/stays' && !url.search),
    page.getByRole('link', { name: 'Сбросить фильтры', exact: true }).first().click()
  ]);
  return { passed: true };
}

async function runHomeSearchFlow(page, label) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const query = page.getByLabel('Поиск по каталогу');
  const section = page.getByLabel('Раздел каталога');
  if (!(await query.count()) || !(await section.count())) {
    throw new Error(`${label}: Home search is not connected to the real catalog component`);
  }
  await query.fill('Бостери');
  await section.selectOption('stays');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/stays' && url.searchParams.get('q') === 'Бостери'),
    page.getByRole('button', { name: 'Найти', exact: true }).click()
  ]);
  await expectText(page, 'Гостевой дом Бостери Үй');
  return { passed: true };
}

async function runPublicRequestFlow(page, label) {
  await page.goto(base + '/cart', { waitUntil: 'domcontentloaded' });
  await expectText(page, 'Ваша корзина');
  await expectText(page, 'Корзина пока пуста');

  await page.goto(base + '/checkout?kind=food&item=%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA&partner=Naryn&price=620&currency=KGS', { waitUntil: 'domcontentloaded' });
  await expectText(page, 'Заказать еду или товар');
  await page.getByPlaceholder('Ваше имя *').fill('Тест KÖL');
  await page.getByPlaceholder('Телефон *').fill('+996700000000');
  const details = page.getByPlaceholder('Например: 2 порции плова, вода 1.5 л × 2');
  if (!(await details.inputValue()).includes('Бешбармак')) {
    throw new Error(`${label}: Catalog item was not transferred into public request`);
  }
  await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();

  if (process.env.DATA_SOURCE_MODE === 'mock') {
    await page.getByText('Сервис заявок временно недоступен. Попробуйте ещё раз.', { exact: true }).waitFor();
    const body = await page.locator('body').innerText();
    if (body.includes('Заявка принята.')) throw new Error(`${label}: Mock mode exposes fake accepted request`);
  }

  await page.goto(base + '/booking/checkout?type=stay&id=41000000-0000-0000-0000-000000000001&title=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D0%BE%D0%B5%20%D0%B6%D0%B8%D0%BB%D1%8C%D1%91', { waitUntil: 'domcontentloaded' });
  await expectText(page, 'Бронирование тура или жилья');
  if ((await page.getByPlaceholder('Название отеля / жилья *').inputValue()) !== 'Тестовое жильё') {
    throw new Error(`${label}: Stay selection was not transferred into booking request`);
  }
  await page.getByPlaceholder('Ваше имя *').fill('Тест KÖL');
  await page.getByPlaceholder('Телефон *').fill('+996700000000');
  await page.locator('input[type="date"]').first().fill('2026-09-26');
  await page.getByRole('button', { name: 'Отправить заявку на бронирование', exact: true }).click();
  if (process.env.DATA_SOURCE_MODE === 'mock') {
    await page.getByText('Сервис заявок временно недоступен. Попробуйте ещё раз.', { exact: true }).waitFor();
  }
  return { passed: true };
}

async function runContactsFlow(page, label) {
  await page.goto(base + '/contacts', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await page.getByRole('button', { name: 'Проверить обращение', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Заполните имя, телефон и сообщение.' }).waitFor();
  await page.getByPlaceholder('Имя').fill('Тест KÖL');
  await page.getByPlaceholder('Телефон').fill('+996700000000');
  await page.getByPlaceholder('Сообщение').fill('Тестовое обращение');
  await page.getByRole('button', { name: 'Проверить обращение', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Обращение заполнено.' }).waitFor();
  const body = await page.locator('body').innerText();
  if (/сообщение отправлено|обращение отправлено/i.test(body)) throw new Error(`${label}: Contacts exposes fake submitted state`);
  return { passed: true };
}

const report = {};
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport] of profiles) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    report[label] = {
      clientFirstHome: await runClientFirstHomeGuard(page, label),
      teamGateway: await runTeamGatewayFlow(page, label),
      homeSearch: await runHomeSearchFlow(page, label),
      catalog: await runCatalogFlow(page, label),
      publicRequest: await runPublicRequestFlow(page, label),
      contacts: await runContactsFlow(page, label)
    };
    if (pageErrors.length) throw new Error(`${label}: page errors: ${pageErrors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
