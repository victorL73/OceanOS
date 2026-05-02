# OceanOS CRM

OceanOS est le portail principal du dossier `www`. Il centralise la connexion, les comptes, les droits utilisateurs, les informations entreprise et les configurations communes aux applications.

## Structure du dossier `www`

```text
www/
  admin/                 Page de configuration initiale serveur
  OceanOS/               Portail CRM, session centrale, comptes, IA Groq
  Agenda/                Agenda personnel, taches consolidees et reunions MeetOcean
  Flowcean/              Workspace, notes, espaces et collaboration
  Invocean/              Facturation, exports et synchronisation PrestaShop
  Devis/                 Devis PDF Renovboat depuis les produits PrestaShop
  Commandes/             Visualisation et traitement des commandes PrestaShop
  SAV/                   Demandes clients PrestaShop et reponses support
  Stockcean/             Stocks, achats, fournisseurs et synchronisation PrestaShop
  Tresorcean/            Finance, tresorerie, benefices et TVA
  Mobywork/              CRM e-commerce, commandes, emails et finance
  NautiCRM/              CRM clients, contacts, relances et opportunites
  NautiMail/             Boites mail partagees, releve IMAP, tri IA et reponses SMTP
  NautiPost/             Campagnes, messages et outils marketing
  NautiCloud/            Drive partage, apercus et edition temps reel
  Formcean/              Formulaires publics, collecte de reponses et exports
  Naviplan/              Agenda administratif, fiscal, social et juridique
  SeoCean/               Google Analytics, Search Console, audit SEO et recommandations
  MeetOcean/             Visioconference, transcription et traduction temps reel
  Backup/                ZIP du dossier www, export SQL et planification cron
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
- Les informations entreprise sont configurées dans le menu utilisateur OceanOS et partagées avec les modules, notamment Mobywork, Invocean et Devis.

Les applications concernées actuellement sont :

- Agenda
- Flowcean
- Invocean
- Devis
- Commandes
- SAV
- Stockcean
- Tresorcean
- Mobywork
- NautiCRM
- NautiMail
- NautiPost
- NautiCloud
- Formcean
- Naviplan
- SeoCean
- MeetOcean
- Backup

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

Flowcean, Invocean, Devis, Commandes, SAV et Stockcean lisent aussi cette configuration partagee.
Mobywork utilise OceanOS pour la connexion et les informations entreprise, mais garde ses parametres metier, mails, tris, dossiers et devis en SQLite. En local, le fichier par defaut est `Mobywork/backend/emails.db`. Sur le serveur Ubuntu, le script configure `MOBYWORK_SQLITE_PATH` vers `Mobywork/storage/emails.db` pour garder la base dans un dossier persistant.

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

## Module Backup

Le module Backup se trouve ici :

```text
/Backup/
```

Il est reserve aux comptes `super-utilisateur`.

Il cree une archive ZIP contenant :

- le dossier `www`, hors dossiers de sauvegardes et `.git`
- un export SQL de la base configuree dans `OceanOS/config/server.php`

Pour un export SQL complet, le serveur Ubuntu doit avoir `mysqldump` disponible. Le module utilise alors `--single-transaction`, `--routines`, `--events`, `--triggers` et `--hex-blob`. Si `mysqldump` est absent, un export PDO de secours est tente.

La planification se regle dans `/Backup/`. Le cron Ubuntu doit appeler le runner regulierement, par exemple toutes les 15 minutes :

```text
*/15 * * * * /usr/bin/php /var/www/html/Backup/api/backup.php run-scheduled >/dev/null 2>&1
```

Le module supprime automatiquement les archives de plus de 15 jours. Il garde aussi une limite maximale d'archives, reglable dans l'interface Backup.

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
oceanos_company_settings
nautipost_history
```

Tables Agenda :

```text
agenda_events
agenda_event_attendees
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
invocean_signed_quotes
```

Tables Devis :

```text
devis_quotes
```

Tables Mobywork, si l'application les initialise dans MySQL :

```text
mobywork_*
```

Tables NautiCRM :

```text
nauticrm_clients
nauticrm_contacts
nauticrm_interactions
nauticrm_tasks
nauticrm_opportunities
nauticrm_sync_runs
```

Tables NautiMail :

```text
nautimail_accounts
nautimail_account_users
nautimail_messages
nautimail_replies
```

Tables Stockcean :

```text
stockcean_products
stockcean_suppliers
stockcean_purchase_orders
stockcean_purchase_order_lines
stockcean_sync_runs
```

Tables Tresorcean :

