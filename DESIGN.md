# Archive X-Ray — cahier des charges et architecture

## Problème

Un enseignant reçoit des projets ZIP. Avant de les extraire, il doit retrouver les instructions, comprendre le contenu, repérer des erreurs de partage et identifier les éléments à examiner. Les étudiants ont le même besoin avant de rendre un projet. Un développeur ou un destinataire de site web peut aussi vérifier qu’un ZIP contient les éléments attendus, sans dépendre des exigences du cours.

## Parcours

Déposer un ZIP → inventaire → explorer et rechercher → examiner les constats → consulter une checklist → comparer un second rendu → exporter un rapport ou une sélection contrôlée.

## Critères d’acceptation

- Utilisable dans un navigateur, sans compte, clé de modèle ou installation pour le lecteur.
- Aucun code provenant de l’archive n’est exécuté ; aucune archive importée n’est transmise au serveur.
- Chaque constat a une règle, un emplacement et une explication. Le moteur n’attribue ni note ni certification.
- Tous les contenus non lus sont annoncés ; les fichiers présents ne sont pas assimilés à des preuves d’exécution.
- Une archive malformée produit une erreur lisible, sans bloquer les importations suivantes.
- Checklist générique, profil site web et règles personnalisées : nom de fichier, extension ou dossier contenant des fichiers ; profils du cours facultatifs.
- Règles personnalisées bornées à 20, libellés de 80 caractères et cibles de 160 caractères ; aucune expression régulière ni code utilisateur exécuté.
- Rapport Markdown, annotations en mémoire, diff des versions, export avec CRC et conservation de l’original.
- Une image sans aperçu reste inventoriée ; un refus d’aperçu pour dimensions inconnues ou excessives est une information de limite, pas un verdict de danger.
- Tests automatisés bloquants, builds stricts, documentation de lancement et captures issues de vrais parcours.

## Architecture

Navigateur React/TypeScript → Worker dédié → parseur ZIP central/local → métadonnées → lecture DEFLATE/STORE bornée → CRC → règles → résultat structuré.

Le thread d’interface conserve l’état de la session. Le Worker effectue lecture et export et peut être terminé par annulation ou timeout. Les aperçus échappent les contenus ; le SVG est du texte. La persistance dans localStorage se limite au profil et aux règles personnalisées de checklist. Les règles sont validées à leur chargement ; les archives, contenus et annotations restent en mémoire. Le serveur Node distribue dist/, les ZIP fictifs et /health. Il n’a aucun endpoint d’upload et refuse les méthodes autres que GET/HEAD.

Le MCP de développement expose deux outils en lecture seule via stdio. Il lit seulement le contrat et explique cinq contrôles ; il ne reçoit pas de rendu importé. Il est indépendant de l’application publique.

## Choix techniques

React et TypeScript strict pour l’interface ; Vite pour le build et le Worker ; fflate pour DEFLATE et la reconstruction ; parsing structurel et limites contrôlés par notre moteur ; Vitest et Playwright pour la validation. Déploiement Docker sur Railway, aucun volume ou base de données nécessaire.

## Décisions et compromis

- Analyse locale : un professeur peut lire des rendus confidentiels sans les téléverser.
- Checklist de présence configurable : elle aide à retrouver les éléments attendus d’un site ou d’un autre projet. Le lecteur reste responsable de vérifier leur contenu et leur qualité.
- Aperçus d’image bornés : les limites de 4 millions de pixels et 8192 pixels par côté restent en place ; une erreur de décodage doit laisser une explication lisible dans l’explorateur.
- Pas de modèle embarqué : résultats reproductibles, pas de coût de tokens ni clé nécessaire pour utiliser l’application. L’IA intervient dans la conception assistée et son harness.
- Pas d’exécution du projet inspecté : élimine une catégorie de risque, mais ne peut prouver que ses tests passent.
- Diff texte par bloc modifié entre préfixe/suffixe communs, pas un diff optimal de type Myers.
- Première version menée en solo à la demande de l’auteur. Pour cette révision, l’auteur a autorisé des agents sur des tâches délimitées : diagnostic de stabilité, évolution de la checklist et documentation. Cette participation ne constitue pas un audit indépendant et ne prouve pas une session multi-agent OpenCode.

## Hors périmètre

Antivirus, bac à sable d’exécution, analyse récursive, déchiffrement, ZIP64, correction automatique de secrets, notation automatique, sauvegarde cloud des rendus. Ces fonctions changeraient les risques et le coût de la solution.
