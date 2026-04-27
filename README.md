# OceanOS CRM

OceanOS est le portail principal du dossier `www`. Il centralise la connexion, les comptes, les droits utilisateurs et la configuration IA commune aux applications.

## Structure du dossier `www`

```text
www/
  admin/                 Page de configuration initiale serveur
  OceanOS/               Portail CRM, session centrale, comptes, IA Groq
  Flowcean/              Workspace, notes, espaces et collaboration
  Invocean/              Facturation, exports et synchronisation PrestaShop
  Stockcean/             Stocks, achats, fournisseurs et synchronisation PrestaShop
  Mobywork/              CRM e-commerce, commandes, emails et finance
  NautiPost/             Campagnes, messages et outils marketing
  NautiCloud/            Drive partage, apercus et edition temps reel
  Formcean/              Formulaires publics, collecte de reponses et exports
  _backups/              Sauvegardes SQL locales
  index.php              Redirection vers OceanOS
  Lancer_Serveurs.bat    Lanceur local des serveurs applicatifs
```

## Principe général

OceanOS est la passerelle d'entrée du CRM.

- La connexion utilisateur se fait sur `/OceanOS/`.
- Les applications utilisent la session OceanOS pour vérifier l'accès.
- Les pages applicatives affichent un bouton de retour vers OceanOS.
- La gestion des comptes et des droits se fait dans OceanOS.
- La clé IA Groq est configurée dans le menu utilisateur OceanOS et partagée avec les applications qui en ont besoin.

Les applications concernées actuellement sont :

- Flowcean
- Invocean
- Stockcean
- Mobywork
- NautiPost
- NautiCloud
- Formcean

## Page de configuration serveur

La page de configuration initiale se trouve ici :

```text
/admin/
```

Elle sert à préparer une installation sur un serveur.

Fonctions disponibles :

- connexion à la page admin avec un accès séparé de la session OceanOS
- configuration de la connexion MySQL
- test de la connexion MySQL
- création ou mise à jour de la base OceanOS
- création de comptes `super-utilisateur`
- modification du mot de passe de la page admin
- affichage des tables détectées
- affichage des super-utilisateurs existants

Les identifiants initiaux de cette page sont :

```text
Identifiant : OceanOS
Mot de passe : OceanPass
```

Le mot de passe est stocké sous forme de hash dans :

```text
admin/storage/admin_credentials.php
```

Après la première connexion à `/admin/`, il faut modifier ce mot de passe dans le bloc `Acces configuration`.

Le dossier suivant est protégé par un `.htaccess` :

```text
admin/storage/
```

Sur un serveur Apache, il ne doit pas être accessible publiquement. Si le serveur n'utilise pas Apache ou ignore les `.htaccess`, il faut ajouter une règle de blocage équivalente côté serveur.

## Configuration de la base de données

La connexion MySQL commune est enregistrée dans :

```text
OceanOS/config/server.php
```

Ce fichier contient :

- hôte MySQL
- port MySQL
- nom de base
- utilisateur MySQL
- mot de passe MySQL

Flowcean, Invocean, Stockcean et Mobywork lisent aussi cette configuration partagee.

Sur une installation serveur :

1. Copier le contenu du dossier `www` sur le serveur.
2. Ouvrir `/admin/`.
3. Se connecter à la page admin.
4. Renseigner la connexion MySQL.
5. Cliquer sur `Tester`.
6. Cliquer sur `Creer / mettre a jour la BDD`.
7. Créer au moins un compte `super-utilisateur`.
8. Modifier le mot de passe de la page admin.
9. Aller sur `/OceanOS/` pour utiliser le portail.

Important : le fichier `OceanOS/config/server.php` contient les identifiants MySQL du serveur. En production, il doit rester lisible par PHP mais ne doit pas être exposé publiquement.

## Base principale

La base principale s'appelle :

```text
OceanOS
```

Sur Windows avec MySQL/WAMP, phpMyAdmin peut l'afficher en minuscules :

```text
oceanos
```

C'est normal si MySQL utilise `lower_case_table_names=1`. La configuration PHP peut garder `OceanOS`.

## Tables principales

Tables OceanOS :

```text
oceanos_users
oceanos_user_ai_settings
oceanos_prestashop_settings
nautipost_history
```

Tables Flowcean :

```text
flowcean_workspaces
flowcean_workspace_members
flowcean_workspace_invitations
flowcean_workspace_events
flowcean_workspace_presence
flowcean_workspace_user_preferences
flowcean_user_notifications
```

Tables Invocean :

```text
invocean_invoices
invocean_settings
invocean_sync_runs
```

Tables Mobywork, si l'application les initialise dans MySQL :

```text
mobywork_*
```

Tables Stockcean :

```text
stockcean_products
stockcean_suppliers
stockcean_purchase_orders
stockcean_purchase_order_lines
stockcean_sync_runs
```

Tables Formcean :

```text
formcean_forms
formcean_responses
```

Des tables historiques comme `users` ou `user_ai_settings` peuvent exister après migration. Elles servent à la compatibilité ou à la migration depuis l'ancienne structure. Les comptes utilisés par OceanOS sont dans `oceanos_users`.

NautiCloud stocke les fichiers sur disque dans :

```text
NautiCloud/storage/files/
```

Les metadonnees temps reel locales sont dans :

```text
NautiCloud/storage/meta/
```

## Comptes et droits

Les rôles disponibles sont :

```text
super
admin
member
```

Règles importantes :