```text
tresorcean_settings
tresorcean_entries
tresorcean_user_preferences
```

Tresorcean consolide les fonds manuels, les commandes PrestaShop, les achats Stockcean et les devis Invocean signes uniquement lorsqu'ils sont passes au statut `converted`.

Tables Formcean :

```text
formcean_forms
formcean_responses
```

Tables Naviplan :

```text
naviplan_settings
```

Tables SeoCean :

```text
visiocean_settings
visiocean_page_audits
```

Tables MeetOcean :

```text
meetocean_rooms
meetocean_participants
meetocean_signals
meetocean_transcripts
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
- NautiMail
- NautiPost
- MeetOcean

La clé n'est pas stockée en clair dans l'interface. Elle est chiffrée côté serveur avant stockage.

## Configuration PrestaShop

La configuration PrestaShop commune est configuree dans OceanOS :

```text
OceanOS > menu utilisateur > PrestaShop
```

Elle contient l'URL de la boutique, la cle Webservice et la fenetre de synchronisation par defaut.

Elle est partagee par :

- Invocean
- Devis
- Stockcean
- Mobywork
- NautiCRM

La cle Webservice n'est pas stockee en clair dans l'interface. Elle est chiffree cote serveur avant stockage.

## Informations entreprise

Les coordonnees entreprise communes sont configurees dans OceanOS :

```text
OceanOS > menu utilisateur > Entreprise
```

Elles sont communes a toutes les sessions utilisateur. Les membres peuvent les consulter, mais seuls les `admin` et `super-utilisateur` peuvent les modifier.

Ces informations alimentent notamment :

- les devis Mobywork
- les devis PDF du module Devis
- les factures et exports Factur-X Invocean

Les conditions de paiement, la validite des devis et la note de pied de page restent dans les parametres Mobywork pour Mobywork. Le module Devis reprend les coordonnees OceanOS et applique ses propres valeurs par defaut pour les PDF.

## Devis

Devis se trouve au meme niveau que les autres applications :

```text
www/Devis/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- recuperer les produits PrestaShop depuis le connecteur commun
- ajouter des frais annexes comme la livraison ou la manutention
- enregistrer les devis dans MySQL
- generer des PDF Renovboat avec le logo de l'entreprise
- servir les PDF uniquement via une API authentifiee

## NautiCRM

NautiCRM se trouve au meme niveau que les autres applications :

```text
www/NautiCRM/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- gerer un portefeuille clients et prospects
- enregistrer contacts, interactions, relances, taches et opportunites
- recuperer les clients PrestaShop via la configuration OceanOS
- archiver les clients sans suppression physique

## NautiMail

NautiMail se trouve au meme niveau que les autres applications :

```text
www/NautiMail/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- enregistrer plusieurs adresses mail avec IMAP/SMTP et mots de passe chiffres
- partager une adresse commune avec plusieurs utilisateurs OceanOS
- relever les mails via IMAP quand l'extension PHP IMAP est activee
- relever automatiquement les adresses actives toutes les 5 minutes via `NautiMail/cli/sync.php` et le cron Ubuntu `oceanos-nautimail`
- pre-trier les mails client, vente, gestion, support et finance
- synthetiser les mails et proposer des actions via la cle Groq configuree dans OceanOS
- generer puis envoyer des reponses via SMTP

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

## Naviplan

Naviplan se trouve au meme niveau que les autres applications :

```text
www/Naviplan/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- afficher l'agenda administratif 2026 de l'entreprise
- configurer la forme juridique, le regime fiscal, la TVA, l'effectif et les options applicables
- choisir les utilisateurs OceanOS qui recoivent les notifications administratives
- filtrer les echeances par fiscalite, TVA, employeur, CFE, juridique, RH et RGPD
- exporter les echeances visibles au format ICS

## SeoCean

SeoCean se trouve au meme niveau que les autres applications :

```text
www/SeoCean/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- centraliser l'URL du site, la propriete GA4 et la propriete Search Console
- stocker le compte de service Google chiffre avec les secrets OceanOS
- generer la balise GA4 a installer sur le site public
- lire Google Analytics Data API et Search Console quand les acces sont autorises
- auditer les pages du site : title, meta description, H1, canonical, alt images, HTTPS et temps de chargement
- proposer un plan d'action SEO et acquisition priorise

## MeetOcean

MeetOcean se trouve au meme niveau que les autres applications :

```text
www/MeetOcean/
```

Il utilise OceanOS pour :

