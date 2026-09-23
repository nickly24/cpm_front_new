/* Synthetic, local-only UI regression. Start Next on localhost:3007 with BOTH
 * NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_HOMEWORK_SERVICE_URL=http://127.0.0.1:5099.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/exam-training-ui-smoke.mjs
 * No real API server or account is used; every API response is intercepted below.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.SMOKE_OUTPUT || '/tmp/cpm-exam-training-ui';
fs.mkdirSync(output, { recursive: true });
const origin = 'http://localhost:3007', api = 'http://127.0.0.1:5099';
const bank = Array.from({ length: 13 }, (_, index) => ({ card_ref: `exam:7:${index + 1}`, question_id: index + 1,
  question: `Вопрос ${index + 1}: назовите основные этапы исследования`,
  answer: '1. Наблюдение\n2. Формулировка гипотезы\n\n3. Проверка результата; выводы / обсуждение',
  content_fingerprint: `version-${index + 1}`, part_id: index < 11 ? 1 : 2, part_code: index < 11 ? 'A' : 'B' }));
const progress = new Map([[bank[0].card_ref, bank[0].content_fingerprint], [bank[1].card_ref, 'old-version']]);
const settings = new Map();
let user = { role: 'admin', id: 1, full_name: 'Тестовый администратор' }, enabled = false, version = 1, failure = null;
const exam = () => ({ id: 7, examType: 'classic', directionId: 1, directionName: 'Математика', legacyName: null,
  startAt: '2026-10-01T09:00:00Z', endAt: '2026-10-01T15:00:00Z', date: null, readiness: 'incomplete', version, trainingEnabled: enabled });
const stats = (cards) => ({ total: cards.length, learned: cards.filter(c => c.status === 'learned').length,
  answer_changed: cards.filter(c => c.status === 'answer_changed').length, unlearned: cards.filter(c => c.status === 'unlearned').length,
  progress_percent: cards.length ? Math.round(cards.filter(c => c.status === 'learned').length * 100 / cards.length) : 0 });
const projected = (preview = false) => bank.map(card => ({ ...card, status: preview || !progress.has(card.card_ref) ? 'unlearned' : progress.get(card.card_ref) === card.content_fingerprint ? 'learned' : 'answer_changed' }));
const batches = (cards, size) => Array.from({ length: Math.ceil(cards.length / size) }, (_, index) => {
  const chunk = cards.slice(index * size, (index + 1) * size);
  return { index, from: index * size + 1, to: index * size + chunk.length, size: chunk.length, stats: stats(chunk) };
});
const selected = (cards, mode) => cards.filter(card => mode === 'all' || (mode === 'learned' ? card.status === 'learned' : mode === 'stale' ? card.status === 'answer_changed' : card.status !== 'learned'));
const defaults = () => ({ batch_size: 10, last_batch_index: 0, study_mode: 'unlearned', last_part_id: null });
const study = (ref = '7', preview = false) => {
  const all = projected(preview), partId = Number(ref.split(':')[1]) || null;
  const cards = partId ? all.filter(card => card.part_id === partId) : all;
  const config = preview ? defaults() : settings.get(ref) || defaults();
  const parts = [1, 2, 3].map((id) => { const counts = stats(all.filter(card => card.part_id === id)); return { kind: 'exam', refId: `7:${id}`, name: `Часть ${String.fromCharCode(64 + id)}`, part_id: id, part_code: String.fromCharCode(64 + id), stats: counts, total_cards: counts.total, learned_cards: counts.learned, answer_changed_cards: counts.answer_changed, progress_percent: counts.progress_percent }; });
  return { success: true, student_id: preview ? 0 : 42, section_kind: 'exam', section_ref_id: ref, section_name: partId ? `Часть ${String.fromCharCode(64 + partId)}` : 'Математика · Экзамен №7',
    exam: exam(), part_id: partId, parts, cards, stats: stats(cards), settings: config, batches: batches(cards, config.batch_size) };
};
const node = () => { const counts = stats(projected()); return { kind: 'exam', refId: '7', name: 'Математика · Экзамен №7', exam_id: 7, parts_count: 3, start_at: exam().startAt, end_at: exam().endAt,
  stats: counts, total_cards: counts.total, learned_cards: counts.learned, answer_changed_cards: counts.answer_changed, progress_percent: counts.progress_percent }; };
const pageData = (items) => ({ items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1, hasNext: false, hasPrev: false } });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
const requests = [], unexpected = [], errors = [];
await context.addInitScript(() => { localStorage.setItem('auth_token', 'synthetic-local-token'); localStorage.setItem('flash_onboarding_seen', 'true'); });
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url()), p = decodeURIComponent(url.pathname), m = req.method();
  if (url.origin === origin) return route.continue();
  if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (url.origin !== api) { unexpected.push(req.url()); return route.abort(); }
  const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(body) });
  const data = (value) => reply({ success: true, data: value });
  requests.push({ p, m, body: req.postData() });
  if (p === '/api/aun') return reply({ status: true, ...user, entity_id: user.id });
  if (p === '/api/jobs/active') return reply({ items: [], polling_required: false, poll_after_seconds: 10 });
  if (p === '/directions') return reply([{ id: 1, name: 'Математика' }]);
  if (p === '/api/exams/capabilities') return data({ apiVersion: 'v2', canManageOutside: true, canCreateClassic: true, canConductClassic: true, canReadStudentResults: true, canReadAdminExams: true });
  if (p === '/api/exams/7/overview') return data({ exam: exam(), classic: { partsCount: 3, questionsCount: bank.length, assignmentsCount: 0, resultsCount: 0, commissionsCount: 0, attempts: { pending: 0, inProgress: 0, completed: 0 } } });
  if (p === '/api/exams/7/classic/parts') return data(pageData([1, 2, 3].map(id => ({ id, code: String.fromCharCode(64 + id), questionWeight: 1, questionCount: 1, bankSize: bank.filter(card => card.part_id === id).length, version: 1 }))));
  if (p === '/api/exams/7/classic/questions') return data(pageData(bank.map(card => ({ id: card.question_id, partId: card.part_id, partCode: card.part_code, questionText: card.question, answerText: card.answer, version: 1 }))));
  if (p === '/api/exams/7/training/preview') return data(study('7', true));
  if (p === '/api/exams/7/training') {
    if (m === 'PATCH') { const body = req.postDataJSON(); assert.equal(body.expectedVersion, version); enabled = body.enabled; version += 1; }
    return data({ exam: exam(), parts_count: 3, cards_count: bank.length });
  }
  if (p === '/get-training-tree/42') return reply({ success: true, student_id: 42, directions: enabled ? [{ id: 1, name: 'Математика', sections: [node()] }] : [] });
  if (p === '/training-sections/42/1') return reply({ success: true, student_id: 42, direction_id: 1, direction_name: 'Математика', sections: enabled ? [node()] : [], pagination: { page: 1, limit: 6, total: enabled ? 1 : 0, pages: 1, has_next: false, has_prev: false } });
  if (p.startsWith('/section-study/42/exam/')) return enabled ? reply(study(p.split('/').at(-1))) : reply({ success: false, error: 'training_disabled' }, 403);
  if (p.startsWith('/section-batch/42/exam/')) {
    if (!enabled) return reply({ success: false, error: 'training_disabled' }, 403);
    const args = p.split('/'), scope = study(args.at(-2)), index = Number(args.at(-1)), batch = scope.batches[index];
    const cards = selected(scope.cards.slice(batch.from - 1, batch.to), url.searchParams.get('study_mode') || scope.settings.study_mode);
    return reply({ success: true, batch, cards, count: cards.length, batch_index: index, study_mode: url.searchParams.get('study_mode') });
  }
  if (p.startsWith('/section-study-settings/42/exam/')) {
    if (!enabled) return reply({ success: false, error: 'training_disabled' }, 403);
    const ref = p.split('/').at(-1), body = req.postDataJSON(); settings.set(ref, body);
    if (ref !== '7') settings.set('7', { ...(settings.get('7') || defaults()), last_part_id: Number(ref.split(':')[1]) });
    return reply({ success: true, settings: body });
  }
  if (p === '/mark-card-learned') {
    if (!enabled) return reply({ success: false, error: 'training_disabled' }, 403);
    const body = req.postDataJSON(), card = bank.find(item => item.card_ref === body.card_ref);
    if (failure === 'network') { failure = null; return reply({ error: 'synthetic_failure' }, 503); }
    if (failure === 'stale') { failure = null; card.question = 'Обновлённый вопрос после изменения банка'; card.content_fingerprint += '-updated'; return reply({ success: false, error: 'content_changed', details: { card: projected().find(item => item.card_ref === card.card_ref) } }, 409); }
    assert.equal(body.content_fingerprint, card.content_fingerprint); progress.set(body.card_ref, body.content_fingerprint);
    return reply({ success: true, card_ref: body.card_ref, status: 'learned' }, 201);
  }
  if (p.startsWith('/mark-card-learned/42/')) { progress.delete(p.slice('/mark-card-learned/42/'.length)); return reply({ success: true }); }
  unexpected.push(`${m} ${p}`); return reply({ error: 'Unmocked request' }, 500);
});

const page = await context.newPage();
page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${origin}/cabinet/admin/exams?examId=7&tab=questions`);
  await page.getByRole('checkbox', { name: 'Доступен студентам для подготовки' }).waitFor();
  await page.getByRole('button', { name: 'Предпросмотр подготовки', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Предпросмотр: прогресс не сохраняется', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Учить весь экзамен', exact: true }).click();
  await dialog.getByRole('button', { name: 'Учить выбранный набор (10)', exact: true }).click();
  await dialog.getByText('Пройдено 0 из 10', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Знаю', exact: true }).click();
  await dialog.getByText('Пройдено 1 из 10', { exact: true }).waitFor();
  assert.equal(requests.filter(r => r.m !== 'GET' && (r.p.includes('section-study-settings') || r.p.includes('mark-card-learned'))).length, 0);
  await page.screenshot({ path: `${output}/admin-preview.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Доступен студентам для подготовки' }).click();
  await page.getByText('Подготовка открыта · Частей: 3 · Карточек: 13', { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/admin-toolbar.png`, fullPage: true });

  user = { role: 'student', id: 42, full_name: 'Тестовый студент' };
  await page.goto(`${origin}/cabinet/student/train`);
  await page.getByRole('heading', { name: 'Математика · Экзамен №7', exact: true }).click();
  await page.waitForURL('**/cabinet/student/train/exam/7');
  await page.getByRole('heading', { name: 'Часть C', exact: true }).waitFor();
  await page.getByText('В этой части пока нет вопросов', { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/student-parts.png`, fullPage: true });
  await page.getByRole('button', { name: 'Учить весь экзамен', exact: true }).click();
  await page.getByRole('button', { name: 'Учить весь экзамен (12)', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Учить весь экзамен (12)', exact: true }).click();
  await page.getByText('Пройдено 0 из 12', { exact: true }).waitFor();
  assert.equal(settings.get('7').last_batch_index, -1);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await page.getByRole('heading', { name: 'Весь экзамен', exact: true }).waitFor();

  await page.goto(`${origin}/cabinet/student/train/exam/7/part/2`);
  await page.getByRole('heading', { name: 'Часть B', exact: true }).waitFor();
  const answer = page.locator('details').first(); await answer.locator('summary').click();
  assert.equal(await answer.locator('p').evaluate(element => getComputedStyle(element).whiteSpace), 'pre-wrap');
  assert.ok((await answer.innerText()).includes('\n\n'));
  await page.getByRole('button', { name: 'Учить всю часть (2)', exact: true }).click();
  await page.getByText('Пройдено 0 из 2', { exact: true }).waitFor();
  assert.equal(settings.get('7').last_part_id, 2);
  failure = 'network';
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByText('Не удалось сохранить прогресс. Повторите попытку.', { exact: true }).waitFor();
  await page.getByText('Пройдено 0 из 2', { exact: true }).waitFor();
  failure = 'stale';
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByText('Содержание карточки изменилось. Ознакомьтесь с обновлённым вопросом и ответом', { exact: true }).waitFor();
  await page.getByText('Обновлённый вопрос после изменения банка', { exact: true }).waitFor();
  const current = page.locator('[class*="flashcardCurrent"]'); await current.click();
  await page.getByText('Ответ', { exact: true }).first().waitFor();
  await page.waitForFunction(() => {
    const inner = document.querySelector('[class*="flashcardCurrent"] [class*="flashcardInner"]');
    return inner && new DOMMatrix(getComputedStyle(inner).transform).m11 < -0.9999;
  });
  assert.equal(await current.locator('[class*="flashcardBack"] p').last().evaluate(element => getComputedStyle(element).whiteSpace), 'pre-wrap');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/student-multiline-mobile.png`, fullPage: true, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByText('Пройдено 1 из 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByRole('heading', { name: 'Занятие завершено', exact: true }).waitFor();
  await page.getByText('Прогресс области: 2 из 2 выучено · 100%', { exact: true }).waitFor();
  assert.equal(progress.size, 4);
  await page.goto(`${origin}/cabinet/student/train/exam/7/part/2`);
  await page.getByLabel('Режим', { exact: true }).selectOption('learned');
  await page.getByRole('button', { name: 'Учить всю часть (2)', exact: true }).click();
  await page.getByText('Пройдено 0 из 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByText('Пройдено 1 из 2', { exact: true }).waitFor();
  assert.equal(progress.size, 4);
  enabled = false;
  await page.getByRole('button', { name: 'Знаю', exact: true }).click();
  await page.getByText('Подготовка по этому экзамену сейчас недоступна', { exact: true }).waitFor();
  assert.equal(await page.locator('[class*="flashcardCurrent"]').count(), 0);
  enabled = true;
  await page.goto(`${origin}/cabinet/student/train/exam/7/part/2`);
  await page.getByRole('heading', { name: 'Часть B', exact: true }).waitFor();
  enabled = false;
  await page.getByLabel('Режим', { exact: true }).selectOption('all');
  await page.getByText('Подготовка по этому экзамену сейчас недоступна', { exact: true }).waitFor();
  assert.equal(await page.locator('details').count(), 0);
  await page.reload();
  await page.getByText('Подготовка по этому экзамену сейчас недоступна', { exact: true }).waitFor();
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', scenarios: ['hidden preview without writes', 'preview batch boundaries', 'admin toggle', 'catalog stable URL', 'parts and empty part', 'all-exam unlearned includes stale', 'scope settings resume', 'multiline desktop/mobile', 'network retry preserves deck', 'stale version replacement', 'completion aggregate', 'learned repetition idempotence', 'disabled active deck', 'disabled settings closes bank', 'disabled direct URL'], apiRequests: requests.length, externalRequests: 0, screenshots: output }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.error(JSON.stringify({ unexpected, errors, recentRequests: requests.slice(-8) }, null, 2));
  throw error;
} finally { await browser.close(); }
