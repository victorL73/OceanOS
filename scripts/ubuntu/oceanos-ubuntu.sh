#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="OceanOS"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

WEB_SERVICE="${WEB_SERVICE:-apache2}"
MOBYWORK_SERVICE="${MOBYWORK_SERVICE:-mobywork-backend}"
PHP_USER="${PHP_USER:-www-data}"
PHP_GROUP="${PHP_GROUP:-www-data}"
DOMAIN="${DOMAIN:-_}"
MOBYWORK_PORT="${MOBYWORK_PORT:-3002}"
MOBYWORK_API_URL="${MOBYWORK_API_URL:-/api}"

ENV_DIR="/etc/oceanos"
MOBYWORK_ENV_FILE="$ENV_DIR/mobywork-backend.env"
SYSTEMD_FILE="/etc/systemd/system/${MOBYWORK_SERVICE}.service"
APACHE_SITE_FILE="/etc/apache2/sites-available/oceanos.conf"
CONTROL_BIN="/usr/local/sbin/oceanos-service-control"
SUDOERS_FILE="/etc/sudoers.d/oceanos-service-control"
NAUTIMAIL_CRON_FILE="/etc/cron.d/oceanos-nautimail"
NAUTIMAIL_LOG_FILE="/var/log/oceanos-nautimail-sync.log"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Cette commande doit etre lancee avec sudo."
  fi
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

node_major() {
  if ! have_command node; then
    echo 0
    return
  fi
  node -v | sed -E 's/^v([0-9]+).*/\1/'
}

random_secret() {
  if have_command openssl; then
    openssl rand -hex 32
    return
  fi
  date +%s%N | sha256sum | awk '{print $1}'
}

