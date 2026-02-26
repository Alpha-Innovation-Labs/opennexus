# Run cdd-react-flow-ui Next.js app from apps/react-flow/
# Usage: just flow

flow:
    mkdir -p logs
    rm -f apps/react-flow/.next/dev/lock
    rm -rf apps/react-flow/.next/dev/cache
    rm -rf apps/react-flow/.next/cache
    PORT=${FLOW_UI_PORT:-4174}; PID=$(lsof -tiTCP:$PORT -sTCP:LISTEN | head -n 1); if [ -n "$PID" ]; then CMD=$(ps -p $PID -o command=); if curl -fsS "http://localhost:$PORT" 2>/dev/null | grep -q "CDD Context Graph"; then (echo "flow app already running on http://localhost:$PORT"; echo "$CMD") | tee logs/flow.log; else (echo "Port $PORT is in use by another process:"; echo "$CMD"; echo "Set FLOW_UI_PORT to another port, e.g. FLOW_UI_PORT=4274 just flow") | tee logs/flow.log; exit 1; fi; else cd apps/react-flow && bun install && FLOW_UI_PORT=$PORT bun run dev 2>&1 | tee ../../logs/flow.log; fi
