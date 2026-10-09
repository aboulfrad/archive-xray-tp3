# Démonstration orale — deux ZIP, 4 à 5 minutes

Démo : https://archive-xray-production.up.railway.app

Préparer seulement deux archives : votre **TP1-rendu.zip**, conservé sur votre ordinateur, et **Demo-XRay-cas-de-figure.zip**, archive synthétique de démonstration remise avec le projet. Le même contenu est accessible depuis la tuile **Les cas de figure** (`cas-de-figure.zip`). Le TP1 personnel ne fait pas partie des fichiers publiés sur GitHub ou Railway ; son import est analysé dans le navigateur.

## 1. Un vrai besoin avec votre TP1 — environ 2 minutes

« Quand je reçois un ZIP, je veux comprendre son contenu avant de l’extraire : où commencer, quels fichiers regarder et quelles limites l’outil a rencontrées. »

1. Importer **TP1-rendu.zip**. Montrer l’inventaire, le volume annoncé et les contenus réellement lus. Distinguer nombre de fichiers et nombre de contenus inspectés.
2. Ouvrir l’explorateur : lire le README puis un fichier source, sans lancer le projet. Montrer la recherche et ajouter une courte annotation.
3. Choisir la checklist **Ma checklist**. Ajouter une attente correspondant au TP1, par exemple `README.md`, puis une extension utilisée par le projet ou un dossier contenant des fichiers. Montrer les correspondances. Ajouter une attente absente pour montrer la différence.
4. Dire : « Ces attentes sont les miennes. L’outil vérifie leur présence ; il ne note pas le rendu et n’exécute pas ses tests. Les profils du cours sont facultatifs. »

## 2. Les cas à examiner — environ 2 minutes

Ouvrir la démonstration **Les cas de figure**, ou importer **Demo-XRay-cas-de-figure.zip**. Ses contenus sont fabriqués pour la démo ; elle ne contient ni logiciel malveillant actif ni identifiant réel.

1. **Chemins et collisions :** montrer un chemin qui remonte hors du dossier, une collision de noms ou un conflit fichier/dossier. Expliquer que les contrôles de lecture et d’export évitent d’accepter ces chemins silencieusement.
2. **Secret fictif :** montrer la valeur masquée et son emplacement. Dire : « Ce sont des règles ciblées, avec des faux positifs et des limites ; ce n’est pas une garantie de trouver tous les secrets. »
3. **Fichiers non lus :** montrer un fichier trop volumineux ou une expansion disproportionnée, puis une archive imbriquée. Dire : « L’outil indique ce qu’il n’a pas analysé. Il ne décompresse pas récursivement et conserve des budgets de ressources. »
4. **Image sans aperçu :** montrer une image aux dimensions excessives ou inconnues. Dire : « C’est une limite mémoire de l’aperçu, pas une déclaration de danger. Le fichier reste dans l’inventaire. »
5. Télécharger le rapport, puis montrer la sélection d’export. Expliquer que l’original reste inchangé ; les fichiers conservés dans le nouveau ZIP gardent leurs octets. Le masquage d’écran ne nettoie pas le contenu d’un fichier exporté.

Selon le temps, ouvrir aussi un nom Unicode ambigu, un faux exécutable ou un fichier dont le CRC est incorrect. Les constats correspondent à des contrôles précis ; ils ne signifient pas que l’outil détecte tous les logiciels malveillants.

## 3. Conclusion et preuves — environ 30 secondes

« L’utilité est de préparer une lecture et un partage de ZIP : retrouver les fichiers, comprendre les points à examiner et produire un rapport. Les données restent dans le navigateur ; aucun code importé n’est exécuté. »

Montrer le dépôt et les résultats de validation disponibles dans `preuves/`. Annoncer uniquement les vérifications effectivement réalisées, en distinguant les tests de l’application des tests trouvés dans les archives.

## Limites à expliquer si le professeur questionne

- L’archive de cas montre plusieurs constats dans un ZIP que le moteur peut ouvrir. Les cas qui entraînent le refus de toute l’archive, comme ZIP64 ou une structure tronquée, ne peuvent pas tous être réunis dans ce même fichier utilisable ; ils sont vérifiés avec des fichiers de test séparés.
- La checklist contrôle une présence, pas la qualité, la conformité complète ou la réussite des tests du projet.
- Les alertes sont une aide à l’examen, pas une analyse antivirus ni une certification de sécurité.
- En cas de réseau indisponible, utiliser la version locale préparée. La version stable précédente reste conservée pour le retour arrière.