set_env_value() {
  local file="$1" key="$2" value="$3" escaped_value
  escaped_value="${value//&/\\&}"
  if [[ -f "$file" ]] && grep -qE "^${key}=" "$file"; then
    sed -i -E "s|^${key}=.*|${key}=${escaped_value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

database_service() {
  if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'mariadb.service'; then
    echo "mariadb"
    return
  fi
  if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'mysql.service'; then
    echo "mysql"
    return
  fi
  echo "mariadb"
}

install_packages() {
  need_root
  log "Installation des paquets systeme si necessaire..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    apache2 \
    mariadb-server \
    ca-certificates \
    cron \
    curl \
    sudo \
    unzip \
    git \
    build-essential \
    composer \
    libapache2-mod-php \
    php \
    php-cli \
    php-common \
    php-curl \
    php-mbstring \
    php-mysql \
    php-imap \
    php-xml \
    php-zip \
    php-gd \
    php-intl

  if have_command phpenmod; then
    phpenmod imap >/dev/null 2>&1 || true
  fi

  if [[ "$(node_major)" -lt 18 ]]; then
    log "Node.js 18+ est requis. Installation de Node.js 22 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  fi
}

install_php_dependencies() {
  log "Installation des dependances Composer..."
  if [[ -f "$APP_ROOT/Invocean/composer.json" ]]; then
    (cd "$APP_ROOT/Invocean" && composer install --no-dev --optimize-autoloader)
  fi
}

install_node_dependencies() {
  log "Installation des dependances Node..."
  if [[ -f "$APP_ROOT/Mobywork/backend/package-lock.json" ]]; then
    (cd "$APP_ROOT/Mobywork/backend" && npm ci --omit=dev)
  elif [[ -f "$APP_ROOT/Mobywork/backend/package.json" ]]; then
    (cd "$APP_ROOT/Mobywork/backend" && npm install --omit=dev)
  fi

  if [[ -f "$APP_ROOT/Mobywork/backend/package.json" ]]; then
    if ! (cd "$APP_ROOT/Mobywork/backend" && node -e "require.resolve('node-cron')" >/dev/null); then
      log "Dependances backend incompletes, reinstall propre de node_modules..."
      rm -rf "$APP_ROOT/Mobywork/backend/node_modules"
      if [[ -f "$APP_ROOT/Mobywork/backend/package-lock.json" ]]; then
        (cd "$APP_ROOT/Mobywork/backend" && npm ci --omit=dev)
      else
        (cd "$APP_ROOT/Mobywork/backend" && npm install --omit=dev)
      fi
      (cd "$APP_ROOT/Mobywork/backend" && node -e "require.resolve('node-cron')" >/dev/null)
    fi
  fi

  if [[ -f "$APP_ROOT/Mobywork/frontend/package-lock.json" ]]; then
    (cd "$APP_ROOT/Mobywork/frontend" && npm ci)
  elif [[ -f "$APP_ROOT/Mobywork/frontend/package.json" ]]; then
    (cd "$APP_ROOT/Mobywork/frontend" && npm install)
  fi
}

install_nautimail_cron() {
  need_root
  log "Installation du releve automatique NautiMail..."
  if [[ ! -f "$APP_ROOT/NautiMail/cli/sync.php" ]]; then
    log "NautiMail CLI introuvable, cron non installe."
    return
  fi

  touch "$NAUTIMAIL_LOG_FILE"
  chown "$PHP_USER:$PHP_GROUP" "$NAUTIMAIL_LOG_FILE"
  chmod 0640 "$NAUTIMAIL_LOG_FILE"

  cat > "$NAUTIMAIL_CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

*/5 * * * * $PHP_USER cd "$APP_ROOT" && /usr/bin/flock -n /tmp/oceanos-nautimail-sync.lock /usr/bin/php NautiMail/cli/sync.php --limit=50 --json >> "$NAUTIMAIL_LOG_FILE" 2>&1
EOF
  chmod 0644 "$NAUTIMAIL_CRON_FILE"
  systemctl enable --now cron >/dev/null 2>&1 || systemctl enable --now crond >/dev/null 2>&1 || true
}

build_mobywork_frontend() {
  if [[ ! -f "$APP_ROOT/Mobywork/frontend/package.json" ]]; then
    return
  fi

  log "Build du frontend Mobywork..."
  (cd "$APP_ROOT/Mobywork/frontend" && VITE_API_URL="$MOBYWORK_API_URL" npm run build)

  if [[ -d "$APP_ROOT/Mobywork/frontend/dist" ]]; then
    rm -rf "$APP_ROOT/Mobywork/assets" "$APP_ROOT/Mobywork/index.html"
    cp -a "$APP_ROOT/Mobywork/frontend/dist/." "$APP_ROOT/Mobywork/"
  fi
}

ensure_mobywork_env() {
  need_root
  install -d -m 0750 -o root -g "$PHP_GROUP" "$ENV_DIR"
  if [[ ! -f "$MOBYWORK_ENV_FILE" ]]; then
    log "Creation du fichier d'environnement $MOBYWORK_ENV_FILE"
    local jwt_secret bridge_token
    jwt_secret="$(random_secret)"
    bridge_token="$(random_secret)"
    cat > "$MOBYWORK_ENV_FILE" <<EOF
NODE_ENV=production
PORT=$MOBYWORK_PORT
FRONTEND_URL=http://localhost
JWT_SECRET=$jwt_secret
MOBYWORK_AUTH_DRIVER=oceanos
MOBYWORK_DB_DRIVER=sqlite
MOBYWORK_SQLITE_PATH=$APP_ROOT/Mobywork/storage/emails.db
TRUST_PROXY=1
MOBYWORK_UPLOAD_MAX_BYTES=10485760
MOBYWORK_DB_HOST=127.0.0.1
MOBYWORK_DB_PORT=3306
MOBYWORK_DB_NAME=OceanOS
MOBYWORK_DB_USER=oceanos_app
MOBYWORK_DB_PASS=CHANGE_ME
MOBYWORK_SHARED_AUTH_URL=http://127.0.0.1/Mobywork/api/shared-auth.php
MOBYWORK_SQL_URL=http://127.0.0.1/Mobywork/api/sql.php
MOBYWORK_BRIDGE_TOKEN=$bridge_token
EOF
    chmod 0640 "$MOBYWORK_ENV_FILE"
    chown root:"$PHP_GROUP" "$MOBYWORK_ENV_FILE"
    log "A modifier avant production: $MOBYWORK_ENV_FILE"
  fi
  set_env_value "$MOBYWORK_ENV_FILE" "MOBYWORK_DB_DRIVER" "sqlite"
  set_env_value "$MOBYWORK_ENV_FILE" "MOBYWORK_SQLITE_PATH" "$APP_ROOT/Mobywork/storage/emails.db"
  set_env_value "$MOBYWORK_ENV_FILE" "TRUST_PROXY" "1"
  set_env_value "$MOBYWORK_ENV_FILE" "MOBYWORK_UPLOAD_MAX_BYTES" "10485760"
  chmod 0640 "$MOBYWORK_ENV_FILE"
  chown root:"$PHP_GROUP" "$MOBYWORK_ENV_FILE"
}

install_mobywork_service() {
  need_root
  ensure_mobywork_env
  log "Installation du service systemd $MOBYWORK_SERVICE..."
  cat > "$SYSTEMD_FILE" <<EOF
[Unit]
Description=Mobywork backend API
After=network.target $(database_service).service

[Service]
Type=simple
User=$PHP_USER
Group=$PHP_GROUP
WorkingDirectory=$APP_ROOT/Mobywork/backend
EnvironmentFile=$MOBYWORK_ENV_FILE
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$MOBYWORK_SERVICE"
}

install_apache_site() {
  need_root
  log "Installation de la configuration Apache OceanOS..."
  a2enmod rewrite headers proxy proxy_http >/dev/null
  cat > "$APACHE_SITE_FILE" <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    DocumentRoot $APP_ROOT

    <Directory $APP_ROOT>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ProxyPreserveHost On
    ProxyPass /api-public/ http://127.0.0.1:$MOBYWORK_PORT/api-public/
    ProxyPassReverse /api-public/ http://127.0.0.1:$MOBYWORK_PORT/api-public/
    ProxyPass /api/ http://127.0.0.1:$MOBYWORK_PORT/api/
    ProxyPassReverse /api/ http://127.0.0.1:$MOBYWORK_PORT/api/

    ErrorLog \${APACHE_LOG_DIR}/oceanos_error.log
    CustomLog \${APACHE_LOG_DIR}/oceanos_access.log combined
</VirtualHost>
EOF
  a2ensite oceanos.conf >/dev/null
  apache2ctl configtest
}

install_service_control_wrapper() {
  need_root
  log "Installation du wrapper de controle limite pour OceanOS..."
  cat > "$CONTROL_BIN" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-status}"
TARGET="${2:-all}"
APP_ROOT="${OCEANOS_APP_ROOT:-/var/www/oceanos}"
PHP_USER="${OCEANOS_PHP_USER:-www-data}"
PHP_GROUP="${OCEANOS_PHP_GROUP:-www-data}"
WEB_SERVICE="${OCEANOS_WEB_SERVICE:-apache2}"
MOBYWORK_SERVICE="${OCEANOS_MOBYWORK_SERVICE:-mobywork-backend}"

json_escape() {
  printf '%s' "$1" | sed -e ':a' -e 'N' -e '$!ba' -e 's/\\/\\\\/g; s/"/\\"/g; s/\r/\\r/g; s/\n/\\n/g'
}

db_service() {
  if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'mariadb.service'; then
    echo "mariadb"
    return
  fi
  if systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -qx 'mysql.service'; then
    echo "mysql"
    return
  fi
  echo "mariadb"
}

unit_for() {
  case "$1" in
    web) echo "$WEB_SERVICE" ;;
    database) db_service ;;
    mobywork) echo "$MOBYWORK_SERVICE" ;;
    *) return 1 ;;
  esac
}

