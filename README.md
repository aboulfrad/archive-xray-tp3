# Archive X-Ray

Un lecteur et inspecteur de rendus ZIP : explorer le code, chercher un fichier, examiner des signaux, comparer deux versions et exporter un rapport. Les archives importées restent dans le navigateur ; aucun code du rendu n’est exécuté.

## Démo publique

https://archive-xray-production.up.railway.app

Dépôt : https://github.com/aboulfrad/archive-xray-tp3

CI : [exécution réussie du workflow Validation](https://github.com/aboulfrad/archive-xray-tp3/actions/runs/37884821149), preuve détaillée dans `preuves/github-ci.json`.

## Démarrer

Node.js 24 recommandé (minimum 22.12), npm. Aucun modèle, clé API ou compte nécessaire pour utiliser l’application.

```sh
npm ci
npm run build
npm start
```

Ouvrir http://localhost:3000. Développement : `npm run dev` (http://localhost:5173). Le port production se configure avec `PORT`.

Le ZIP de rendu contient aussi `dist/` : avec Node.js installé, `npm start` suffit pour lancer cette version compilée, sans installer les dépendances. Les commandes ci-dessus permettent de la reconstruire depuis les sources.

## Utiliser

Déposer un ZIP, ou ouvrir l’une des quatre démonstrations. **Les cas de figure** (`public/demos/cas-de-figure.zip`) réunit des exemples synthétiques à examiner. Une cinquième archive, `public/demos/projet-version-2.zip`, sert à essayer la comparaison. Pour l’oral, le guide utilise seulement le TP1 personnel et le ZIP Cas de figure. Explorer les fichiers, rechercher dans les contenus lus, ajouter des annotations puis télécharger un rapport Markdown. L’export ZIP reconstruit les fichiers choisis sans modifier leurs octets ; il ne nettoie pas les secrets de fichiers conservés.

La checklist s’adapte au ZIP : **Projet** pour des repères génériques, **Site web** pour un site, **Personnalisée** pour vos propres attentes. Les profils TP1/TP2/TP3 restent disponibles en option pour le cours.

En mode personnalisé, ajouter jusqu’à 20 règles : un nom de fichier (par exemple `README.md`), une extension (`.html`) ou un dossier contenant des fichiers (`assets`). Chaque règle donne les fichiers correspondants ou indique leur absence. Les correspondances sont littérales, sans expression régulière. Le libellé est limité à 80 caractères et la cible à 160 caractères.

La checklist ne juge pas la qualité et n’attribue aucune note : un fichier trouvé ne prouve pas que le projet fonctionne, ni que ses tests, MCP, hooks ou CI ont été exécutés. Le profil et les règles personnalisées sont conservés dans le navigateur ; les ZIP, leurs contenus et les annotations ne le sont pas.

Une image dont les dimensions sont inconnues ou dépassent les limites conserve sa place dans l’inventaire, mais son aperçu est désactivé pour limiter la mémoire utilisée. Ce message ne signifie pas que l’image est malveillante. Son fichier original reste exportable si les autres contrôles l’autorisent.

## Vérifier

```sh
npm run check
npm run proof:mcp
npm run proof:harness
npx playwright install chromium
CI=1 npm run test:e2e
npm audit
```

Sur macOS avec Chrome installé, `npm run test:e2e` utilise Chrome. En CI, Chromium est installé par le workflow. Un serveur de production est démarré automatiquement. Les captures et résultats se trouvent dans captures/ et preuves/. Le hook Git pre-commit lance `npm run check` ; `npm ci` l’installe uniquement si le dossier est bien la racine de son propre dépôt et si aucun autre hook local n’est configuré.

Seuils de couverture : 85 % lignes/instructions/fonctions, 75 % branches. Les contrôles échoués bloquent la chaîne.

## Déploiement Railway

Projet prêt pour un build Docker : Dockerfile et railway.toml. Le runtime distribue dist/, n’installe pas de dépendances, s’exécute en utilisateur non privilégié et répond à /health. Aucun volume, stockage des rendus, base de données ou variable secrète n’est nécessaire.

```sh
railway login
railway link
railway up
railway domain --port 8080
```

Dans Railway : service du projet → Settings → Networking → Generate Domain, avec le port réellement affiché dans les logs : Railway injecte ici PORT=8080, alors que le serveur local utilise 3000. Utiliser l’URL HTTPS obtenue. Le déploiement peut consommer le crédit du compte ; aucune souscription payante n’est nécessaire au code.

Documentation : [Dockerfiles](https://docs.railway.com/guides/dockerfiles), [domaines publics](https://docs.railway.com/guides/public-networking), [CLI](https://docs.railway.com/guides/cli).

## Documents et preuves

- DESIGN.md : problème, critères, architecture et compromis.
- SECURITY.md : menaces et limites.
- TESTPLAN.md : scénarios d’acceptation.
- PITCH.md : démo et réponses pour l’oral.
- DEMO-ORAL.md : parcours de 4 à 5 minutes avec un TP1 personnel et le ZIP synthétique Cas de figure.
- RENDU.md : correspondance TP3 et état exact des preuves.
- AGENTS.md, .agents/skills/, opencode.json, .opencode/ : harness de reprise ; première version développée en solo, puis révision ciblée avec des agents autorisée par l’auteur.
- preuves/check.log, preuves/mcp.json, preuves/harness.json, preuves/e2e.json et captures/ : résultats réels lorsque générés.

Le MCP de développement expose seulement `read_contract` et `explain_check`, sans chemin libre, shell ou rendu personnel. `npm run proof:mcp` est un échange réel SDK client/serveur. `proof:harness` teste directement les hooks : cela ne prouve pas leur déclenchement dans une session OpenCode. La configuration CI n’est pas une preuve de run distant.

## Limites

ZIP classique, STORE/DEFLATE. ZIP64, remplacements Unicode de noms (champ 0x7075) et multi-volumes refusés. Limites : 64 Mio compressés, 2500 entrées, 256 Mio annoncés, 1 Mio lu par fichier, 12 Mio cumulés, 20 secondes par opération. Export jusqu’à 32 Mio. Les aperçus PNG/JPEG/GIF/WebP exigent une signature et des dimensions lisibles, au maximum 4 millions de pixels et 8192 pixels par côté. Pas d’analyse récursive, déchiffrement, exécution de tests importés ou antivirus. Les règles de secrets peuvent manquer des valeurs ou signaler des exemples.

## Technologies

React, TypeScript strict, Vite, fflate, lucide-react. Vitest, Playwright et SDK MCP pour l’outillage. Serveur HTTP Node sans framework. Les dépendances sont verrouillées dans package-lock.json.