- Un `super-utilisateur` peut gérer tous les comptes.
- Un `admin` peut gérer les membres.
- Un `admin` ne peut pas modifier les droits d'un autre admin.
- Un `admin` ne peut pas supprimer un compte admin ou super-utilisateur.
- La suppression ou la désactivation du dernier compte administrateur actif est bloquée.

La gestion quotidienne des comptes se fait depuis le menu utilisateur OceanOS, section `Admin`.

La création initiale d'un super-utilisateur peut aussi se faire depuis `/admin/`.

## Configuration IA Groq

La clé IA Groq est configurée dans OceanOS :

```text
OceanOS > menu utilisateur > IA Groq
```

Elle est partagée avec les modules qui en ont besoin, notamment :

- Flowcean
- Mobywork
- NautiPost

La clé n'est pas stockée en clair dans l'interface. Elle est chiffrée côté serveur avant stockage.

## Configuration PrestaShop

La configuration PrestaShop commune est configuree dans OceanOS :

```text
OceanOS > menu utilisateur > PrestaShop
```

Elle contient l'URL de la boutique, la cle Webservice et la fenetre de synchronisation par defaut.

Elle est partagee par :

- Invocean
- Stockcean
- Mobywork

La cle Webservice n'est pas stockee en clair dans l'interface. Elle est chiffree cote serveur avant stockage.

## NautiPost

NautiPost se trouve au même niveau que les autres applications :

```text
www/NautiPost/
```

Il utilise OceanOS pour :

- vérifier la session
- récupérer la configuration IA
- appeler le proxy Groq OceanOS
- enregistrer l'historique si la table `nautipost_history` est disponible

## NautiCloud

NautiCloud se trouve au meme niveau que les autres applications :

```text
www/NautiCloud/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- lister, importer, renommer, copier, deplacer et supprimer des fichiers
- afficher les images, PDF, fichiers audio/video et documents telechargeables
- modifier les fichiers texte/code avec autosauvegarde
- diffuser les changements et presences via Server-Sent Events

Le dossier `NautiCloud/storage/` contient un `.htaccess` qui bloque l'acces direct sous Apache. Sur un serveur qui ignore les `.htaccess`, ajouter une regle equivalente cote serveur.

## Formcean

Formcean se trouve au meme niveau que les autres applications :

```text
www/Formcean/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- creer et publier des formulaires
- partager des liens publics sans compte OceanOS
- collecter les reponses dans MySQL
- exporter les reponses au format CSV

## Lanceur local

Le lanceur local est à la racine :

```text
www/Lancer_Serveurs.bat
```

Il est placé à la racine pour pouvoir lancer plusieurs applications à l'avenir, pas seulement Mobywork.

Sur un serveur de production, ce fichier n'est généralement pas utilisé. Le lancement doit plutôt être géré par le service web, un service Node, un gestionnaire de processus ou la configuration d'hébergement.

## Sauvegardes

Les sauvegardes SQL locales sont placées dans :

```text
www/_backups/
```

Avant les migrations importantes, créer un dump MySQL. Exemple avec WAMP local :

```powershell
C:\wamp64\bin\mysql\mysql8.4.7\bin\mysqldump.exe -uroot --single-transaction --default-character-set=utf8mb4 OceanOS > C:\wamp64\www\_backups\OceanOS_backup.sql
```

Sur serveur, adapter le chemin de `mysqldump`, l'utilisateur MySQL et le mot de passe.

## Déploiement serveur

Pré-requis conseillés :

- PHP 8.2 ou plus récent
- MySQL ou MariaDB
- Apache ou Nginx
- ecriture autorisee pour PHP sur `NautiCloud/storage/`
- extensions PHP : `pdo_mysql`, `mbstring`, `curl`, `openssl`
- écriture autorisée pour PHP sur `OceanOS/config/` et `admin/storage/`

Checklist de déploiement :

1. Copier tous les dossiers applicatifs dans le répertoire web.
2. Vérifier que `/admin/` est accessible uniquement aux administrateurs techniques.
3. Configurer MySQL depuis `/admin/`.
4. Créer ou mettre à jour la base.
5. Créer un super-utilisateur.
6. Modifier immédiatement le mot de passe de la page admin.
7. Tester `/OceanOS/`.
8. Tester l'ouverture de Flowcean, Invocean, Stockcean, Mobywork, NautiPost, NautiCloud et Formcean depuis OceanOS.
9. Configurer la clé Groq dans OceanOS si les modules IA sont utilisés.
10. Configurer PrestaShop dans OceanOS si les modules e-commerce sont utilises.
11. Faire une sauvegarde SQL apres validation.

## Sécurité

Points à vérifier avant production :

- Ne pas exposer `admin/storage/`.
- Ne pas exposer `NautiCloud/storage/`.
- Ne pas exposer `OceanOS/config/server.php`.
- Changer le mot de passe initial de `/admin/`.
- Utiliser un utilisateur MySQL dédié avec les droits nécessaires.
- Activer HTTPS.
- Restreindre l'accès à `/admin/` par IP ou authentification serveur si possible.
- Sauvegarder régulièrement la base OceanOS.

## URLs utiles en local

```text
http://localhost/admin/
http://localhost/OceanOS/
http://localhost/Flowcean/
http://localhost/Invocean/
http://localhost/Stockcean/
http://localhost/Mobywork/
http://localhost/NautiPost/
http://localhost/NautiCloud/
http://localhost/Formcean/
```
