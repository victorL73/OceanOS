# Stockcean

Module OceanOS pour gerer les stocks, achats et fournisseurs.

## Acces

```text
http://localhost/Stockcean/
```

Stockcean utilise la session OceanOS. La configuration PrestaShop se fait dans :

```text
OceanOS > menu utilisateur > PrestaShop
```

## Fonctions incluses

- synchronisation des produits PrestaShop avec prix de vente et prix d'achat `wholesale_price`
- lecture des quantites depuis `stock_availables`
- import des fournisseurs PrestaShop si le Webservice y donne acces
- seuils d'alerte par produit
- envoi des alertes de stock dans les notifications OceanOS
- catalogue fournisseur groupe par fournisseur
- affectation ou creation de fournisseurs internes
- commandes fournisseurs internes multi-produits avec quantites et prix d'achat HT par ligne
- reception fournisseur avec increment du stock PrestaShop
- historique detaille des commandes fournisseurs
- journal des synchronisations

## Droits PrestaShop conseilles

Dans le Webservice PrestaShop, activer au minimum la lecture sur :

```text
products
stock_availables
suppliers
product_suppliers
```

Pour envoyer les receptions fournisseur vers PrestaShop, activer aussi l'ecriture sur `stock_availables`.
Le module continue a synchroniser les produits et stocks si `suppliers` ou `product_suppliers` n'est pas disponible, mais les prix d'achat fournisseur resteront vides sans `product_suppliers`.

## Tables

Les tables creees dans la base OceanOS sont :

```text
stockcean_products
stockcean_suppliers
stockcean_purchase_orders
stockcean_purchase_order_lines
stockcean_sync_runs
```

Les alertes visibles dans toute la suite passent par la table centrale `oceanos_notifications`.

## Limite

Stockcean lit les stocks depuis PrestaShop et pousse les quantites receptionnees vers `stock_availables`. Les commandes fournisseurs restent gerees en interne.
