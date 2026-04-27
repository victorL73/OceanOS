# Flowcean

Application web locale inspiree d'AppFlowy, prevue pour tourner directement dans `C:\wamp64\www\appflowy-codex`.

## Ouverture

Ouvrir dans le navigateur :

- `http://localhost/appflowy-codex/`

## Acces

- si aucun compte n'existe, le premier ecran permet de creer le premier administrateur
- ensuite, toute personne non connectee tombe sur l'ecran de connexion avant l'application
- un administrateur peut creer de nouveaux comptes `member` ou `admin`
- chaque utilisateur recoit automatiquement un workspace personnel avec un template de base
- chaque utilisateur peut creer plusieurs workspaces supplementaires
- un proprietaire ou admin de workspace peut inviter un utilisateur par email dans son espace

## Ce qui est inclus

- Pages imbriquees
- Favoris, recents et corbeille
- Editeur par blocs
- Commandes slash
- Creation via `+ Nouveau` avec choix entre `Page`, `Tableau` ou `Modele`
- Tableaux avec vues liees `Table`, `Cartes`, `Calendrier` et `Gantt`
- Templates de demarrage
- Recherche globale
- Import / export JSON
- Theme clair / sombre
- Stockage durable MySQL via `api/workspace.php`
- Cache local navigateur pour reprise hors ligne
- Workspaces personnels separes par compte
- Plusieurs workspaces par utilisateur
- Invitations et partage de workspace via `api/workspaces.php`
- Presence live pour voir qui est ou dans un workspace
- Synchronisation quasi instantanee via `api/realtime.php` et `api/presence.php`

## Limites

Cette version reproduit les fonctions coeur en local, avec un backend PHP/MySQL, mais ce n'est pas encore une copie 1:1 de l'application officielle AppFlowy :

- collaboration live "best effort", mais pas encore de moteur CRDT/OT pour les editions simultanees sur le meme contenu
- pas de stack Flutter/Rust d'origine
- pas d'IA distante

## Fichiers

- `index.html`
- `assets/style.css`
- `assets/app.js`
- `api/config.php`
- `api/bootstrap.php`
- `api/workspace.php`
- `api/workspaces.php`
- `api/presence.php`
- `api/realtime.php`
- `api/schema.sql`
