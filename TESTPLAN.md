# Plan de validation

Les résultats d’exécution sont conservés dans preuves/. Une configuration ou un test présent ne vaut pas un résultat passé.

| Famille    | Scénarios attendus                                                                                            | Résultat attendu                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ZIP normal | STORE, DEFLATE, Unicode UTF-8 et CP437, vide, Buffer avec offset                                              | Octets exacts, CRC valide, interface utilisable                                                              |
| Intégrité  | Troncature, signature, en-têtes contradictoires, CRC faux, chevauchement                                      | Refus lisible ; nouvelle importation possible                                                                |
| Ressources | Taille déclarée falsifiée, expansion disproportionnée, trop d’entrées, profondeur, budgets                    | Lecture interrompue ou explicitement exclue                                                                  |
| Noms       | ../, absolu POSIX/Windows, backslashes, ADS, Unicode invisible, collisions                                    | Constat localisé, export refusé si chemin dangereux                                                          |
| Contenus   | Binaire, UTF-8 invalide, SVG et Markdown actifs, fausses signatures                                           | Aperçu inerte ou absent ; aucune ressource externe                                                           |
| Images     | Dimensions nulles, inconnues, tronquées et excessives ; PNG/JPEG/GIF/WebP ; échec du décodage natif           | Aperçu désactivé avec explication, inventaire conservé ; aucun décodage avant signature/dimensions acceptées |
| Secrets    | Tokens, clés complètes/incomplètes/imbriquées, nombreux marqueurs, affectations, URI, exemples évidents       | Heuristiques expliquées, valeurs masquées par défaut et dans rapport/diff                                    |
| Checklist  | Profils projet/site web/TP1/TP2/TP3 ; règles personnalisées nom/extension/dossier ; exclusion des dépendances | Présence seule ; règles bornées et validées ; aucun verdict de qualité, d’exécution ou de note               |
| Diff       | Racines distinctes, ajout/suppression/modification/identité, doublons                                         | Résultats explicables, aucun chemin silencieusement perdu                                                    |
| Export     | Sélection, origine inchangée, CRC revérifié, collisions fichier/fichier et fichier/dossier, budget            | ZIP lisible, octets exacts, aucune suppression implicite de secret                                           |
| Interface  | Démo, import, recherche, annotation, rapport, comparaison, erreurs, mobile                                    | Parcours sans exception console ni envoi de ZIP                                                              |
| Harness    | MCP stdio et sélecteur invalide, type réellement faux, hook Git                                               | Réponses réelles, erreur bloquante, périmètre de preuve exact                                                |
| HTTP       | Santé, HEAD, chemins cachés/traversée refusés, POST interdit, CSP, HSTS, fichiers absents                     | Statuts et en-têtes attendus                                                                                 |

`npm run check` impose lint, TypeScript strict, tests Vitest avec couverture (85 % lignes/instructions/fonctions et 75 % branches minimum) et build production. `npm run test:e2e` utilise Chromium et le serveur production. Les seuils ne sont pas abaissés pour livrer.

`npm run proof:mcp` est un échange réel client/serveur MCP. `npm run proof:harness` injecte temporairement une erreur TypeScript, vérifie son blocage puis la retire et revérifie le succès. C’est une preuve de composant, distincte du déclenchement du plugin dans une session OpenCode.

Scénarios de cette révision à vérifier avant livraison : choisir le profil site web, créer/modifier/supprimer des règles personnalisées, retrouver leurs correspondances, recharger leur configuration et refuser une configuration locale invalide. Vérifier que les règles ne rendent pas les contenus actifs et qu’aucune archive n’est persistée. Le passage de ces scénarios doit être attesté par une exécution réelle, pas par ce document.

Régressions de sécurité : budgets globaux des noms/arbre/alertes, maintien des exclusions au-delà du plafond, plafonds des observations, champs supplémentaires locaux ambigus ou tronqués, contenu Markdown hostile rendu en code inerte.
