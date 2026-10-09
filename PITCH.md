# Démonstration pour l’oral

Démo : https://archive-xray-production.up.railway.app

Dépôt : https://github.com/aboulfrad/archive-xray-tp3

## Pitch, 30 secondes

« Vous recevez des projets dans des ZIP. Avant de les extraire, il faut retrouver le README, comprendre la structure et repérer les fichiers qu’on ne devrait pas partager. Archive X-Ray donne un espace de lecture dans le navigateur : explorer, rechercher, examiner des signaux, comparer deux rendus et exporter un rapport. Le ZIP reste sur votre appareil. Les constats sont expliqués et l’outil distingue présence de fichiers et preuve d’exécution. »

## Démo directe, 4 à 5 minutes

Suivre [DEMO-ORAL.md](DEMO-ORAL.md), avec seulement deux ZIP : votre **TP1-rendu.zip** importé localement et la démonstration **Les cas de figure**. Le TP1 personnel n’est pas publié.

1. Importer le TP1 : montrer inventaire, volumes, contenus réellement lus, README et recherche dans le code.
2. Checklist : choisir **Personnalisée**, ajouter un nom de fichier, une extension ou un dossier attendu et montrer les correspondances. Dire : « Présence trouvée, pas qualité prouvée ; les profils TP sont facultatifs. »
3. Ouvrir **Les cas de figure** : expliquer un chemin refusé, un secret fictif masqué, une limite de lecture et une image sans aperçu. Dire : « La limite d’aperçu protège la mémoire ; elle ne déclare pas l’image malveillante. »
4. Rapport et export : l’original reste inchangé ; les fichiers conservés gardent leurs octets.
5. Ouvrir preuves/ : résultats réellement exécutés, MCP et blocage d’une erreur TypeScript. Distinguer configuré et effectivement vérifié.

La comparaison reste disponible pour montrer deux versions d’un même projet si le professeur la demande ; elle n’est pas nécessaire à ce parcours en deux ZIP.

## Réponses courtes aux objections

- **C’est un antivirus ?** « Non : c’est une inspection statique ciblée. Aucun code exécuté, aucun verdict absolu. »
- **Où est l’IA ?** « Dans la conception et le développement assistés, avec un contrat, des contrôles et un MCP. Le résultat fonctionne sans compte de modèle. »
- **Un secret peut passer ?** « Oui, ce sont des heuristiques. Le masquage et l’exclusion initiale sont des aides, pas une garantie. »
- **Puis-je tester mon ZIP ?** « Oui, jusqu’à 64 Mio, en ZIP classique. Les limites et les contenus non lus sont affichés. »
- **À quoi sert la checklist hors du cours ?** « Je définis les fichiers attendus : par exemple du HTML et un dossier assets pour un site. Elle retrouve leurs emplacements ; je vérifie ensuite leur contenu. »
- **Pourquoi mon image n’a-t-elle pas d’aperçu ?** « Le navigateur pourrait consommer trop de mémoire. Le fichier est toujours listé et peut être exporté si les autres contrôles l’autorisent. »
- **Les tests du rendu passent ?** « L’application ne les exécute pas. Elle montre où les lire. Ses propres tests ont été exécutés. »
- **Plusieurs agents ont travaillé ?** « La première version a été conduite en solo. Pour cette révision, j’ai autorisé des agents sur des tâches ciblées. Je distingue cette participation des rôles OpenCode configurés et d’un audit indépendant. »
- **Pourquoi cette architecture ?** « Pour être utile dès une URL, garder les rendus confidentiels et éviter une exécution dangereuse côté serveur. »

## Avant de partir

Tester l’URL publique depuis une fenêtre privée. Garder un serveur local et les deux ZIP de la démonstration en secours. Vérifier captures/ et preuves/. Ne pas annoncer un déploiement ou une CI distante non réalisés. Préparer les liens du dépôt et de la démo. La version précédente est conservée sur la branche `backup/avant-checklist` et dans le ZIP de secours remis à l’auteur ; éviter toute modification supplémentaire pendant l’oral.
