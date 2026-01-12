# Facturation Atelier — v1.4.5 (STABLE)

Objectif : PWA **stable** (pas de page blanche) sur GitHub Pages, utilisable iPhone/Android.

## Mise en ligne (GitHub Pages)
1. Remplace les fichiers du dépôt par le contenu de ce ZIP (à la racine).
2. `Settings > Pages` :
   - Source: **Deploy from a branch**
   - Branch: **principal**
   - Folder: **/(root)**
3. URL : `https://<username>.github.io/<repo>/`

## Important (si page blanche après mise à jour)
- iPhone : supprimer l’icône, puis ré-ouvrir l’URL et “Ajouter à l’écran d’accueil”.
- Desktop : `Ctrl/Cmd + Shift + R` (refresh forcé).

## OCR
OCR est **optionnel** et ne bloque pas l’app.
Il utilise Tesseract.js via CDN (donc **Internet requis**) et se lance uniquement quand tu cliques sur “OCR”.

## Règles
- Pièces BL : montant **HT après remise** + 10%
- TVA : 20%
- MO : 60 €/h
- 100 points : 0,50 h
- Freins AV (disques + plaquettes) : 2,00 h
- Triangle suspension : 1,00 h / occurrence (si détecté dans le texte A5)

