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
    php-xml \
    php-zip \
    php-gd \
    php-intl

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

  if [[ -f "$APP_ROOT/Mobywork/frontend/package-lock.json" ]]; then
    (cd "$APP_ROOT/Mobywork/frontend" && npm ci)
  elif [[ -f "$APP_ROOT/Mobywork/frontend/package.json" ]]; then
    (cd "$APP_ROOT/Mobywork/frontend" && npm install)
  fi
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
MOBYWORK_DB_DRIVER=oceanos
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

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
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
    web) echo "${OCEANOS_WEB_SERVICE:-apache2}" ;;
    database) db_service ;;
    mobywork) echo "${OCEANOS_MOBYWORK_SERVICE:-mobywork-backend}" ;;
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

case "$ACTION" in
  status|start|stop|restart) ;;
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
    "$APP_ROOT/Mobywork/backend/uploads"
  )

  local path
  for path in "${paths[@]}"; do
    mkdir -p "$path"
    chown -R "$PHP_USER:$PHP_GROUP" "$path"
    chmod -R u+rwX,g+rwX,o-rwx "$path"
  done

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
  deps) need_root; install_packages; install_php_dependencies; install_node_dependencies ;;
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
