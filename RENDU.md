# Dossier de rendu TP3 — Archive X-Ray

Démo : https://archive-xray-production.up.railway.app
Dépôt : https://github.com/aboulfrad/archive-xray-tp3

## Problème → solution → utilité

Un enseignant ou un étudiant doit lire un projet ZIP, retrouver ses éléments et éviter certaines erreurs avant extraction ou partage. Un navigateur suffit pour inventorier, chercher, lire, relever des signaux, comparer deux versions et produire un rapport. L’analyse locale évite de transmettre des rendus confidentiels au serveur.

## Éléments en rapport avec le cours et le TP3

| Attendu                                         | Réalisation                                                                                                           | État de preuve                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Projet concret, utile et démontrable            | Application web complète, parcours inspection/comparaison/rapport/export                                              | Captures et tests navigateur réels                                                                                           |
| IA encadrée par un contrat                      | AGENTS.md, DESIGN.md, SECURITY.md, TESTPLAN.md                                                                        | Règles appliquées à la conception assistée avec Codex                                                                        |
| Harness : règles, commandes, roles, permissions | opencode.json, .opencode/agents, commands, plugin, skill                                                              | Configurations livrées ; agents spécialisés non exécutés pendant le développement solo                                       |
| MCP                                             | Deux outils en lecture seule, sans chemin libre                                                                       | SDK client/serveur utilisé réellement ; `opencode mcp list` affiche le serveur connecté                                      |
| Hooks et vérifications                          | Git pre-commit, plugin post-edit, lint/types/tests/build/CI                                                           | Plugin testé directement avec une vraie erreur TypeScript ; déclenchement post-edit dans une session OpenCode non revendiqué |
| Vérifications automatiques                      | 130 tests Vitest et 11 scénarios Playwright                                                                           | Résultats locaux conservés ; couverture 100 % lignes, 97,56 % branches du moteur                                             |
| Robustesse mise à l’épreuve                     | ZIP malformés, tailles falsifiées, traversée, CRC, budget, chiffrement, noms trompeurs, secrets, reprise après erreur | Scénarios ciblés et limites documentées                                                                                      |
| Lancement simple                                | README, Dockerfile, serveur minimal, /health                                                                          | Build Railway réussi ; URL publique, point de santé et onze parcours publics vérifiés                                        |
| Présentation courte puis démo                   | PITCH.md et quatre ZIP fictifs                                                                                        | Parcours reproductible ; aucune donnée du TP2 publiée dans les démos                                                         |

## Distinctions nécessaires pour une présentation honnête

La conception a été conduite **en solo avec Codex**, conformément à la demande de l’auteur. Les rôles OpenCode préparés ne prouvent pas une collaboration multi-agent. Le MCP a réellement été connecté depuis OpenCode, mais aucune session de génération OpenCode ni revue indépendante par son agent reviewer n’est revendiquée.

Le plugin a bloqué une erreur de type dans un test de composant. Cela prouve son comportement, pas son déclenchement dans une session de modèle. Une vraie tentative de commit a été refusée par le Git hook avec une erreur TypeScript ; voir preuves/git-hook.json. Le Git hook et la CI apportent des contrôles séparés. Le [workflow GitHub Validation a réellement réussi](https://github.com/aboulfrad/archive-xray-tp3/actions/runs/37917565634) : installation, contrôles bloquants, build et tests navigateur. La révision vérifiée et les métadonnées sont conservées dans preuves/github-ci.json.

Ces écarts d’outillage par rapport à une exigence d’usage exclusivement OpenCode doivent être présentés au professeur, sans les masquer derrière les fichiers de configuration. Aucune note, récompense ou conformité intégrale n’est garantie.

## Preuves

- `preuves/check.log` : lint, TypeScript strict, Vitest, couverture et build production.
- `preuves/e2e.json` : parcours navigateur exécutés.
- `preuves/github-ci.json` : exécution distante GitHub Actions réussie, lien et commit vérifié.
- `captures/01-accueil.png` à `07-mobile.png` : captures d’exécutions réelles, contenus fictifs uniquement.
- `preuves/audit.json` : audit npm, zéro vulnérabilité signalée à l’exécution.
- `preuves/mcp.json` : handshake SDK, outils, appel et sélecteur invalide refusé.
- `preuves/opencode-mcp.log` : serveur MCP connecté dans OpenCode.
- `preuves/harness.json` : contrôles de permissions du plugin, erreur TypeScript réelle bloquée puis état valide accepté.
- `preuves/real-rendu.json` : essai manuel du TP2 original en navigateur local, 95 fichiers et 94 contenus lus. Le ZIP personnel n’est pas inclus dans ce dépôt.

## Limites du produit

Inspection statique ciblée, pas antivirus. Présence de tests et CI repérée, exécution du rendu non vérifiée. Secrets détectés par heuristiques. Aucune extraction, exécution, déchiffrement ou récursion. Les formats non pris en charge et budgets atteints restent explicitement non analysés. Une copie filtrée conserve les octets des fichiers choisis.

## Sources pédagogiques relues

`sujet-tp3.pdf`, le contenu de `Consigne.md`, `Cours IA - IUT 2026.pdf`, rapports TP1 et TP2 de l’auteur. Les fichiers du cours restent dans le dossier pédagogique et ne sont pas redistribués dans le dépôt.

## Révision avant l’oral

À la demande explicite de l’auteur, trois sous-agents de l’environnement Codex ont contribué aux tests de checklist, au diagnostic HTTP local du TP1 personnel (agrégats uniquement) et à la documentation. Cela ne revendique ni des sessions d’agents OpenCode ni un audit indépendant. La révision initiale reste sauvegardée dans `backup/avant-checklist` et dans un ZIP séparé.

Checklist personnelle (fichier, extension, dossier), profil site web, messages d’aperçu clarifiés et archive synthétique de 34 fichiers illustrant les principaux cas de figure. Le TP1 privé reste sur l’appareil ; seules les données fictives et des preuves agrégées sont livrées. Guide : DEMO-ORAL.md.
