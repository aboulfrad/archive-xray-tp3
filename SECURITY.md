# Modèle de menace et limites

Aucun code importé n’est exécuté. Un ZIP peut cependant exploiter le parseur, épuiser des ressources, afficher un nom trompeur ou faire fuiter des secrets par les exports.

| Menace                                              | Contrôle                                                                                                                              | Limite restante                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ZIP Slip, chemins absolus, NTFS, segments ambigus   | Lecture/export refusés, aucune extraction sur disque                                                                                  | Pas une garantie pour un autre logiciel d’extraction                                          |
| Métadonnées locales/centrales contradictoires       | Structure, noms, tailles, CRC déclarés et zones vérifiés                                                                              | Sous-ensemble volontaire du format ZIP                                                        |
| Bombes de décompression                             | 64 Mio ZIP, 2500 entrées, 256 Mio annoncés, ratio 200:1, lecture 1 Mio/fichier et 12 Mio/session, contrôle taille réelle, Worker 20 s | Le navigateur effectue encore des allocations ; pas une isolation équivalente à une VM        |
| Arbres et aperçus pathologiques                     | Noms 4096 octets, profondeur 64, aperçu 2000 lignes                                                                                   | L’appareil et la longueur des lignes influencent le temps de rendu                            |
| Images à dimensions excessives                      | En-tête PNG/JPEG/GIF/WebP contrôlé avant aperçu, 4 millions de pixels et 8192 pixels par côté maximum                                 | Pas un décodeur complet ; animations et erreurs internes restent traitées par le navigateur   |
| Liens symboliques, encryption, compression inconnue | Contenu non lu, export refusé                                                                                                         | Métadonnées visibles, aucune inspection complète                                              |
| XSS, SVG actif, Markdown externe                    | Échappement React, SVG texte, pas de liens/images Markdown chargés, CSP                                                               | Le décodage d’images repose sur le navigateur                                                 |
| Secrets                                             | Règles ciblées, masquage par défaut, rapport/diff masqués, exclusion initiale de l’export                                             | Heuristiques ; masquer n’est pas supprimer. Un utilisateur peut conserver un fichier à secret |
| Faux vert du harness                                | Scripts suspects signalés, tests/lint/types/build bloquants, Git hook                                                                 | Présence d’une CI ou d’un hook ne prouve pas son déclenchement                                |
| Fuite serveur                                       | Serveur GET/HEAD uniquement ; contrôle réseau dans les tests navigateur                                                               | L’hébergeur connaît les requêtes HTTP ordinaires et l’adresse du visiteur                     |

Le CRC32 contrôle des corruptions accidentelles, pas l’authenticité. La comparaison des contenus non lus utilise taille/CRC ; aucune identité cryptographique n’est revendiquée.

La lecture UTF-8 de contenus texte est stricte. Autres encodages, archives imbriquées, dépendances et fichiers hors budget restent explicitement non analysés. L’inspection n’est ni un antivirus ni une certification de sécurité.

Le rapport contient les chemins et les annotations. Le masquage ne reconnaît pas tous les secrets : relire avant partage. Le ZIP exporté conserve les octets originaux des fichiers choisis, jusqu’à 32 Mio au total.

Le MCP ne lit que DESIGN.md, SECURITY.md, TESTPLAN.md et le skill d’inspection. Il n’a ni outil d’écriture, ni commande shell, ni chemin libre. Les permissions OpenCode et son plugin limitent les accès, mais ne constituent pas à eux seuls une isolation OS.

Références des en-têtes WebP : [conteneur RIFF](https://developers.google.com/speed/webp/docs/riff_container), [flux sans perte](https://developers.google.com/speed/webp/docs/webp_lossless_bitstream_specification), [VP8 RFC 6386](https://www.rfc-editor.org/rfc/rfc6386).
