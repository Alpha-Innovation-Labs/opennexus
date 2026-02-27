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

    if ! lsof -ti:9080 >/dev/null 2>&1; then
      nohup bun run --cwd apps/restate-mvp dev > logs/restate-mvp/service.log 2>&1 &
      echo $! > logs/restate-mvp/service.pid
      sleep 3
    fi

    if ! lsof -ti:9080 >/dev/null 2>&1; then
      echo "Restate workflow service failed to start on port 9080. Check logs/restate-mvp/service.log"
      exit 1
    fi

    restate -y deployments register localhost:9080 >/dev/null || true
    restate -y services config patch ConversationWorkflow --inactivity-timeout 5m >/dev/null || true

    PIPELINE_FILE="${RBX_RESTATE_PIPELINE_FILE:-pipelines/configurable-five-step.yaml}"
    CONFIG_FILE="${RBX_RESTATE_CONFIG_FILE:-configs/local-weather.yaml}"

    PROMPT_FILE=$(awk -F: '/^prompt_file:/{sub(/^[[:space:]]*/, "", $2); gsub(/"/, "", $2); print $2; exit}' "apps/restate-mvp/${CONFIG_FILE}")
    CONTEXT_STEM=$(basename "${PROMPT_FILE:-$CONFIG_FILE}")
    CONTEXT_STEM="${CONTEXT_STEM%.*}"
    CONTEXT_SLUG=$(printf "%s" "$CONTEXT_STEM" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '-' | sed 's/^-*//; s/-*$//')
    if [ -z "$CONTEXT_SLUG" ]; then CONTEXT_SLUG="context"; fi

    INVOCATIONS_OUTPUT=$(restate invocations list --all --service ConversationWorkflow --limit 1000 || true)
    RUN_COUNT=$(CONTEXT_SLUG="$CONTEXT_SLUG" INVOCATIONS_OUTPUT="$INVOCATIONS_OUTPUT" python3 -c 'import os,re; payload=os.environ.get("INVOCATIONS_OUTPUT",""); slug=os.environ.get("CONTEXT_SLUG","context"); targets=re.findall(r"Target:\\s+ConversationWorkflow/([^/]+)/run", payload); print(sum(1 for t in targets if t.startswith(f"{slug}-run-")) + 1)')

    WORKFLOW_ID="${CONTEXT_SLUG}-run-${RUN_COUNT}-$(date +%s)"

    rm -f /tmp/restate-mvp-result.json /tmp/restate-mvp-poll.json

    curl --max-time 30 -fsS -X POST "http://localhost:8080/ConversationWorkflow/${WORKFLOW_ID}/run/send" \
      -H "content-type: application/json" \
      -d "{\"pipelineFile\":\"${PIPELINE_FILE}\",\"configFile\":\"${CONFIG_FILE}\"}" >/tmp/restate-mvp-accepted.json

    OUTPUT_URL="http://localhost:8080/restate/workflow/ConversationWorkflow/${WORKFLOW_ID}/output"
    for _ in $(seq 1 300); do
      HTTP_CODE=$(curl --max-time 10 -sS -o /tmp/restate-mvp-poll.json -w "%{http_code}" "$OUTPUT_URL" || true)
      if [ "$HTTP_CODE" = "200" ]; then
        cp /tmp/restate-mvp-poll.json /tmp/restate-mvp-result.json
        break
      fi
      if [ "$HTTP_CODE" != "470" ]; then
        echo "Unexpected workflow output status: ${HTTP_CODE}"
        cat /tmp/restate-mvp-poll.json
        exit 1
      fi
      sleep 1
    done

    if [ ! -f /tmp/restate-mvp-result.json ]; then
      echo "Workflow output was not ready within polling window."
      exit 1
    fi

    echo "Invocation complete. Result stored at /tmp/restate-mvp-result.json"
    echo "Opening Restate UI at http://localhost:9070"
    open http://localhost:9070
