import { expect, test, type Download, type Page } from '@playwright/test';
import { PDFDocument, rgb } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

const networkViolations = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }) => {
  const found: string[] = [];
  networkViolations.set(page, found);
  context.on('request', request => {
    if (!request.url().startsWith('http')) return;
    const url = new URL(request.url());
    const allowedPath = url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest' || /^\/icon(?:-\d+)?\.(?:png|svg)$/.test(url.pathname) || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pdfjs/') || url.pathname.startsWith('/licenses/');
    if (request.method() !== 'GET' || request.postData() !== null || url.hostname !== '127.0.0.1' || url.search || !allowedPath) found.push(`${request.method()} ${request.url()}`);
  });
});
test.afterEach(async ({ page }) => { expect(networkViolations.get(page)).toEqual([]); });

const marker = 'DOCUMENT-PRIVE-TEST-NE-PAS-TRANSMETTRE';
async function fixture(name = `${marker}.pdf`, sizes = [300, 400, 500]) {
  const doc = await PDFDocument.create();
  sizes.forEach((width, index) => { const page = doc.addPage([width, 600]); page.drawRectangle({ x: 20, y: 390, width: width - 40, height: 140, color: rgb(.43, .32, .85) }); page.drawText(`LEVISA test ${index + 1}`, { x: 24, y: 552, size: 20 }); page.drawText(marker, { x: 24, y: 350, size: 9 }); });
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save({ useObjectStreams: false })) };
}
async function load(page: Page, tool: string, files: Awaited<ReturnType<typeof fixture>>[]) {
  await page.goto(`/#/outil/${tool}`);
  await page.getByLabel('Importer des PDF').setInputFiles(files);
  await expect(page.getByText('Ouverture et vérification de vos fichiers', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}
async function bytes(download: Download) {
  return new Uint8Array(await readFile((await download.path())!));
}
async function output(page: Page, action: string, multiple = false) {
  await page.getByRole('button', { name: action, exact: true }).click();
  const link = page.getByRole('link', { name: multiple ? /Tout télécharger en ZIP/ : /Télécharger le résultat/ });
  await expect(link).toBeVisible();
  const event = page.waitForEvent('download');
  await link.click();
  return bytes(await event);
}

test('home, filter, search, dark mode and responsive navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Vos PDF. Vos outils.');
  await expect(page.locator('.tool-card')).toHaveCount(7);
  await page.screenshot({ path: 'test-results/accueil-desktop.png', fullPage: true });
  await page.getByLabel('Rechercher un outil').fill('fusionner');
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await page.getByLabel('Rechercher un outil').fill('');
  await page.getByRole('button', { name: 'Convertir', exact: true }).click();
  await expect(page.locator('.tool-card')).toHaveCount(2);
  await page.getByLabel('Activer le mode sombre').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'test-results/accueil-sombre.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Activer le mode clair').click();
  await page.getByRole('button', { name: /Tous les outils/ }).click();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/accueil-mobile.png', fullPage: true });
  await page.getByLabel('Ouvrir le menu').click();
  await page.getByRole('navigation').getByText('Confidentialité', { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre espace privé');
});

test('merge reorders sources and releases temporary result URLs', async ({ page }) => {
  await load(page, 'merge', [await fixture('premier.pdf', [300, 400]), await fixture('second.pdf', [600])]);
  await page.getByLabel('Monter second.pdf').click();
  const result = await output(page, 'Fusionner les PDF');
  const doc = await PDFDocument.load(result);
  expect(doc.getPages().map(p => p.getWidth())).toEqual([600, 300, 400]);
  const url = await page.getByRole('link', { name: /Télécharger le résultat/ }).getAttribute('href');
  await expect(page.locator('.file-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Supprimer mes fichiers / Recommencer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sélectionner des PDF' })).toBeVisible();
  expect(await page.evaluate(async url => { try { await fetch(url!); return false; } catch { return true; } }, url)).toBe(true);
});

test('split produces correct PDFs in a downloadable ZIP', async ({ page }) => {
  await load(page, 'split', [await fixture()]);
  await page.getByLabel('Mode d’extraction').selectOption('groups');
  await page.getByLabel('Groupes de pages').fill('1,3 ; 2');
  const result = await output(page, 'Diviser le PDF', true);
  const zip = unzipSync(result);
  const pdfs = await Promise.all(Object.values(zip).map(bytes => PDFDocument.load(bytes)));
  expect(pdfs.map(doc => doc.getPages().map(p => p.getWidth()))).toEqual([[300, 500], [400]]);
});

test('organize adds, removes, reorders and rotates pages', async ({ page }) => {
  await load(page, 'organize', [await fixture('premier.pdf', [300, 400])]);
  await page.getByLabel('Importer des PDF').setInputFiles([await fixture('second.pdf', [500])]);
  await expect(page.locator('.page-tile')).toHaveCount(3);
  await page.getByLabel('Supprimer la page 2', { exact: true }).click();
  await page.getByLabel('Déplacer la page 2 avant').click();
  await page.getByLabel('Pivoter la page 1', { exact: true }).click();
  await page.screenshot({ path: 'test-results/organiser.png', fullPage: true });
  const result = await output(page, 'Enregistrer le PDF');
  const doc = await PDFDocument.load(result);
  expect(doc.getPages().map(p => [p.getWidth(), p.getRotation().angle])).toEqual([[500, 90], [300, 0]]);
});

