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

- synchronisation des produits PrestaShop
- lecture des quantites depuis `stock_availables`
- import des fournisseurs PrestaShop si le Webservice y donne acces
- seuils d'alerte par produit
- envoi des alertes de stock dans les notifications OceanOS
- catalogue fournisseur groupe par fournisseur
- affectation ou creation de fournisseurs internes
- commandes fournisseurs internes multi-produits avec quantites et prix HT par ligne
- historique detaille des commandes fournisseurs
- journal des synchronisations

## Droits PrestaShop conseilles

Dans le Webservice PrestaShop, activer au minimum la lecture sur :

```text
products
stock_availables
suppliers
```

Le module continue a synchroniser les produits et stocks si `suppliers` n'est pas disponible.

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

Stockcean lit les stocks depuis PrestaShop et gere les achats en interne. Il ne pousse pas encore les receptions ou les commandes fournisseurs vers PrestaShop.