- verifier la session et les droits de module
- creer et rejoindre des salles de visioconference
- diffuser audio/video via WebRTC entre les navigateurs
- synchroniser la presence et les signaux WebRTC via MySQL
- transcrire les paroles en temps reel avec SpeechRecognition cote navigateur
- traduire les transcriptions via la cle Groq configuree dans OceanOS quand les interlocuteurs n'ont pas la meme langue

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
- extensions PHP : `pdo_mysql`, `mbstring`, `curl`, `openssl`, `imap` pour le releve NautiMail
- écriture autorisée pour PHP sur `OceanOS/config/` et `admin/storage/`

Checklist de déploiement :

1. Copier tous les dossiers applicatifs dans le répertoire web.
2. Vérifier que `/admin/` est accessible uniquement aux administrateurs techniques.
3. Configurer MySQL depuis `/admin/`.
4. Créer ou mettre à jour la base.
5. Créer un super-utilisateur.
6. Modifier immédiatement le mot de passe de la page admin.
7. Tester `/OceanOS/`.
8. Tester l'ouverture de Flowcean, Invocean, Devis, Commandes, SAV, Stockcean, Tresorcean, Mobywork, NautiCRM, NautiMail, NautiPost, NautiCloud, Formcean, Naviplan, SeoCean et MeetOcean depuis OceanOS.
9. Configurer la clé Groq dans OceanOS si les modules IA sont utilisés.
10. Configurer PrestaShop dans OceanOS si les modules e-commerce sont utilises.
11. Faire une sauvegarde SQL apres validation.

## Sécurité

Points à vérifier avant production :

- Ne pas exposer `admin/storage/`.
- Ne pas exposer `NautiCloud/storage/`.
- Ne pas exposer `Invocean/storage/`, `Devis/storage/`, `Mobywork/storage/` ni `Mobywork/backend/`.
- Ne pas exposer `OceanOS/config/server.php`.
- Ne jamais versionner les fichiers `.env`, `*.secret`, les bases locales, les logs, les uploads ou les exports generes.
- Regenerer les cles Groq, SMTP/IMAP, PrestaShop et secrets de pont si elles ont deja ete stockees dans le depot.
- Changer le mot de passe initial de `/admin/`.
- Utiliser un utilisateur MySQL dédié avec les droits nécessaires.
- Activer HTTPS.
- Garder les headers de securite actifs dans Apache ou dans le reverse proxy.
- Restreindre l'accès à `/admin/` par IP ou authentification serveur si possible.
- Sauvegarder régulièrement la base OceanOS.

## Lanceur Ubuntu

Un script de preparation serveur est disponible ici :

```bash
scripts/ubuntu/oceanos-ubuntu.sh
```

Sur Ubuntu, depuis la racine du projet :

```bash
chmod +x scripts/ubuntu/oceanos-ubuntu.sh
sudo APP_ROOT=/var/www/oceanos DOMAIN=votre-domaine.fr scripts/ubuntu/oceanos-ubuntu.sh install
```

Il installe les dependances systeme, les dependances Composer/npm, genere le build Mobywork, configure Apache, installe le service systemd `mobywork-backend` et installe un wrapper limite pour piloter les services depuis OceanOS.

Les administrateurs et super-utilisateurs voient ensuite l'onglet `Serveurs` dans le menu utilisateur OceanOS. Cet onglet interroge :

```text
OceanOS/api/services.php
```

Le controle web repose sur :

```text
/usr/local/sbin/oceanos-service-control
/etc/sudoers.d/oceanos-service-control
```

Ces fichiers sont crees par :

```bash
sudo scripts/ubuntu/oceanos-ubuntu.sh control
```

Si le service Mobywork reste en `auto-restart`, verifier les logs puis relancer la preparation Node et les permissions :

```bash
sudo journalctl -u mobywork-backend -n 80 --no-pager
sudo scripts/ubuntu/oceanos-ubuntu.sh node-deps
sudo scripts/ubuntu/oceanos-ubuntu.sh permissions
sudo scripts/ubuntu/oceanos-ubuntu.sh service
sudo systemctl restart mobywork-backend
```

## URLs utiles en local

```text
http://localhost/admin/
http://localhost/OceanOS/
http://localhost/Flowcean/
http://localhost/Invocean/
http://localhost/Devis/
http://localhost/Stockcean/
http://localhost/Mobywork/
http://localhost/NautiCRM/
http://localhost/NautiMail/
http://localhost/NautiPost/
http://localhost/NautiCloud/
http://localhost/Formcean/
http://localhost/Naviplan/
http://localhost/SeoCean/
http://localhost/MeetOcean/
```
