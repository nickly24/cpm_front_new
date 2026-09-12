/* Offline scanner regression: no real accounts, external API, database or object storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/nikolajpribys/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const output = process.env.SCANNER_SMOKE_OUTPUT || '/Users/nikolajpribys/Desktop/cpm/outputs/homework-redesign/scanner';
await fs.mkdir(output, { recursive: true });
const origin = 'http://localhost:3010';
const apiOrigin = 'http://127.0.0.1:5099';
const requests = [], unexpected = [], errors = [], screenshots = [], consoleMessages = [], navigations = [];
let uploadedPdf = null, initialization = null, job = null, uploadCount = 0, submits = 0;
const work = { id: 1, state: 'none', has_file: false, has_draft: false, revision_comment: null };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
await context.addInitScript(() => { localStorage.setItem('auth_token', 'offline-scanner-token'); localStorage.setItem('theme', 'light'); });
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(data) });
  if (url.origin === origin && path === '/offline-scanner.pdf') return route.fulfill({ contentType: 'application/pdf', body: uploadedPdf });
  if (url.origin === origin) return route.continue();
  // Fonts receive an empty offline fixture; every other external request is rejected.
  if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (url.origin !== apiOrigin) { unexpected.push(request.url()); return route.abort(); }
  if (request.method() === 'OPTIONS') return reply({});
  requests.push({ path, method: request.method() });
  if (path === '/api/aun') return reply({ status: true, role: 'student', id: 17, entity_id: 17, full_name: 'Мария Соколова', group_id: 2 });
  if (path === '/api/homeworks/student-with-sessions') return reply({ status: true, res: [{ homework_id: 1, homework_name: 'Практика: уравнения', homework_type: 'ОВ', deadline: '2026-09-18', status: 'ДЗ не сделано', result: null, submission_id: 1, submission_state: work.state, has_file: work.has_file, has_draft: work.has_draft }], pagination: { current_page: 1, total_pages: 1, total_items: 1, items_per_page: 100 } });
  if (path === '/api/workspaces/1') {
    const metadata = uploadedPdf ? { id: 1, filename: 'homework-1.pdf', page_count: 1, size_bytes: uploadedPdf.length } : null;
    return reply({ homework: { id: 1, name: 'Практика: уравнения', deadline: '2026-09-18', published: true }, submission: { ...work, draft_file: work.has_draft ? metadata : null, current_file: null }, legacy_result: null, permissions: { upload: true, submit: work.has_draft, remove_draft: work.has_draft }, limits: { max_bytes: 10485760, max_pages: 35, poll_after_seconds: 10 }, active_job: null });
  }
  if (path === '/api/workspaces/1/uploads') {
    initialization = request.postDataJSON();
    job = { id: '22222222-2222-4222-8222-222222222222', homework_id: 1, status: 'uploading', stage: 'uploading', progress: 0 };
    return reply({ job, upload: { method: 'POST', url: apiOrigin + '/offline-scanner-upload', fields: { key: 'offline-scanner' } }, max_bytes: 10485760, poll_after_seconds: 10 }, 201);
  }
  if (path === '/offline-scanner-upload') {
    uploadCount++;
    const body = request.postDataBuffer();
    const start = body.indexOf(Buffer.from('%PDF-'));
    const end = body.lastIndexOf(Buffer.from('%%EOF')) + 5;
    assert.ok(start >= 0 && end > start, 'scanner sends a real PDF in the multipart upload');
    uploadedPdf = body.subarray(start, end);
    return route.fulfill({ status: 204, headers, body: '' });
  }
  if (path.endsWith('/complete')) { work.state = 'draft'; work.has_draft = true; job = { ...job, status: 'ready', stage: 'ready', progress: 100 }; return reply(job, 202); }
  if (path === '/api/jobs/active') return reply({ items: job && job.status !== 'ready' ? [job] : [], polling_required: false, poll_after_seconds: 10 });
  if (path.startsWith('/api/jobs/')) return reply(job || {});
  if (path.endsWith('/file-url')) return reply({ url: origin + '/offline-scanner.pdf', filename: 'homework-1.pdf', expires_in: 300 });
  if (path === '/api/workspaces/1/submit') { submits++; return reply({ state: 'submitted' }); }
  unexpected.push(request.method() + ' ' + path); return reply({ error: 'Unmocked offline request' }, 500);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => consoleMessages.push(message.type() + ': ' + message.text().slice(0, 500)));
page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
page.setDefaultTimeout(20000);
const scanner = () => page.getByRole('dialog', { name: 'Сканер домашней работы', exact: true });
const saveShot = async name => { const path = output + '/' + name + '.png'; await page.screenshot({ path, fullPage: true }); screenshots.push(path); };
const visibleInViewport = async locator => {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'action must be completely in viewport: ' + await locator.textContent());
};
const fit = async () => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'document must fit viewport');
  assert.equal(await scanner().evaluate(element => element.scrollWidth <= element.clientWidth), true, 'scanner must have no horizontal overflow');
};
const storedPage = async () => page.evaluate(async () => {
  const database = await new Promise((resolve, reject) => { const request = indexedDB.open('cpm-homework-scanner', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const record = await new Promise((resolve, reject) => { const request = database.transaction('account-projects').objectStore('account-projects').get(JSON.stringify(['17', 1])); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  database.close();
  if (!record?.pages?.[0]) return null;
  const value = record.pages[0], bitmap = await createImageBitmap(value.image);
  const bytes = new Uint8Array(await value.image.arrayBuffer());
  let hash = 2166136261; for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  const result = { id: value.id, width: bitmap.width, height: bitmap.height, rotation: value.rotation, mode: value.mode, brightness: value.brightness, contrast: value.contrast, bytes: bytes.length, hash };
  bitmap.close(); return result;
});
const waitSaved = () => scanner().getByText('Проект хранится на этом устройстве', { exact: true }).waitFor();
try {
  await page.goto(origin + '/cabinet/student/homework');
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.getByRole('heading', { name: 'Практика: уравнения', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Подготовить работу', exact: true }).click();
  await page.getByRole('heading', { name: 'Добавьте свою работу', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Сканировать', exact: true }).click();
  await scanner().getByRole('heading', { name: 'Соберите работу из фотографий', exact: true }).waitFor();
  await fit(); await visibleInViewport(scanner().getByRole('button', { name: 'Снять страницу', exact: true }));
  await visibleInViewport(scanner().getByRole('button', { name: 'Подготовить PDF', exact: true }));
  await saveShot('mobile-empty');
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1400;
    const c = canvas.getContext('2d'); c.fillStyle = '#8c979f'; c.fillRect(0, 0, 1000, 1400);
    c.fillStyle = '#fffcf5'; c.fillRect(70, 65, 860, 1260); c.fillStyle = '#173044'; c.font = 'bold 48px Arial'; c.fillText('HOMEWORK', 135, 165);
    c.font = '28px Arial'; c.fillText('Practice: equations', 135, 215);
    for (let i = 1; i <= 8; i++) { c.fillStyle = '#dbe1e6'; c.fillRect(130, 290 + i * 105, 745, 2); c.fillStyle = '#253a4a'; c.font = '34px Arial'; c.fillText(i + '.  x + ' + (i * 2) + ' = ' + (i * 5) + '   =>   x = ' + (i * 3), 145, 270 + i * 105); }
    c.font = '24px Arial'; c.fillText('Full page edges must remain visible.', 135, 1260);
    return canvas.toDataURL('image/jpeg', .92).split(',')[1];
  });
  await scanner().locator('input[type=file][multiple]').setInputFiles({ name: 'practice.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await scanner().getByRole('heading', { name: 'Страница 1', exact: true }).waitFor(); await waitSaved();
  const original = await storedPage(); assert.equal(original.width, 1000); assert.equal(original.height, 1400); assert.equal(original.rotation, 0);
  await fit(); await saveShot('mobile-page');
  await scanner().getByRole('button', { name: 'Границы и фильтры', exact: true }).click();
  await scanner().getByRole('heading', { name: 'Выровняйте лист', exact: true }).waitFor();
  await scanner().getByText('Обрезка выключена. Все края снимка сохранятся.', { exact: true }).waitFor();
  await scanner().locator('svg[preserveAspectRatio="none"]').waitFor();
  await fit(); await visibleInViewport(scanner().getByRole('button', { name: 'Сохранить', exact: true }));
  await saveShot('mobile-crop');
  const corner = scanner().locator('svg[preserveAspectRatio="none"] circle').first();
  const cornerBox = await corner.boundingBox();
  await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2); await page.mouse.down(); await page.mouse.move(cornerBox.x + cornerBox.width / 2 + 18, cornerBox.y + cornerBox.height / 2 + 18, { steps: 6 }); await page.mouse.up();
  await scanner().getByText('При сохранении фон за рамкой будет удалён.', { exact: true }).waitFor();
  await scanner().getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.deepEqual(await storedPage(), original, 'cancelled explicit crop must preserve source');
  await scanner().getByRole('button', { name: 'Повернуть', exact: true }).click(); await waitSaved();
  const rotated = await storedPage(); assert.equal(rotated.rotation, 90); assert.equal(rotated.hash, original.hash);
  await scanner().getByRole('button', { name: 'Границы и фильтры', exact: true }).click();
  await scanner().locator('svg[preserveAspectRatio="none"]').waitFor();
  const viewBox = await scanner().locator('svg[preserveAspectRatio="none"]').getAttribute('viewBox'); assert.equal(viewBox, '0 0 1400 1000', 'crop editor must show current rotation');
  await scanner().getByRole('button', { name: 'Фильтры', exact: true }).click();
  await scanner().getByRole('button', { name: 'Серый', exact: true }).click();
  await fit(); await visibleInViewport(scanner().getByRole('button', { name: 'Сохранить', exact: true }));
  await saveShot('mobile-filters');
  await scanner().getByRole('button', { name: 'Сохранить', exact: true }).click(); await waitSaved();
  const filtered = await storedPage(); assert.equal(filtered.mode, 'gray'); assert.equal(filtered.rotation, 90); assert.equal(filtered.hash, original.hash, 'saving filters without crop must preserve source bytes');
  await scanner().getByRole('button', { name: 'К работе', exact: true }).click();
  await page.getByRole('button', { name: 'Сканировать', exact: true }).click(); await scanner().getByRole('heading', { name: 'Страница 1', exact: true }).waitFor(); await waitSaved();
  assert.deepEqual(await storedPage(), filtered, 'close and reopen restore the project including filters and rotation');
  await scanner().getByRole('button', { name: 'Разметка', exact: true }).click();
  await scanner().getByRole('button', { name: 'Текст', exact: true }).waitFor();
  await scanner().getByRole('button', { name: 'Текст', exact: true }).click();
  await page.keyboard.type('Solution checked');
  await fit(); await visibleInViewport(scanner().getByRole('button', { name: 'Сохранить', exact: true }));
  await visibleInViewport(scanner().getByRole('button', { name: 'Вернуться к страницам без изменений', exact: true }));
  await saveShot('mobile-markup');
  await scanner().getByRole('button', { name: 'Отменить', exact: true }).click();
  await scanner().getByRole('button', { name: 'Вернуть', exact: true }).click();
  await scanner().getByRole('button', { name: 'Сохранить', exact: true }).click(); await waitSaved();
  const marked = await storedPage(); assert.equal(marked.rotation, 0); assert.equal(marked.mode, 'auto'); assert.equal(marked.width, 1400); assert.equal(marked.height, 1000);
  await page.setViewportSize({ width: 1440, height: 1000 }); await fit(); await saveShot('desktop-page');
  await scanner().getByRole('button', { name: 'Границы и фильтры', exact: true }).click(); await scanner().locator('svg[preserveAspectRatio="none"]').waitFor(); await fit(); await saveShot('desktop-crop');
  const frame = await scanner().locator('svg[preserveAspectRatio="none"]').boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 1); await page.mouse.down(); await page.mouse.move(frame.x + frame.width / 2, frame.y + 28, { steps: 6 }); await page.mouse.up();
  await scanner().getByText('При сохранении фон за рамкой будет удалён.', { exact: true }).waitFor();
  await scanner().getByRole('button', { name: 'Сохранить', exact: true }).click(); await waitSaved();
  const cropped = await storedPage(); assert.ok(cropped.height < marked.height, 'explicitly moving the top edge crops the image'); assert.equal(cropped.rotation, 0);
  await saveShot('desktop-cropped-page');
  await page.setViewportSize({ width: 390, height: 844 });
  await scanner().getByRole('button', { name: 'Подготовить PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).waitFor();
  assert.equal(uploadCount, 1); assert.equal(submits, 0, 'preparing PDF never submits the homework'); assert.ok(initialization.client_upload_id);
  const result = await PDFDocument.load(uploadedPdf); assert.equal(result.getPageCount(), 1);
  assert.deepEqual(result.getPage(0).getSize(), { width: cropped.width, height: cropped.height }, 'PDF keeps edited orientation without applying it twice');
  await fs.writeFile(output + '/prepared-homework.pdf', uploadedPdf); await saveShot('mobile-prepared-pdf');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []); assert.deepEqual(consoleMessages.filter(message => message.startsWith('error:')), []);
  await Promise.all(['failure.png', 'failure.json'].map(name => fs.rm(output + '/' + name, { force: true })));
  const report = { result: 'PASS', scenarios: ['mobile empty scanner', 'JPEG import', 'explicit crop cancelled', 'rotation in editor', 'filter save preserves source', 'local project restored', 'markup undo and redo', 'desktop scanner', 'explicit crop applied', 'PDF uploaded once', 'prepare does not submit'], requests: requests.length, externalRequests: 0, uploadedPdfBytes: uploadedPdf.length, screenshots };
  await fs.writeFile(output + '/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await saveShot('failure'); await fs.writeFile(output + '/failure.json', JSON.stringify({ message: error.message, errors, unexpected, requests, consoleMessages, navigations }, null, 2)); throw error;
} finally { await browser.close(); }
