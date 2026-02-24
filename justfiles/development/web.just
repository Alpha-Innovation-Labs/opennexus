# Run cdd-web-ui Next.js app from apps/web/
# Usage: just web
# Example: just web

web:
    mkdir -p logs
    rm -f apps/web/.next/dev/lock
    rm -rf apps/web/.next/dev/cache
    rm -rf apps/web/.next/cache
    PORT=${CDD_UI_PORT:-4173}; if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then (echo "web already running on http://localhost:$PORT"; lsof -nP -iTCP:$PORT -sTCP:LISTEN) | tee logs/web.log; else cd apps/web && bun install && CDD_UI_PORT=$PORT bun run dev 2>&1 | tee ../../logs/web.log; fi