label_for() {
  case "$1" in
    web) echo "Serveur web" ;;
    database) echo "Base de donnees" ;;
    mobywork) echo "Mobywork API" ;;
    *) echo "$1" ;;
  esac
}

description_for() {
  case "$1" in
    web) echo "Apache sert OceanOS et les modules PHP." ;;
    database) echo "MariaDB/MySQL stocke les comptes et donnees applicatives." ;;
    mobywork) echo "API Node utilisee par Mobywork." ;;
    *) echo "" ;;
  esac
}

status_one() {
  local id="$1"
  local unit active enabled sub load label description
  unit="$(unit_for "$id")" || return 1
  active="$(systemctl is-active "$unit" 2>/dev/null || true)"
  enabled="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
  sub="$(systemctl show "$unit" --property=SubState --value 2>/dev/null || true)"
  load="$(systemctl show "$unit" --property=LoadState --value 2>/dev/null || true)"
  label="$(label_for "$id")"
  description="$(description_for "$id")"

  printf '{"id":"%s","label":"%s","description":"%s","unit":"%s","active":"%s","enabled":"%s","subState":"%s","loadState":"%s"}' \
    "$(json_escape "$id")" \
    "$(json_escape "$label")" \
    "$(json_escape "$description")" \
    "$(json_escape "$unit")" \
    "$(json_escape "$active")" \
    "$(json_escape "$enabled")" \
    "$(json_escape "$sub")" \
    "$(json_escape "$load")"
}

