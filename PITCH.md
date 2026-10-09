# Démonstration pour l’oral

Démo : https://archive-xray-production.up.railway.app

Dépôt : https://github.com/aboulfrad/archive-xray-tp3

## Pitch, 30 secondes

« Vous recevez des projets dans des ZIP. Avant de les extraire, il faut retrouver le README, comprendre la structure et repérer les fichiers qu’on ne devrait pas partager. Archive X-Ray donne un espace de lecture dans le navigateur : explorer, rechercher, examiner des signaux, comparer deux rendus et exporter un rapport. Le ZIP reste sur votre appareil. Les constats sont expliqués et l’outil distingue présence de fichiers et preuve d’exécution. »

## Démo directe, 4 minutes

1. Accueil : ouvrir **Un projet complet**. Montrer inventaire, volumes et contenus réellement lus.
2. Checklist : choisir **TP3**. Cliquer le README, puis les tests. Dire : « trouvés, pas exécutés ».
3. Explorateur : rechercher `celsiusToFahrenheit`, lire le code, ajouter une annotation « Vérifier NaN et Infinity ».
4. Comparaison : charger la deuxième démonstration. Montrer fichier ajouté, supprimé et fonction corrigée.
5. Retour à l’accueil (recharger la page), ouvrir **Une archive à examiner**. Montrer le chemin `../`, le secret fictif masqué, la fausse image et l’archive imbriquée non analysée.
6. Rapport & export : télécharger le rapport et la sélection. Expliquer : l’original reste inchangé ; les fichiers conservés gardent leur contenu.
7. Ouvrir preuves/ : tests, couverture, MCP, blocage d’une vraie erreur TypeScript. Montrer le harness, ses permissions et la différence entre configuré et effectivement vérifié.

## Réponses courtes aux objections

- **C’est un antivirus ?** « Non : c’est une inspection statique ciblée. Aucun code exécuté, aucun verdict absolu. »
- **Où est l’IA ?** « Dans la conception et le développement assistés, avec un contrat, des contrôles et un MCP. Le résultat fonctionne sans compte de modèle. »
- **Un secret peut passer ?** « Oui, ce sont des heuristiques. Le masquage et l’exclusion initiale sont des aides, pas une garantie. »
- **Puis-je tester mon ZIP ?** « Oui, jusqu’à 64 Mio, en ZIP classique. Les limites et les contenus non lus sont affichés. »
- **Les tests du rendu passent ?** « L’application ne les exécute pas. Elle montre où les lire. Ses propres tests ont été exécutés. »
- **Plusieurs agents ont travaillé ?** « Cette réalisation a été conduite en solo. Les rôles de reprise sont définis, sans inventer de collaboration. »
- **Pourquoi cette architecture ?** « Pour être utile dès une URL, garder les rendus confidentiels et éviter une exécution dangereuse côté serveur. »

## Avant de partir

Tester l’URL publique depuis une fenêtre privée. Garder un serveur local et les quatre ZIP fictifs en secours. Vérifier captures/ et preuves/. Ne pas annoncer un déploiement ou une CI distante non réalisés. Préparer les liens du dépôt et de la démo.
