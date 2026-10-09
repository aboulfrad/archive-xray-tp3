import { mkdir, writeFile } from 'node:fs/promises';
import { strToU8, zipSync } from 'fflate';
const files = Object.create(null);
const add = (name, value) => {
  files[name] = typeof value === 'string' ? strToU8(value) : value;
};
add(
  'README.md',
  '# Cas de figure Archive X-Ray\n\nArchive pédagogique fictive. Aucun malware réel ni identifiant fonctionnel. Ne pas utiliser pour prouver une détection exhaustive.\n\nLes noms dangereux sont des exemples ; aucune extraction n’est nécessaire pour la démo.\n',
);
add('site/index.html', '<!doctype html><h1>Site fictif</h1>');
add('site/style.css', 'body { color: #222; }');
add('site/app.js', 'console.log("Exemple inerte dans X-Ray");');
add('documents/guide.txt', 'Document normal à lire et exporter.');
add('.env', 'password=FictitiousValue9123\n');
add(
  'secrets/cle.txt',
  '-----BEGIN PRIVATE KEY-----\nCeci est une cle fictive et invalide.\n-----END PRIVATE KEY-----',
);
add('../sortie.txt', 'Chemin dangereux fictif.');
add('/tmp/absolu.txt', 'Chemin absolu fictif.');
add('C:\\temp\\windows.txt', 'Chemin Windows fictif.');
add('notes.txt:cache', 'Flux NTFS fictif.');
add('facture.pdf.exe', 'Fichier texte, aucun programme réel.');
add('image.png', 'MZ - signature fictive, aucun executable valide.');
add('photo\u202egnp.exe', 'Nom trompeur, contenu texte fictif.');
add('DOC.txt', 'Premier nom.');
add('doc.txt', 'Nom en collision sur certains systèmes.');
add('collision', 'Fichier qui occupe le chemin parent.');
add('collision/enfant.txt', 'Conflit fichier/dossier.');
add('lien.txt', '../sortie.txt');
add('chiffre.txt', 'Exemple marque chiffre dans le ZIP, pas un chiffrement reel.');
add('methode-inconnue.txt', 'Compression declaree non prise en charge.');
add('crc-invalide.txt', 'Contenu volontairement different du CRC declare.');
add('node_modules/exemple/index.js', 'Dependance exclue de la lecture.');
add('.git/config', 'Historique fictif exclu.');
add('__MACOSX/._guide.txt', 'Metadonnee macOS fictive.');
add('.DS_Store', 'Metadonnee fictive.');
add('archive-interne.zip', zipSync({ 'interieur.txt': strToU8('Archive interne non ouverte.') }));
add('encodage.txt', new Uint8Array([255, 254, 1, 2]));
add('gros.txt', new Uint8Array(1024 * 1024 + 1).fill(65));
files['expansion.txt'] = [new Uint8Array(128 * 1024), { level: 6 }];
const image = new Uint8Array(33);
image.set([137, 80, 78, 71, 13, 10, 26, 10]);
const imageView = new DataView(image.buffer);
imageView.setUint32(8, 13);
image.set(strToU8('IHDR'), 12);
imageView.setUint32(16, 16000);
imageView.setUint32(20, 16000);
add('grande-image.png', image);
add(
  'notes.md',
  '# Markdown inerte\n<script>alert("Exemple fictif")</script>\n![image externe](https://example.invalid/pixel.png)\n',
);
add('package.json', JSON.stringify({ scripts: { test: 'vitest || true' } }));
add('test/demo.spec.ts', 'test.skip("Exemple de test ignore", () => {});\n');
const bytes = zipSync(files, { level: 0 });
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
let offset = view.getUint32(bytes.length - 6, true);
for (let i = 0; i < view.getUint16(bytes.length - 12, true); i++) {
  const length = view.getUint16(offset + 28, true);
  const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length));
  const local = view.getUint32(offset + 42, true);
  if (name === 'lien.txt') view.setUint32(offset + 38, (0o120777 << 16) >>> 0, true);
  if (name === 'chiffre.txt') {
    view.setUint16(offset + 8, view.getUint16(offset + 8, true) | 1, true);
    view.setUint16(local + 6, view.getUint16(local + 6, true) | 1, true);
  }
  if (name === 'methode-inconnue.txt') {
    view.setUint16(offset + 10, 99, true);
    view.setUint16(local + 8, 99, true);
  }
  if (name === 'crc-invalide.txt') {
    view.setUint32(offset + 16, 123, true);
    view.setUint32(local + 14, 123, true);
  }
  offset += 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
}
const out = new URL('../public/demos/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('cas-de-figure.zip', out), bytes);
console.log(
  JSON.stringify({
    archive: 'cas-de-figure.zip',
    files: Object.keys(files).length,
    bytes: bytes.length,
  }),
);