status_all() {
  printf '{"ok":true,"services":['
  local first=1 id
  for id in web database mobywork; do
    if [[ "$first" -eq 0 ]]; then printf ','; fi
    first=0
    status_one "$id"
  done
  printf ']}'
}

run_action() {
  local action="$1"
  local target="$2"
  local unit
  unit="$(unit_for "$target")" || {
    printf '{"ok":false,"message":"Service inconnu."}'
    exit 2
  }

  systemctl "$action" "$unit"
  printf '{"ok":true,"service":'
  status_one "$target"
  printf '}'
}

fix_permissions() {
  local paths=(
    "$APP_ROOT/admin/storage"
    "$APP_ROOT/OceanOS/config"
    "$APP_ROOT/NautiCloud/storage"
    "$APP_ROOT/Nautisign/storage"
    "$APP_ROOT/Invocean/storage"
    "$APP_ROOT/Mobywork/storage"
    "$APP_ROOT/Mobywork/backend/attachments"
    "$APP_ROOT/Mobywork/backend/uploads"
  )

  local path
  for path in "${paths[@]}"; do
    mkdir -p "$path"
    chown -R "$PHP_USER:$PHP_GROUP" "$path"
    chmod -R u+rwX,g+rwX,o-rwx "$path"
  done

  if [[ -f "$APP_ROOT/Mobywork/backend/emails.db" && ! -f "$APP_ROOT/Mobywork/storage/emails.db" ]]; then
    cp -a "$APP_ROOT/Mobywork/backend/emails.db" "$APP_ROOT/Mobywork/storage/emails.db"
  fi
  if [[ -f "$APP_ROOT/Mobywork/storage/emails.db" ]]; then
    chown "$PHP_USER:$PHP_GROUP" "$APP_ROOT/Mobywork/storage/emails.db"
    chmod 0660 "$APP_ROOT/Mobywork/storage/emails.db"
  fi

  local oceanos_config_dir="$APP_ROOT/OceanOS/config"
  local local_config="$oceanos_config_dir/server.local.php"
  local default_config="$oceanos_config_dir/server.php"
  if [[ ! -f "$local_config" && -f "$default_config" ]]; then
    cp -a "$default_config" "$local_config"
  fi
  if [[ -f "$local_config" ]]; then
    chown "$PHP_USER:$PHP_GROUP" "$local_config"
    chmod 0660 "$local_config"
  fi
  if [[ -f "$default_config" ]]; then
    chown "$PHP_USER:$PHP_GROUP" "$default_config"
    chmod 0660 "$default_config"
  fi
}

preserve_server_config_before_pull() {
  local local_config="$APP_ROOT/OceanOS/config/server.local.php"
  local default_config="$APP_ROOT/OceanOS/config/server.php"

  if [[ ! -f "$local_config" && -f "$default_config" ]]; then
    cp -a "$default_config" "$local_config"
  fi

  if git -C "$APP_ROOT" ls-files --error-unmatch OceanOS/config/server.php >/dev/null 2>&1; then
    if ! git -C "$APP_ROOT" diff --quiet -- OceanOS/config/server.php; then
      git -C "$APP_ROOT" checkout -- OceanOS/config/server.php
    fi
  fi
}

