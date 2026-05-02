# NautiCRM

Module OceanOS pour gerer les clients, prospects, contacts, relances, taches et opportunites.

## Acces

```text
http://localhost/NautiCRM/
```

NautiCRM utilise la session OceanOS et les droits de modules visibles.

## Fonctions incluses

- portefeuille clients et prospects
- fiche client avec coordonnees, statut, priorite, segment et source
- contacts multiples avec contact principal
- journal d'interactions : notes, appels, emails, rendez-vous, devis, commandes et support
- relances client avec date de prochaine action
- taches assignees aux utilisateurs OceanOS
- opportunites commerciales avec etape, montant HT, probabilite et date de cloture
- synchronisation des clients PrestaShop depuis la configuration OceanOS
- rapprochement par identifiant PrestaShop puis par email pour eviter les doublons
- ajout par IA depuis texte libre ou CSV, avec recherche web publique, enrichissement et previsualisation avant import
- archivage des clients sans suppression physique

## Tables

Les tables creees dans la base OceanOS sont :

```text
nauticrm_clients
nauticrm_contacts
nauticrm_interactions
nauticrm_tasks
nauticrm_opportunities
nauticrm_sync_runs
```

Le module ne modifie pas Mobywork.

## Droits PrestaShop conseilles

Dans le Webservice PrestaShop, activer au minimum la lecture sur :

```text
customers
addresses
orders
countries
```

Si `addresses`, `countries` ou `orders` ne sont pas autorises, NautiCRM importe quand meme les clients disponibles et affiche un avertissement dans le resume de synchronisation.
