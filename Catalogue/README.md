# Catalogue

Module Catalogue OceanOS.

- Frontoffice public : produits visibles sans connexion, prix masques.
- Connexion client : prix visibles, panier et generation de commande.
- Commande : creation directe d'un devis dans `devis_quotes` et PDF dans `Devis/storage/quotes/`.
- Backoffice OceanOS admin/super : synchronisation PrestaShop, SKU unique, creation de produits, descriptions et photos.
- Les produits PrestaShop modifies localement sont verrouilles pour que la prochaine recuperation ne remplace pas les enrichissements Catalogue.

Les photos locales sont stockees dans :

```text
Catalogue/storage/products/
```