run_update() {
  if [[ ! -d "$APP_ROOT/.git" ]]; then
    printf '{"ok":false,"message":"Depot Git introuvable dans %s."}' "$(json_escape "$APP_ROOT")"
    exit 2
  fi

  local before after output status deps_output deps_status permissions_output permissions_status service_output service_status control_output control_status restart_output restart_status
  before="$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  preserve_server_config_before_pull
  set +e
  output="$(git -C "$APP_ROOT" pull --ff-only 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour Git refusee. Corrigez les changements locaux puis relancez.","before":"%s","output":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")"
    exit "$status"
  fi

  set +e
  deps_output="$(bash "$APP_ROOT/scripts/ubuntu/oceanos-ubuntu.sh" deps 2>&1)"
  deps_status=$?
  set -e
  if [[ "$deps_status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour Git terminee, mais les dependances serveur ont echoue.","before":"%s","output":"%s","depsOutput":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")" \
      "$(json_escape "$deps_output")"
    exit "$deps_status"
  fi

  set +e
  permissions_output="$(bash "$APP_ROOT/scripts/ubuntu/oceanos-ubuntu.sh" permissions 2>&1)"
  permissions_status=$?
  set -e
  if [[ "$permissions_status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour Git terminee, mais les permissions ont echoue.","before":"%s","output":"%s","depsOutput":"%s","permissionsOutput":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")" \
      "$(json_escape "$deps_output")" \
      "$(json_escape "$permissions_output")"
    exit "$permissions_status"
  fi

  set +e
  service_output="$(bash "$APP_ROOT/scripts/ubuntu/oceanos-ubuntu.sh" service 2>&1)"
  service_status=$?
  set -e
  if [[ "$service_status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour Git terminee, mais le service Mobywork n a pas pu etre reinstalle.","before":"%s","output":"%s","depsOutput":"%s","permissionsOutput":"%s","serviceOutput":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")" \
      "$(json_escape "$deps_output")" \
      "$(json_escape "$permissions_output")" \
      "$(json_escape "$service_output")"
    exit "$service_status"
  fi

  set +e
  control_output="$(bash "$APP_ROOT/scripts/ubuntu/oceanos-ubuntu.sh" control 2>&1)"
  control_status=$?
  set -e
  if [[ "$control_status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour Git terminee, mais le controleur n a pas pu etre reinstalle.","before":"%s","output":"%s","depsOutput":"%s","permissionsOutput":"%s","serviceOutput":"%s","controlOutput":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")" \
      "$(json_escape "$deps_output")" \
      "$(json_escape "$permissions_output")" \
      "$(json_escape "$service_output")" \
      "$(json_escape "$control_output")"
    exit "$control_status"
  fi

  set +e
  restart_output="$(
    systemctl daemon-reload || true
    systemctl restart "$MOBYWORK_SERVICE" || exit $?
    systemctl reload "$WEB_SERVICE" || systemctl restart "$WEB_SERVICE" || exit $?
  ) 2>&1"
  restart_status=$?
  set -e
  if [[ "$restart_status" -ne 0 ]]; then
    printf '{"ok":false,"message":"Mise a jour terminee, mais le redemarrage des services a echoue.","before":"%s","output":"%s","depsOutput":"%s","permissionsOutput":"%s","serviceOutput":"%s","controlOutput":"%s","restartOutput":"%s"}' \
      "$(json_escape "$before")" \
      "$(json_escape "$output")" \
      "$(json_escape "$deps_output")" \
      "$(json_escape "$permissions_output")" \
      "$(json_escape "$service_output")" \
      "$(json_escape "$control_output")" \
      "$(json_escape "$restart_output")"
    exit "$restart_status"
  fi

  after="$(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  printf '{"ok":true,"message":"Mise a jour terminee.","before":"%s","after":"%s","output":"%s","depsOutput":"%s","permissionsOutput":"%s","serviceOutput":"%s","controlOutput":"%s","restartOutput":"%s","services":' \
    "$(json_escape "$before")" \
    "$(json_escape "$after")" \
    "$(json_escape "$output")" \
    "$(json_escape "$deps_output")" \
    "$(json_escape "$permissions_output")" \
    "$(json_escape "$service_output")" \
    "$(json_escape "$control_output")" \
    "$(json_escape "$restart_output")"
  status_all | sed 's/^{"ok":true,"services"://; s/}$//'
  printf '}'
}

case "$ACTION" in
  status|start|stop|restart|update) ;;
  *)
    printf '{"ok":false,"message":"Action non autorisee."}'
    exit 2
    ;;
esac

case "$TARGET" in
  all|web|database|mobywork) ;;
  *)
    printf '{"ok":false,"message":"Service non autorise."}'
    exit 2
    ;;
esac

if [[ "$ACTION" == "status" ]]; then
  if [[ "$TARGET" == "all" ]]; then
    status_all
  else
    printf '{"ok":true,"service":'
    status_one "$TARGET"
    printf '}'
  fi
  exit 0
fi

if [[ "$ACTION" == "update" ]]; then
  run_update
  exit 0
fi

if [[ "$TARGET" == "all" ]]; then
  printf '{"ok":false,"message":"Les actions groupees sont desactivees depuis le wrapper web."}'
  exit 2
fi

run_action "$ACTION" "$TARGET"
EOF

  chown root:"$PHP_GROUP" "$CONTROL_BIN"
  chmod 0750 "$CONTROL_BIN"

  cat > "$SUDOERS_FILE" <<EOF
$PHP_USER ALL=(root) NOPASSWD: $CONTROL_BIN
EOF
  chmod 0440 "$SUDOERS_FILE"
  visudo -cf "$SUDOERS_FILE" >/dev/null
}

ensure_permissions() {
  need_root
  log "Ajustement des permissions des dossiers ecriture..."
  local paths=(
    "$APP_ROOT/admin/storage"
    "$APP_ROOT/OceanOS/config"
    "$APP_ROOT/NautiCloud/storage"
    "$APP_ROOT/Nautisign/storage"
    "$APP_ROOT/Invocean/storage"
    "$APP_ROOT/Mobywork/storage"
    "$APP_ROOT/Mobywork/backend/attachments"
    "$APP_ROOT/Mobywork/backend/uploads"
  )

  local path
  for path in "${paths[@]}"; do
    mkdir -p "$path"
    chown -R "$PHP_USER:$PHP_GROUP" "$path"
    chmod -R u+rwX,g+rwX,o-rwx "$path"
  done

  if [[ -f "$APP_ROOT/Mobywork/backend/emails.db" && ! -f "$APP_ROOT/Mobywork/storage/emails.db" ]]; then
    cp -a "$APP_ROOT/Mobywork/backend/emails.db" "$APP_ROOT/Mobywork/storage/emails.db"
  fi
  if [[ -f "$APP_ROOT/Mobywork/storage/emails.db" ]]; then
    chown "$PHP_USER:$PHP_GROUP" "$APP_ROOT/Mobywork/storage/emails.db"
    chmod 0660 "$APP_ROOT/Mobywork/storage/emails.db"
  fi

  local oceanos_config_dir="$APP_ROOT/OceanOS/config"
  local local_config="$oceanos_config_dir/server.local.php"
  local default_config="$oceanos_config_dir/server.php"
  if [[ ! -f "$local_config" && -f "$default_config" ]]; then
    cp -a "$default_config" "$local_config"
  fi
  if [[ -f "$local_config" ]]; then
    chown "$PHP_USER:$PHP_GROUP" "$local_config"
    chmod 0660 "$local_config"
  fi
}

install_all() {
  need_root
  install_packages
  install_php_dependencies
  install_node_dependencies
  install_nautimail_cron
  build_mobywork_frontend
  ensure_permissions
  install_mobywork_service
  install_apache_site
  install_service_control_wrapper
  start_services
  log "Installation terminee. Pensez a configurer MySQL dans /admin/ et les secrets dans $MOBYWORK_ENV_FILE."
}

start_services() {
  need_root
  log "Demarrage des services..."
  systemctl start "$(database_service)"
  systemctl restart "$WEB_SERVICE"
  systemctl restart "$MOBYWORK_SERVICE"
}

stop_services() {
  need_root
  log "Arret des services applicatifs..."
  systemctl stop "$MOBYWORK_SERVICE" || true
  systemctl stop "$WEB_SERVICE" || true
}

restart_services() {
  need_root
  log "Redemarrage des services..."
  systemctl restart "$(database_service)"
  systemctl restart "$WEB_SERVICE"
  systemctl restart "$MOBYWORK_SERVICE"
}

show_status() {
  if [[ -x "$CONTROL_BIN" ]]; then
    "$CONTROL_BIN" status all
    printf '\n'
    return
  fi

  systemctl --no-pager --full status "$WEB_SERVICE" "$(database_service)" "$MOBYWORK_SERVICE" || true
}

show_help() {
  cat <<EOF
Usage:
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh install
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh start
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh stop
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh restart
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh node-deps
  sudo ./scripts/ubuntu/oceanos-ubuntu.sh nautimail-cron
  ./scripts/ubuntu/oceanos-ubuntu.sh status

Variables utiles:
  APP_ROOT=/var/www/oceanos
  DOMAIN=crm.example.com
  MOBYWORK_PORT=3002
  MOBYWORK_API_URL=/api
EOF
}

case "${1:-help}" in
  install) install_all ;;
  deps) need_root; install_packages; install_php_dependencies; install_node_dependencies; install_nautimail_cron ;;
  node-deps) install_node_dependencies ;;
  nautimail-cron) need_root; install_nautimail_cron ;;
  build) build_mobywork_frontend ;;
  service) need_root; install_mobywork_service ;;
  apache) need_root; install_apache_site ;;
  control) need_root; install_service_control_wrapper ;;
  permissions) need_root; ensure_permissions ;;
  start) start_services ;;
  stop) stop_services ;;
  restart) restart_services ;;
  status) show_status ;;
  help|-h|--help) show_help ;;
  *) show_help; exit 2 ;;
esac
