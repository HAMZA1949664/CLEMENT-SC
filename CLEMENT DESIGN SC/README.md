# Clément Design Logistics

Site statique GitHub Pages + Supabase.

## Installation
1. Renseigner `config.js` avec l'URL Supabase et la clé `anon` publique.
2. Publier tout le dossier sur GitHub Pages.
3. Ne jamais mettre une `service_role key` dans ce dépôt.

## Flux
Labels → Réception → Scan/Contrôle → Colisage → PDF → FIN

Le site ne contient volontairement aucun module Stock, Préparation ou Expédition.

## Étiquettes
`label-generator.html` est la version originale fournie et conservée telle quelle pour préserver le flux TXT importé dans Zebra Designer.
