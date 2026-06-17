#!/bin/bash
# ============================================================
# iV0 Blog — Cloud Server Deployment Script
# Domain: vilatileno.xyz
# ============================================================
set -euo pipefail

# --- Configuration ------------------------------------------
DOMAIN="vilatileno.xyz"
EMAIL="${EMAIL:-admin@vilatileno.xyz}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONF_DIR="$SCRIPT_DIR/nginx/conf.d"
REAL_CONF="$CONF_DIR/vilatileno.xyz.conf"
HTTP_CONF="$CONF_DIR/vilatileno.xyz.http.conf"
VOLUME_PREFIX="deploy"  # Match docker-compose project name or compose file dir

# --- Colors -------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ============================================================
check_prereqs() {
    info "Checking prerequisites..."

    local missing=()
    for cmd in docker curl; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    for cmd in git; do
        if ! command -v "$cmd" &>/dev/null; then
            warn "git not found — code updates via git won't work"
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        err "Missing required tools: ${missing[*]}"
        err "Install: sudo apt install -y ${missing[*]}"
        exit 1
    fi

    if ! docker compose version &>/dev/null; then
        err "Docker Compose v2 not found. Install it first."
        exit 1
    fi

    info "All prerequisites are met."
}

# ============================================================
setup_env() {
    info "Setting up environment variables..."

    local ENV_FILE="$PROJECT_DIR/ivoblog/blog/.env.production"

    if [ ! -f "$ENV_FILE" ]; then
        err ".env.production not found at $ENV_FILE"
        err "Copy the template and fill in your API keys:"
        err "  cp ivoblog/blog/.env.production ivoblog/blog/.env.production.bak  # if exists"
        err "Then edit ivoblog/blog/.env.production"
        exit 1
    fi

    if grep -q "your_deepseek_api_key_here" "$ENV_FILE"; then
        warn "DEEPSEEK_API_KEY not configured — AI chat will not work."
    fi
    if grep -q "your_netease_cookie_here" "$ENV_FILE"; then
        warn "NETEASE_MUSIC_COOKIE not configured — music player may degrade."
    fi

    info "Environment: $ENV_FILE"
}

# ============================================================
# Step 1: Issue SSL certificate (run ONCE, before first deploy)
init_ssl() {
    info "Issuing SSL certificate for $DOMAIN ..."

    cd "$SCRIPT_DIR"

    # Check if cert already exists in the Docker volume
    if docker compose run --rm certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
        info "SSL certificate already exists for $DOMAIN. Skipping."
        return
    fi

    # Temporarily disable the real HTTPS config (it references certs that don't exist yet)
    if [ -f "$REAL_CONF" ]; then
        info "Temporarily disabling HTTPS config for SSL issuance..."
        mv "$REAL_CONF" "${REAL_CONF}.disabled"
    fi

    # Write HTTP-only config for ACME challenge
    cat > "$HTTP_CONF" << NGINX_HTTP
# Temporary HTTP-only config for SSL certificate issuance
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 "SSL setup in progress — please wait...\n";
    }
}
NGINX_HTTP

    # Create Docker volumes first if they don't exist
    docker compose up -d certbot 2>/dev/null || true
    docker compose stop certbot 2>/dev/null || true

    # Start a standalone nginx for ACME challenge
    info "Starting temporary nginx for ACME challenge..."
    docker run -d --rm --name iv0-nginx-acme \
        -p 80:80 \
        -v "${SCRIPT_DIR}/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
        -v "${SCRIPT_DIR}/nginx/conf.d:/etc/nginx/conf.d:ro" \
        nginx:alpine 2>/dev/null || true

    # Request certificate using webroot
    info "Requesting SSL certificate from Let's Encrypt..."
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"

    # Cleanup
    info "Cleaning up temporary nginx..."
    docker stop iv0-nginx-acme 2>/dev/null || true

    # Restore real config & remove temp
    rm -f "$HTTP_CONF"
    if [ -f "${REAL_CONF}.disabled" ]; then
        mv "${REAL_CONF}.disabled" "$REAL_CONF"
    fi

    info "SSL certificate issued successfully for $DOMAIN!"
}

# ============================================================
# Step 2: Build and deploy
deploy() {
    info "Building blog Docker image..."
    cd "$SCRIPT_DIR"

    docker compose build blog

    info "Starting all services..."
    docker compose up -d

    info "Waiting for blog health check..."
    local retries=0
    while [ $retries -lt 30 ]; do
        if docker compose ps | grep -q "blog.*healthy"; then
            info "Blog is healthy!"
            break
        fi
        sleep 2
        retries=$((retries + 1))
        if [ $((retries % 5)) -eq 0 ]; then
            info "  Still waiting... ($((retries * 2))s)"
        fi
    done

    if [ $retries -ge 30 ]; then
        err "Blog failed health check. Inspect logs:"
        err "  docker compose logs blog"
        exit 1
    fi

    info "Reloading nginx..."
    docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx

    info ""
    info "========================================="
    info "  Deployment successful!"
    info "  https://$DOMAIN"
    info "========================================="
}

# ============================================================
status() {
    cd "$SCRIPT_DIR"
    echo ""
    echo "======================================"
    echo " Deployment Status — $DOMAIN"
    echo "======================================"
    docker compose ps
    echo ""
    echo "Access: https://$DOMAIN"
    echo ""
    echo "Commands:"
    echo "  ./deploy.sh logs       # Blog logs"
    echo "  ./deploy.sh logs nginx # Nginx logs"
    echo "  ./deploy.sh restart    # Restart blog"
    echo "  ./deploy.sh stop       # Stop everything"
}

# ============================================================
# Main
case "${1:-}" in
    init-ssl)
        check_prereqs
        init_ssl
        ;;
    deploy)
        check_prereqs
        setup_env
        deploy
        status
        ;;
    status)
        status
        ;;
    restart)
        cd "$SCRIPT_DIR"
        docker compose restart blog
        info "Blog restarted."
        ;;
    logs)
        cd "$SCRIPT_DIR"
        docker compose logs -f "${2:-blog}"
        ;;
    stop)
        cd "$SCRIPT_DIR"
        docker compose down
        info "All services stopped."
        ;;
    *)
        echo ""
        echo "iV0 Blog Deploy Manager — $DOMAIN"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  init-ssl  — Issue SSL certificate (run ONCE before first deploy)"
        echo "  deploy    — Build & start all services"
        echo "  status    — Show service status"
        echo "  restart   — Restart the blog container"
        echo "  logs [svc]— View logs (default: blog, or 'nginx')"
        echo "  stop      — Stop all services"
        echo ""
        exit 1
        ;;
esac
