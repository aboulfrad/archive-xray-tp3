import { test, expect } from '@playwright/test';
import { zipSync, strToU8, unzipSync } from 'fflate';
import { readFile, mkdir } from 'node:fs/promises';

const sample = (files: Record<string, string>) =>
  Buffer.from(
    zipSync(
      Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
      { level: 0 },
    ),
  );

test('parcours complet : inspection, recherche, annotation, rapport, diff et export', async ({
  page,
}) => {
  const requests: { url: string; method: string }[] = [];
  const errors: string[] = [];
  page.on('request', (req) => requests.push({ url: req.url(), method: req.method() }));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Voir ce que votre archive contient vraiment.' }),
  ).toBeVisible();
  await mkdir('captures', { recursive: true });
  await page.screenshot({ path: 'captures/01-accueil.png', fullPage: true });
  await page.getByRole('button', { name: /Un projet complet README/ }).click();
  await expect(
    page.getByRole('heading', { name: 'projet-complet.zip', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('14 contenus lus et contrôlés', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'captures/02-inspection.png', fullPage: true });
  await page.getByRole('button', { name: 'Checklist du rendu', exact: true }).click();
  await expect(page.locator('.check-card.found')).toHaveCount(12);
  await page.screenshot({ path: 'captures/03-checklist.png', fullPage: true });
  await page.getByRole('button', { name: 'Explorateur', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Rechercher dans les noms et contenus lus' })
    .fill('celsiusToFahrenheit');
  await page.locator('.search-result').filter({ hasText: 'src/temperature.ts' }).click();
  await expect(page.getByRole('region', { name: 'Contenu du fichier' })).toContainText(
    'return celsius * 9 / 5 + 32',
  );
  await page
    .getByRole('textbox', { name: 'Annotation du fichier', exact: true })
    .fill('Vérifier aussi NaN et Infinity.');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.screenshot({ path: 'captures/04-explorateur.png', fullPage: true });
  await page.getByRole('button', { name: 'Comparer deux ZIP', exact: true }).click();
  await page.getByRole('button', { name: 'Essayer la seconde version de démonstration' }).click();
  await expect(page.locator('.comparison-stats .changed')).toContainText('1');
  await page.locator('.comparison-files button').filter({ hasText: 'src/temperature.ts' }).click();
  await expect(page.locator('.diff-panes')).toContainText('Number.isFinite');
  await page.screenshot({ path: 'captures/05-comparaison.png', fullPage: true });
  await page.getByRole('button', { name: 'Rapport & export', exact: true }).click();
  const reportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le rapport .md' }).click();
  const report = await reportEvent;
  const path = await report.path();
  expect(path).toBeTruthy();
  expect(await readFile(path!, 'utf8')).toContain('Vérifier aussi NaN et Infinity.');
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la sélection', exact: true }).click();
  const exported = await exportEvent;
  const data = await readFile((await exported.path())!);
  expect(Object.keys(unzipSync(data))).toHaveLength(14);
  expect(errors).toEqual([]);
  expect(requests.every((req) => ['GET', 'HEAD'].includes(req.method))).toBe(true);
  expect(requests.every((req) => new URL(req.url).hostname === new URL(page.url()).hostname)).toBe(
    true,
  );
});

test('archive piégée : chemin bloqué, secret masqué, Markdown inerte et export filtré', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Une archive à examiner Chemins/ }).click();
  await expect(
    page.getByRole('heading', { name: 'archive-piegee.zip', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Points d’attention/ })
    .first()
    .click();
  await expect(page.getByText('Chemin d’extraction dangereux', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'captures/06-alertes.png', fullPage: true });
  await page
    .locator('.finding-card')
    .filter({ hasText: 'Secret potentiel dans le contenu' })
    .click();
  await expect(page.getByRole('region', { name: 'Contenu du fichier' })).toContainText(
    '[VALEUR MASQUÉE]',
  );
  await expect(page.getByRole('region', { name: 'Contenu du fichier' })).not.toContainText(
    'illustrationOnly123456789',
  );
  await page
    .getByRole('textbox', { name: 'Rechercher dans les noms et contenus lus' })
    .fill('src/README.md');
  await page.locator('.search-result').click();
  await expect(page.locator('.markdown-preview')).toContainText('<script>');
  expect(
    await page
      .locator('.markdown-preview img, .markdown-preview script, .markdown-preview a')
      .count(),
  ).toBe(0);
  await page.getByRole('button', { name: 'Rapport & export', exact: true }).click();
  await expect(page.locator('.selection-list input:disabled')).toHaveCount(1);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la sélection', exact: true }).click();
  const files = Object.keys(unzipSync(await readFile((await (await event).path())!)));
  expect(files).not.toContain('../sortie.txt');
  expect(files).not.toContain('.env');
  expect(files.some((f) => f.includes('node_modules'))).toBe(false);
  expect(errors).toEqual([]);
});

test('une archive invalide ne casse pas la prochaine importation', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'broken.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('not zip'),
    });
  await expect(page.getByRole('alert')).toContainText('ZIP');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'fixed.zip',
      mimeType: 'application/zip',
      buffer: sample({ 'README.md': '# fixed' }),
    });
  await expect(page.getByRole('heading', { name: 'fixed.zip', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('le diff ne dévoile pas les secrets et la prévisualisation résiste à beaucoup de lignes', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'v1.zip',
      mimeType: 'application/zip',
      buffer: sample({ '.env': 'password=PrivateBefore123', 'README.md': '# one' }),
    });
  await expect(page.getByRole('heading', { name: 'v1.zip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comparer deux ZIP', exact: true }).click();
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({
      name: 'v2.zip',
      mimeType: 'application/zip',
      buffer: sample({ '.env': 'password=PrivateAfter123', 'README.md': '# one' }),
    });
  await expect(page.locator('.comparison-stats')).toBeVisible();
  await page.locator('.comparison-files button').filter({ hasText: '.env' }).click();
  await expect(page.locator('.diff-panes')).not.toContainText('PrivateBefore123');
  await expect(page.locator('.diff-panes')).not.toContainText('PrivateAfter123');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'lines.zip',
      mimeType: 'application/zip',
      buffer: sample({ 'lots.txt': 'line\n'.repeat(30000) }),
    });
  await expect(page.getByRole('heading', { name: 'lines.zip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explorateur', exact: true }).click();
  await page.locator('.tree-row').filter({ hasText: 'lots.txt' }).click();
  await expect(page.locator('.code-line')).toHaveCount(2000);
});

