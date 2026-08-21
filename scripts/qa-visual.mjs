import { chromium } from 'playwright';
import fs from 'node:fs';

const base = 'http://127.0.0.1:3100';
const routes = ['/', '/stays', '/tours', '/food', '/shop', '/owner', '/admin', '/partner', '/courier', '/client', '/presentation', '/booking/checkout'];
const profiles = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }]
];
const knownFallbackSources = [
  'Kyrgyz%20Yurt%2C%20Kyrgyzstan.jpg',
  'Kyrgyzstan%20%286052093045%29.jpg',
  'Felt%20toys%20in%20Kyrgyzstan.jpg'
];
const report = {};
const browser = await chromium.launch({ headless: true });

const isKnownFallback = (url) => knownFallbackSources.some((part) => url.includes(part));

async function ensureRussian(page) {
  const ru = page.getByRole('button', { name: 'RU', exact: true }).first();
  if (await ru.count()) {
    await ru.click();
    await page.waitForTimeout(250);
  }
}

async function runStayBookingFlow(page, label) {
  await page.goto(base + '/stays', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const target = page.locator('a[href="/stays/guest-house-bosteri-ui"]');
  if (!(await target.count())) throw new Error(`${label}: Expected Bosteri stay card link is missing`);
  await target.first().click();
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/stays/guest-house-bosteri-ui')) throw new Error(`${label}: Stay card did not open the expected detail page`);

  await page.getByLabel('Дата заезда').fill('2026-09-10');
  await page.getByLabel('Дата выезда').fill('2026-09-12');
  await page.getByLabel('Количество гостей').fill('3');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/booking/checkout', { timeout: 10000 }),
    page.getByRole('button', { name: 'Продолжить бронирование', exact: true }).click()
  ]);

  const stayUrl = new URL(page.url());
  const expected = {
    bookingType: 'stay',
    stayId: 'stay-guest-bosteri',
    roomId: 'room-001',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    guests: '3'
  };
  for (const [key, value] of Object.entries(expected)) {
    if (stayUrl.searchParams.get(key) !== value) throw new Error(`${label}: Stay checkout lost ${key}`);
  }
  await page.getByText('Гостевой дом Бостери Үй', { exact: true }).first().waitFor();
  await page.getByText('Семейная комната', { exact: true }).first().waitFor();

  await page.getByRole('button', { name: 'Проверить данные', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Заполните имя и телефон' }).waitFor();
  await page.getByPlaceholder('Имя').fill('Тест KÖL');
  await page.getByPlaceholder('Телефон').fill('+996700000000');
  await page.getByRole('button', { name: 'Проверить данные', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Данные заполнены и готовы к серверной проверке.' }).waitFor();
  return { passed: true, checkout: stayUrl.pathname, params: expected };
}

async function runTourBookingFlow(page, label) {
  await page.goto(base + '/tours', { waitUntil: 'domcontentloaded' });
  await ensureRussian(page);
  const target = page.locator('a[href="/tours/boat-trip-cholpon-ata"]');
  if (!(await target.count())) throw new Error(`${label}: Expected boat tour card link is missing`);
  await target.first().click();
  await page.waitForLoadState('domcontentloaded');
  if (!page.url().includes('/tours/boat-trip-cholpon-ata')) throw new Error(`${label}: Tour card did not open the expected detail page`);

  await page.getByLabel('Количество участников').fill('2');
  await Promise.all([
    page.waitForURL(url => url.pathname === '/booking/checkout', { timeout: 10000 }),
    page.getByRole('button', { name: 'Продолжить бронирование', exact: true }).click()
  ]);

  const tourUrl = new URL(page.url());
  const expected = {
    bookingType: 'tour',
    tourId: 'tour-boat-cholpon-ata',
    scheduleId: 'schedule-001',
    guests: '2'
  };
  for (const [key, value] of Object.entries(expected)) {
    if (tourUrl.searchParams.get(key) !== value) throw new Error(`${label}: Tour checkout lost ${key}`);
  }
  await page.getByText('Прогулка на катере по Иссык-Кулю', { exact: true }).first().waitFor();

  await page.getByRole('button', { name: 'Проверить данные', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Заполните имя и телефон' }).waitFor();
  await page.getByPlaceholder('Имя').fill('Тест KÖL');
  await page.getByPlaceholder('Телефон').fill('+996700000000');
  await page.getByRole('button', { name: 'Проверить данные', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Данные заполнены и готовы к серверной проверке.' }).waitFor();
  return { passed: true, checkout: tourUrl.pathname, params: expected };
}

try {
  for (const [label, viewport] of profiles) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    let mediaErrors = [];

    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('response', response => {
      if (response.request().resourceType() === 'image' && response.status() >= 400 && !isKnownFallback(response.url())) {
        mediaErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', request => {
      if (request.resourceType() === 'image' && !isKnownFallback(request.url())) {
        mediaErrors.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? ''}`);
      }
    });

    const routeReport = [];
    for (const route of routes) {
      mediaErrors = [];
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(900);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        brokenImages: Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).map(img => img.src),
        bodyTextLength: document.body.innerText.trim().length
      }));
      routeReport.push({ route, status: response?.status() ?? null, ...metrics, mediaErrors: [...mediaErrors] });
      if (!response || response.status() >= 400) throw new Error(`${label} ${route}: HTTP ${response?.status()}`);
      if (metrics.scrollWidth > metrics.clientWidth + 2) throw new Error(`${label} ${route}: horizontal overflow ${metrics.scrollWidth} > ${metrics.clientWidth}`);
      if (metrics.brokenImages.length) throw new Error(`${label} ${route}: broken images after fallback: ${metrics.brokenImages.join(', ')}`);
      if (mediaErrors.length) throw new Error(`${label} ${route}: rendered media errors: ${mediaErrors.join(' | ')}`);
      if (metrics.bodyTextLength < 20) throw new Error(`${label} ${route}: unexpectedly empty page`);
      if (['/', '/stays', '/owner', '/booking/checkout'].includes(route)) {
        const slug = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
        await page.screenshot({ path: `visual-artifacts/${label}-${slug}.png`, fullPage: true });
      }
    }

    const stayBooking = await runStayBookingFlow(page, label);
    const tourBooking = await runTourBookingFlow(page, label);

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const before = await page.locator('body').innerText();
    await page.getByRole('button', { name: 'KG', exact: true }).first().click();
    await page.waitForTimeout(500);
    const kyrgyz = await page.locator('body').innerText();
    if (kyrgyz === before || !/[үөңҮӨҢ]/.test(kyrgyz)) throw new Error(`${label}: KG translation did not activate`);
    await page.getByRole('button', { name: 'RU', exact: true }).first().click();
    await page.waitForTimeout(500);
    const russian = await page.locator('body').innerText();
    if (!/Главная|Иссык-Куль|KÖL/.test(russian)) throw new Error(`${label}: RU translation did not restore`);

    report[label] = { routes: routeReport, booking: { stay: stayBooking, tour: tourBooking }, consoleErrors, pageErrors, kgChanged: kyrgyz !== before };
    if (pageErrors.length) throw new Error(`${label}: page errors: ${pageErrors.join(' | ')}`);
    const seriousConsole = consoleErrors.filter(text => !/favicon|Failed to load resource.*404/i.test(text));
    if (seriousConsole.length) throw new Error(`${label}: console errors: ${seriousConsole.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync('visual-artifacts', { recursive: true });
fs.writeFileSync('visual-artifacts/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
