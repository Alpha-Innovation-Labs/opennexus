# Run Restate MVP orchestration demo and open dashboard
# Usage: just restate
# Example: just restate

restate:
    #!/usr/bin/env bash
    set -euo pipefail

    mkdir -p logs/restate-mvp

    export RBX_OPENCODE_PORT="${RBX_OPENCODE_PORT:-4196}"

    if ! command -v restate-server >/dev/null 2>&1; then
      echo "Missing restate-server binary. Install from https://docs.restate.dev/installation"
      exit 1
    fi

    if ! command -v restate >/dev/null 2>&1; then
      echo "Missing restate CLI binary. Install from https://docs.restate.dev/installation"
      exit 1
    fi

    if ! command -v opencode >/dev/null 2>&1; then
      echo "Missing opencode binary. Install OpenCode CLI before running this MVP."
      exit 1
    fi

    bun install --cwd apps/restate-mvp >/dev/null

    if ! pgrep -f "restate-server" >/dev/null 2>&1; then
      nohup restate-server > logs/restate-mvp/restate-server.log 2>&1 &
      echo $! > logs/restate-mvp/restate-server.pid
      sleep 2
    fi

    if ! pgrep -f "apps/restate-mvp/src/index.ts" >/dev/null 2>&1; then
      nohup bun run --cwd apps/restate-mvp dev > logs/restate-mvp/service.log 2>&1 &
      echo $! > logs/restate-mvp/service.pid
      sleep 2
    fi

    restate -y deployments register localhost:9080 >/dev/null || true
    restate -y services config patch ConversationWorkflow --inactivity-timeout 5m >/dev/null || true

    WORKFLOW_ID="mvp-demo-$(date +%s)"

    curl --max-time 180 -fsS -X POST "http://localhost:8080/ConversationWorkflow/${WORKFLOW_ID}/run" \
      -H "content-type: application/json" \
      -d '{"promptFile":"prompts/weather.txt"}' >/tmp/restate-mvp-result.json

    echo "Invocation complete. Result stored at /tmp/restate-mvp-result.json"
    echo "Opening Restate UI at http://localhost:9070"
    open http://localhost:9070
