# Invocean

Application locale pour recuperer et suivre les factures PrestaShop avec la session et la configuration partagees OceanOS.

## Accès

Ouvrir dans le navigateur :

- `http://localhost/Invocean/`

## Comptes utilisateurs

Invocean utilise la base MySQL centrale configuree par OceanOS.

- un utilisateur deja connecte a OceanOS est reconnu dans Invocean
- les identifiants de connexion sont ceux d'OceanOS
- les administrateurs OceanOS peuvent configurer PrestaShop et lancer les synchronisations
- les autres comptes peuvent consulter le registre et mettre à jour les statuts des factures

## Configuration PrestaShop

Dans PrestaShop, activer le Webservice puis créer une clé avec accès en lecture sur :

- `order_invoices`
- `orders`
- `customers`
- `addresses`
- `currencies`

Dans OceanOS, menu utilisateur `PrestaShop`, renseigner :

- l'URL de la boutique, par exemple `https://boutique.example.com` ou `https://boutique.example.com/api`
- la cle Webservice
- la fenetre de synchronisation par defaut

Dans Invocean, renseigner si besoin :

- eventuellement un modele de lien PDF, seulement si vous voulez conserver une URL de reference
- les informations legales du vendeur pour generer les sauvegardes Factur-X

Le modèle de lien PDF peut utiliser :

- `{order_id}`
- `{invoice_id}`
- `{invoice_number}`
- `{order_reference}`

Exemple :

```text
https://boutique.example.com/adminXXXX/index.php?controller=AdminPdf&submitAction=generateInvoicePDF&id_order={order_id}&token=VOTRE_TOKEN
```

Le Webservice natif PrestaShop ne fournit pas directement le fichier PDF binaire des factures. Invocean recrée donc les PDFs localement à partir des données récupérées par l'API : facture, commande, client, adresse, devise, lignes de commande, frais de port, remises et totaux.

## Stockage

Les tables ajoutees dans la base `OceanOS` sont :

- `invocean_settings`
- `invocean_invoices`
- `invocean_sync_runs`

La clé Webservice est chiffrée avec `INVOCEAN_SECRET`, `FLOWCEAN_AI_SECRET` ou un secret local généré dans `api/.invocean_secret`.

## Sauvegardes Factur-X

Invocean génère un fichier PDF Factur-X profil `EN16931` pour chaque facture synchronisée. Le PDF visible est recréé depuis les données PrestaShop, puis la bibliothèque `atgp/factur-x` embarque le fichier structuré `factur-x.xml` et valide le XML avec le XSD Factur-X.

- les fichiers unitaires sont sauvegardés dans `storage/facturx`
- le bouton `Factur-X` de chaque ligne télécharge le PDF hybride de la facture
- le bouton `Exporter Factur-X PDF` crée et télécharge une archive ZIP contenant tous les PDFs Factur-X de la sélection courante
- l'archive ZIP reste aussi dans `storage/facturx`

Le XML CII reste stocké en base dans `xml_payload`. Pour l'envoi réglementaire, faites quand même contrôler les fichiers par votre plateforme agréée ou votre validateur Factur-X/PDF-A.

## Sauvegardes PDF

Invocean recrée les PDFs depuis les données PrestaShop synchronisées et les sauvegarde dans `storage/pdf`.

- le lien `Récupérer PDF` régénère, sauvegarde et télécharge le PDF d'une facture
- le bouton `Exporter PDF` crée une archive ZIP des PDFs de la sélection courante
- si la génération échoue, le `manifest.json` du ZIP liste les factures concernées

## Certificats SSL

Sous Wamp, PHP/cURL peut ne pas trouver les certificats racines et afficher :

```text
SSL certificate problem: unable to get local issuer certificate
```

Invocean cherche automatiquement un `cacert.pem` installé avec phpMyAdmin. Si besoin, vous pouvez forcer le chemin avec :

```text
INVOCEAN_CA_BUNDLE=C:\chemin\vers\cacert.pem
```

## Limite importante

Invocean prépare le registre interne et récupère les données PrestaShop. L'envoi réglementaire des factures électroniques doit ensuite passer par une plateforme agréée ou un connecteur dédié.
