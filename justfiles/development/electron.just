# Build and launch packaged Electron desktop app
# Usage: just electron

electron:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! command -v bun >/dev/null 2>&1; then
      echo "bun is required to build and run Electron desktop app"
      exit 1
    fi

    mkdir -p logs/electron

    bun install --cwd apps/react-flow >/dev/null
    bun install --cwd apps/restate-mvp >/dev/null
    bun install --cwd apps/desktop-electron >/dev/null

    FLOW_UI_PORT="${FLOW_UI_PORT:-4174}" bun run --cwd apps/react-flow build

    rm -rf apps/desktop-electron/resources
    mkdir -p apps/desktop-electron/resources/react-flow/standalone
    mkdir -p apps/desktop-electron/resources/restate-mvp

    cp -R apps/react-flow/.next/standalone/. apps/desktop-electron/resources/react-flow/standalone/
    mkdir -p apps/desktop-electron/resources/react-flow/standalone/.next
    cp -R apps/react-flow/.next/static apps/desktop-electron/resources/react-flow/standalone/.next/static
    if [ -d apps/react-flow/public ]; then
      cp -R apps/react-flow/public apps/desktop-electron/resources/react-flow/standalone/public
    fi

    cp -R apps/restate-mvp/src apps/desktop-electron/resources/restate-mvp/src
    cp -R apps/restate-mvp/configs apps/desktop-electron/resources/restate-mvp/configs
    cp -R apps/restate-mvp/pipelines apps/desktop-electron/resources/restate-mvp/pipelines
    cp -R apps/restate-mvp/prompts apps/desktop-electron/resources/restate-mvp/prompts
    cp apps/restate-mvp/package.json apps/desktop-electron/resources/restate-mvp/package.json
    cp -R apps/restate-mvp/node_modules apps/desktop-electron/resources/restate-mvp/node_modules

    bun run --cwd apps/desktop-electron pack

    APP_PATH=""
    if [ -d "apps/desktop-electron/dist/mac-arm64/Nexus Desktop.app" ]; then
      APP_PATH="apps/desktop-electron/dist/mac-arm64/Nexus Desktop.app/Contents/MacOS/Nexus Desktop"
    elif [ -d "apps/desktop-electron/dist/mac/Nexus Desktop.app" ]; then
      APP_PATH="apps/desktop-electron/dist/mac/Nexus Desktop.app/Contents/MacOS/Nexus Desktop"
    else
      echo "Unable to locate packaged app bundle in apps/desktop-electron/dist"
      exit 1
    fi

    RBX_OPENCODE_PORT="${RBX_OPENCODE_PORT:-4096}" FLOW_UI_PORT="${FLOW_UI_PORT:-4174}" "$APP_PATH"