test('rotate validates pages then rotates just the requested page', async ({ page }) => {
  await load(page, 'rotate', [await fixture()]);
  await page.getByLabel('Pages à faire pivoter').fill('0');
  await page.getByRole('button', { name: 'Pivoter le PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('comprises entre');
  await page.getByLabel('Pages à faire pivoter').fill('2');
  await page.getByRole('button', { name: '180°', exact: true }).click();
  const result = await output(page, 'Pivoter le PDF');
  expect((await PDFDocument.load(result)).getPages().map(p => p.getRotation().angle)).toEqual([0, 180, 0]);
});

test('images to PDF works with multiple images and selected page format', async ({ page }) => {
  await page.goto('/#/outil/images-pdf');
  const png = await readFile('dist/icon-192.png');
  const jpeg = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#6950df'; ctx.fillRect(0, 0, 120, 80); return canvas.toDataURL('image/jpeg').split(',')[1]; });
  await page.getByLabel('Importer des images').setInputFiles([{ name: 'image-1.png', mimeType: 'image/png', buffer: png }, { name: 'image-2.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') }]);
  await expect(page.locator('.file-row')).toHaveCount(2);
  await page.getByLabel('Format des pages').selectOption('letter');
  await page.getByRole('combobox', { name: 'Orientation', exact: true }).selectOption('landscape');
  const result = await output(page, 'Créer le PDF');
  const doc = await PDFDocument.load(result);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
});

test('PDF to PNG renders real pages in a ZIP, and JPG is also supported', async ({ page }) => {
  await load(page, 'pdf-images', [await fixture()]);
  await page.getByLabel('Pages à convertir').fill('1,3');
  const zip = unzipSync(await output(page, 'Convertir en images', true));
  expect(Object.keys(zip)).toEqual(['levisa-page-001.png', 'levisa-page-003.png']);
  expect(Array.from(Object.values(zip)[0].slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(Object.values(zip)[0].length).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Supprimer mes fichiers / Recommencer', exact: true }).click();
  await page.getByLabel('Importer des PDF').setInputFiles([await fixture('one.pdf', [300])]);
  await page.getByLabel('Format d’image').selectOption('image/jpeg');
  const jpg = await output(page, 'Convertir en images');
  expect(Array.from(jpg.slice(0, 3))).toEqual([255, 216, 255]);
});

test('compression shows real size and never returns a larger file', async ({ page }) => {
  const file = await fixture();
  await load(page, 'compress', [file]);
  const result = await output(page, 'Optimiser le PDF');
  expect(result.length).toBeLessThanOrEqual(file.buffer.length);
  expect((await PDFDocument.load(result)).getPageCount()).toBe(3);
  await expect(page.getByText('% de réduction', { exact: false })).toBeVisible();
});

test('no document transfer, no document storage, and fresh operations work offline', async ({ page, context }) => {
  const violations: string[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  context.on('request', request => {
    if (!request.url().startsWith('http')) return;
    requests.push(request.url());
    const url = new URL(request.url());
    if (request.method() !== 'GET' || request.postData() !== null || url.hostname !== '127.0.0.1' || url.search || request.url().includes(marker)) violations.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('/');
  await expect(page.getByText('Prêt hors ligne', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await load(page, 'merge', [await fixture(), await fixture('autre.pdf', [600])]);
  await output(page, 'Fusionner les PDF');
  expect(violations).toEqual([]);
  expect(requests.length).toBeGreaterThan(0);
  const storage = await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), databases: await indexedDB.databases(), cacheUrls: (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat() }));
  expect(storage.local).toEqual([]); expect(storage.session).toEqual([]); expect(storage.databases).toEqual([]);
  expect(storage.cacheUrls.length).toBeGreaterThan(20);
  expect(storage.cacheUrls.some(url => url.includes(marker) || /\.pdf(?:$|\?)/i.test(url) || url.startsWith('blob:'))).toBe(false);
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Vos PDF. Vos outils.');
  await page.goto('/#/outil/merge');
  await page.getByLabel('Importer des PDF').setInputFiles([await fixture('hors-ligne-1.pdf', [200]), await fixture('hors-ligne-2.pdf', [300])]);
  const result = await output(page, 'Fusionner les PDF');
  expect((await PDFDocument.load(result)).getPageCount()).toBe(2);
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('invalid files, size limits and navigation cleanup', async ({ page }) => {
  await page.goto('/#/outil/split');
  await page.getByLabel('Importer des PDF').setInputFiles([{ name: 'faux.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Ceci ne contient aucun PDF') }]);
  await expect(page.getByRole('alert')).toContainText('fichiers PDF valides');
  await page.getByLabel('Importer des PDF').setInputFiles([{ name: 'grand.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(26 * 1024 * 1024) }]);
  await expect(page.getByRole('alert')).toContainText('25 Mo');
  await page.getByLabel('Importer des PDF').setInputFiles([await fixture()]);
  await expect(page.locator('.preview-paper canvas')).toBeVisible();
  await page.getByRole('link', { name: 'Tous les outils', exact: true }).last().click();
  await page.goto('/#/outil/split');
  await expect(page.getByRole('button', { name: 'Sélectionner un PDF', exact: true })).toBeVisible();
  await expect(page.locator('.preview-paper')).toHaveCount(0);
});

test('file drag and drop order is exported correctly', async ({ page }) => {
  await load(page, 'merge', [await fixture('one.pdf', [300]), await fixture('two.pdf', [500])]);
  await page.locator('.file-row').nth(0).dragTo(page.locator('.file-row').nth(1));
  await expect(page.locator('.file-row').first()).toContainText('two.pdf');
  const result = await output(page, 'Fusionner les PDF');
  expect((await PDFDocument.load(result)).getPages().map(p => p.getWidth())).toEqual([500, 300]);
});

test('mobile workspace, keyboard skip link and install instructions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, 'rotate', [await fixture()]);
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Faire pivoter PDF');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/outil-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Installer l’app', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Safari sur iPhone ou iPad')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Supprimer mes fichiers / Recommencer', exact: true }).click();
});
