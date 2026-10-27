import { setTimeout as delay } from 'node:timers/promises';

const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:3000';
const mailbox = 'http://127.0.0.1:54324';
const email = `kol-auth-${Date.now()}@example.test`;
const name = 'KOL Test Client';
const phone = '+996700000001';

async function getMessage(exclude = new Set()) {
  for (let i = 0; i < 40; i++) {
    const response = await fetch(`${mailbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (!response.ok) throw new Error(`Local Mailpit search returned ${response.status}`);
    const data = await response.json();
    const item = (data.messages || []).find((message) => !exclude.has(message.ID));
    if (item) {
      const detail = await fetch(`${mailbox}/api/v1/message/${encodeURIComponent(item.ID)}`);
      if (!detail.ok) throw new Error(`Local Mailpit message returned ${detail.status}`);
      const message = await detail.json();
      const match = (message.HTML || '').match(/href=["']([^"']+\/auth\/v1\/verify[^"']+)["']/i);
      if (!match) throw new Error('Local authentication email contains no verification link');
      const link = match[1].replaceAll('&amp;', '&');
      const url = new URL(link);
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error('Refusing non-local verification link');
      return { id: item.ID, link };
    }
    await delay(500);
  }
  throw new Error('Local authentication email did not arrive in Mailpit');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
  await page.locator('#register-name').fill(name);
  await page.locator('#register-phone').fill(phone);
  await page.locator('#register-email').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку для входа' }).click();
  await page.getByRole('status').getByText('Ссылка отправлена.').waitFor({ timeout: 15000 });
  const first = await getMessage();
  await page.goto(first.link, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.origin === base && url.pathname === '/client/profile', { timeout: 20000 });
  await page.locator('input[name="fullName"]').waitFor({ timeout: 15000 });
  if (await page.locator('input[name="fullName"]').inputValue() !== name) throw new Error('Registered profile name does not match');
  console.log('Local magic link registration and profile: PASS');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/login' && url.searchParams.get('signedOut') === '1', { timeout: 15000 }),
    page.getByRole('button', { name: 'Выйти', exact: true }).click()
  ]);
  await page.locator('#client-email-link').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку без пароля' }).click();
  const second = await getMessage(new Set([first.id]));
  await page.goto(second.link, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.origin === base && url.pathname.startsWith('/client'), { timeout: 20000 });
  await page.goto(`${base}/client/profile`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="fullName"]').waitFor({ timeout: 15000 });
  if (await page.locator('input[name="fullName"]').inputValue() !== name) throw new Error('Returning client profile not retained');
  console.log('Local magic link repeat sign-in and profile: PASS');
} finally {
  await browser.close();
}
