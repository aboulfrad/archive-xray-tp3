---
name: archive-inspection
description: Valider une lecture ou un export ZIP borné, sans exécuter les contenus importés.
---

# Inspection d’archives non fiables

Avant un changement du moteur : identifier l’invariant affecté dans SECURITY.md et le scénario indépendant dans TESTPLAN.md.

- Tester un ZIP créé par une bibliothèque réelle et des en-têtes mutés indépendamment de la fonction examinée.
- Couvrir les tailles réelles, pas uniquement celles annoncées : CRC, décompression excessive, budget et timeout.
- Tester Unicode, collisions, liens et chemins Windows/POSIX. Une entrée refusée ne doit pas redevenir exportable.
- Vérifier qu’un secret détecté n’apparaît ni dans le rapport ni dans le diff masqué. Un export conserve les octets sélectionnés : dire clairement qu’il ne nettoie pas le contenu.
- Les aperçus Markdown/SVG restent inertes, les ressources externes ne sont jamais chargées.
- Utiliser le MCP `archive_contract` pour consulter le contrat et l’explication des contrôles si le client le permet.
- Exécuter la chaîne réelle. Ne pas remplacer un échec par `|| true`, un test ignoré ou une assertion triviale.
- Conserver les limites non résolues et les preuves dans preuves/. Ne pas qualifier l’outil d’antivirus ou de certification.
