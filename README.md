# Facturation Atelier (Facturation Atelier (V1.4.2 OCR gratuit)

## Objectif
Saisir un dossier véhicule (immat/km/marque/modèle/mécano), archiver les documents (100 points, fiche A5, BL),
puis **générer automatiquement une facture** (lignes MO + pièces saisies manuellement) et un **PDF via impression**.

## Utilisation (iPhone / Android)
1. Ouvrir l’URL GitHub Pages du dépôt.
2. (Optionnel) Partager → “Ajouter à l’écran d’accueil”.
3. Créer un dossier, prendre les photos.
4. Sur l’écran **Récap**, cliquer **Générer facture**.

## PDF
Le bouton **Générer PDF** ouvre une page “Facture” imprimable.
Sur iPhone: Partager / Imprimer → “Enregistrer en PDF”.

## Paramètres
- Client: MIKADAN (fixe)
- Taux MO: 60,00 € HT/h (modifiable dans l’écran facture)
- Pièces: Prix achat HT (après remise) + 10% (calcul auto)
- IBAN/BIC: FR76 1627 5000 1108 0005 2907 889 / CEPAFRPP627

## Déploiement GitHub Pages
Settings → Pages → Branch: main → /(root)


## OCR gratuit (Tesseract.js)
- Nécessite Internet (chargement du moteur + langue).
- Sur iPhone, l’OCR peut prendre 10–60s selon la photo.
- Toujours vérifier/corriger les résultats.
