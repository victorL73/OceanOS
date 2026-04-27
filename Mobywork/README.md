# Mobywork

Module local adapte pour OceanOS.

## Acces

- Interface WAMP : `http://localhost/Mobywork/`
- Backend API : `http://localhost:3002/api`
- Frontend dev Vite : `http://localhost:5173/Mobywork/`

Le backend Node doit etre lance pour que l'application puisse se connecter aux APIs.

## Base de donnees

Par defaut, Mobywork utilise la base MySQL centrale :

```text
OceanOS
```

Les tables propres a Mobywork sont prefixees :

```text
mobywork_users
mobywork_user_settings
mobywork_emails
mobywork_crm_activities
mobywork_expenses
mobywork_quotes
mobywork_marketing_*
mobywork_prospects
```

Les comptes utilisateurs restent centralises dans :

```text
oceanos_users
```

## Lancement

Double-cliquer sur :

```text
Lancer_Serveurs.bat
```

Le lanceur demarre :

- le backend Node sur le port `3002`
- le frontend Vite sur le port `5173`

## Ponts internes

Les ponts entre Node et PHP sont :

```text
api\shared-auth.php
api\sql.php
```

Ils sont proteges par un secret local genere dans :

```text
backend\.mobywork_bridge_secret
```

## Configuration optionnelle

La configuration PrestaShop commune est lue depuis OceanOS quand elle existe :

```text
OceanOS > menu utilisateur > PrestaShop
```

Les variables `.env` `PRESTASHOP_API_URL` et `PRESTASHOP_API_KEY` restent seulement un fallback local.

Dans `backend\.env`, il est possible de surcharger :

```text
MOBYWORK_AUTH_DRIVER=oceanos
MOBYWORK_DB_DRIVER=oceanos
MOBYWORK_DB_HOST=127.0.0.1
MOBYWORK_DB_PORT=3306
MOBYWORK_DB_NAME=OceanOS
MOBYWORK_DB_USER=root
MOBYWORK_DB_PASS=
MOBYWORK_SHARED_AUTH_URL=http://127.0.0.1/Mobywork/api/shared-auth.php
MOBYWORK_SQL_URL=http://127.0.0.1/Mobywork/api/sql.php
```

Pour revenir au SQLite historique du module importe :

```text
MOBYWORK_DB_DRIVER=sqlite
MOBYWORK_AUTH_DRIVER=local
```
