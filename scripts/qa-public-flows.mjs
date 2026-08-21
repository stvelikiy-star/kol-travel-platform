import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3100';
const profiles = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }]
];

async function expectText(page, text) {
  await page.getByText(text, { exact: true }).first().waitFor({ timeout: 10000 });
}

async function ensureRussian(page) {
  const ru = page.getByRole('button', { name: 'RU', exact: true }).first();
  if (await ru.count()) {
    await ru.click();
    await page.waitForTimeout(250);
  }
}

async function runClientFirstHomeGuard(page, label) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const body = await page.locator('body').innerText();
  for (const internalRole of ['Собственник', 'Администратор', 'Курьер']) {
    if (body.includes(internalRole)) throw new Error(`${label}: Public home leaks internal role ${internalRole}`);
  }
  await expectText(page, 'Соберите свой Иссык-Куль в одном месте');
  return { passed: true };
}

async function runTeamGatewayFlow(page, label) {
  await page.goto(base + '/team', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await expectText(page, 'Вход для команды KÖL');

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
  await expectText(page, 'Вход собственника');
  if ((await page.locator('input[name="next"]').getAttribute('value')) !== '/owner') {
    throw new Error(`${label}: Owner login lost workspace target`);
  }

  await page.goto(base + '/login?next=/client', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await expectText(page, 'Вход в KÖL');
  if ((await page.locator('input[name="next"]').getAttribute('value')) !== '/client') {
    throw new Error(`${label}: Client login lost workspace target`);
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

async function runCartCheckoutFlow(page, label) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('kol-cart-v1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ensureRussian(page);

  await page.goto(base + '/food/naryn-beshbarmak', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await page.getByLabel('Количество: Бешбармак').fill('2');
  await page.getByRole('button', { name: 'Добавить в корзину', exact: true }).first().click();
  await page.getByRole('status').filter({ hasText: 'Позиция добавлена в корзину.' }).waitFor();

  await page.goto(base + '/cart', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await expectText(page, 'Бешбармак');
  await page.getByText('620 KGS × 2 = 1240 KGS', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Увеличить Бешбармак', exact: true }).click();
  await page.getByText('620 KGS × 3 = 1860 KGS', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Уменьшить Бешбармак', exact: true }).click();
  await page.getByText('620 KGS × 2 = 1240 KGS', { exact: true }).waitFor();

  await Promise.all([
    page.waitForURL(url => url.pathname === '/checkout'),
    page.getByRole('link', { name: 'Перейти к оформлению', exact: true }).click()
  ]);
  await page.getByRole('button', { name: 'Проверить заявку', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Заполните имя и телефон' }).waitFor();
  await page.getByPlaceholder('Ваше имя').fill('Тест KÖL');
  await page.getByPlaceholder('+996').fill('+996700000000');
  await page.locator('select').selectOption('Чолпон-Ата');
  await page.getByPlaceholder('Улица, дом, корпус').fill('Тестовый адрес 1');
  await page.getByRole('button', { name: 'Проверить заявку', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Заявка заполнена и готова к серверной отправке.' }).waitFor();
  const bodyLines = (await page.locator('body').innerText()).split(/\r?\n/).map(line => line.trim());
  if (bodyLines.some(line => /^Заказ создан[!.]?$/i.test(line))) {
    throw new Error(`${label}: Checkout exposes fake order-created success`);
  }

  await page.getByRole('button', { name: 'KG', exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByText('Заказды тариздөө', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'RU', exact: true }).first().click();
  await page.waitForTimeout(250);

  await page.goto(base + '/cart', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  await page.getByRole('button', { name: 'Удалить', exact: true }).first().click();
  await expectText(page, 'Корзина пуста');
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
      cartCheckout: await runCartCheckoutFlow(page, label),
      contacts: await runContactsFlow(page, label)
    };
    if (pageErrors.length) throw new Error(`${label}: page errors: ${pageErrors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
