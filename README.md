# Clément Design Logistics

Site statique GitHub Pages + Supabase.

## Installation
1. Renseigner `config.js` avec l'URL Supabase et la clé publique (`anon` / `publishable`).
2. **Exécuter `supabase-setup.sql` une fois** dans Supabase (SQL Editor). Il crée les tables et les droits d'accès.
3. Publier tout le dossier sur GitHub Pages.
4. Ne jamais mettre une `service_role` / `secret` key dans ce dépôt.

## Flux
Étiquettes → Réception → Contrôle → Colisage → PDF → FIN

Le site ne contient volontairement aucun module Stock, Préparation ou Expédition.

## Ce que fait chaque page
| Page | Rôle | Enregistré dans |
|---|---|---|
| Étiquettes (`label-generator.html`) | Génère le fichier TXT pour Zebra Designer (format inchangé) | `labels`, `activity_logs` |
| Réception | Scan carton par carton, EAN vérifiés, fermeture du carton | `receptions`, `activity_logs` |
| Contrôle | Vérifie chaque code scanné dans le catalogue | `activity_logs` |
| Colisage | Regroupe les scans, signale les EAN inconnus, imprime le PDF | `colisages`, `activity_logs` |
| Fabrication spéciale | Crée une référence `FSP-<OF>-<n°>` reconnue ensuite au scan | `fabrications`, `activity_logs` |
| Historique | Journal filtrable, export CSV | lit `activity_logs` |
| Dashboard | Indicateurs et activité récente | lit toutes les tables |

## Structure
```
index.html              tableau de bord
label-generator.html    générateur d'étiquettes
config.js               URL + clé publique Supabase
supabase-setup.sql      tables et droits (à exécuter une fois)
css/style.css
js/catalog.js           catalogue : 1 ligne = 1 référence (modèle, couleur, taille, manche, EAN)
js/supabase.js          connexion + file d'attente hors ligne
js/app.js               outils communs (menu, recherche EAN, son…)
js/<page>.js            un fichier par page
pages/                  réception, contrôle, colisage, fabrication, historique
```

## Mettre à jour le catalogue
Éditer `js/catalog.js` : ajouter une ligne `["MODELE","COULEUR","TAILLE","Longues / Long","EAN13"],`.
Il sert au générateur d'étiquettes **et** à la vérification des EAN (réception, contrôle, colisage).

## Si Supabase ne répond pas
Rien n'est perdu : les enregistrements restent sur l'appareil et repartent tout seuls dès que la
connexion fonctionne. Le bandeau en haut de chaque page indique l'état et la marche à suivre.