test('aperçu PNG réel et refus d’une image aux dimensions excessives', async ({ page }) => {
  const image = await readFile('captures/01-accueil.png');
  const oversized = Buffer.from(image);
  oversized.writeUInt32BE(16000, 16);
  oversized.writeUInt32BE(16000, 20);
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'images.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(
        zipSync({ 'normal.png': image, 'oversized.png': oversized }, { level: 0 }),
      ),
    });
  await expect(page.getByRole('heading', { name: 'images.zip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explorateur', exact: true }).click();
  await page.locator('.tree-row').filter({ hasText: 'normal.png' }).click();
  const preview = page.getByRole('img', { name: 'Aperçu de normal.png' });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.locator('.tree-row').filter({ hasText: 'oversized.png' }).click();
  await expect(page.getByRole('heading', { name: 'Aucun aperçu disponible' })).toBeVisible();
  await expect(page.locator('.empty-reader')).toContainText('4 millions');
  await expect(page.locator('.image-preview img')).toHaveCount(0);
});

test('interface mobile sans débordement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choisir une archive' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'captures/07-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /Un projet complet README/ }).click();
  await expect(
    page.getByRole('heading', { name: 'projet-complet.zip', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('serveur : santé, HEAD, POST interdit et headers de sécurité', async ({ request }) => {
  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok', app: 'archive-xray' });
  const head = await request.head('/');
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const post = await request.post('/upload', { data: 'private' });
  expect(post.status()).toBe(405);
  const missing = await request.get('/missing.zip');
  expect(missing.status()).toBe(404);
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['strict-transport-security']).toBe('max-age=31536000');
  for (const path of ['/.env', '/.git/config', '/%2e%2e%2fpackage.json']) {
    expect((await request.get(path)).status()).toBe(403);
  }
});
