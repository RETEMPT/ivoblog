#!/bin/bash
# ============================================================
# iV0 Blog — Cloud Server Deployment Script
# Domain: vilatileno.xyz | SSL: Alibaba Cloud
# ============================================================
set -euo pipefail

DOMAIN="vilatileno.xyz"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

check_prereqs() {
    info "Checking prerequisites..."
    local missing=()
    for cmd in docker; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    if [ ${#missing[@]} -gt 0 ]; then
        err "Missing: ${missing[*]}. Install: sudo apt install -y ${missing[*]}"
        exit 1
    fi
    if ! docker compose version &>/dev/null; then
        err "Docker Compose v2 not found."
        exit 1
    fi

    # Verify SSL cert files exist
    if [ ! -f "$SCRIPT_DIR/nginx/ssl/vilatileno.xyz.pem" ] || [ ! -f "$SCRIPT_DIR/nginx/ssl/vilatileno.xyz.key" ]; then
        err "SSL certificate files not found!"
        err "Place them at: $SCRIPT_DIR/nginx/ssl/"
        err "  vilatileno.xyz.pem"
        err "  vilatileno.xyz.key"
        exit 1
    fi

    info "All checks passed."
}

setup_env() {
    local ENV_FILE="$PROJECT_DIR/ivoblog/blog/.env.production"
    if [ ! -f "$ENV_FILE" ]; then
        err ".env.production not found at $ENV_FILE"
        exit 1
    fi
    if grep -q "your_deepseek_api_key_here" "$ENV_FILE"; then
        warn "DEEPSEEK_API_KEY not configured."
    fi
    info "Environment: $ENV_FILE"
}

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
        err "Blog failed health check. Check: docker compose logs blog"
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

status() {
    cd "$SCRIPT_DIR"
    echo ""
    echo "======================================"
    echo " $DOMAIN — Deployment Status"
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

case "${1:-}" in
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
        echo "iV0 Blog Deploy — $DOMAIN (Alibaba Cloud SSL)"
        echo ""
        echo "Usage: $0 {deploy|status|restart|logs [svc]|stop}"
        exit 1
        ;;
esac
