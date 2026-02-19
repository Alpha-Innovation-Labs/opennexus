# Build and publish docs to GitHub Pages branch
# Usage: just docs-gh-pub
# Example: just docs-gh-pub

docs-gh-pub:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! command -v bun >/dev/null 2>&1; then
        echo "bun is required (https://bun.sh)"
        exit 1
    fi

    if ! command -v git >/dev/null 2>&1; then
        echo "git is required"
        exit 1
    fi

    REMOTE_URL=$(git config --get remote.origin.url || true)
    if [[ -z "$REMOTE_URL" ]]; then
        echo "No git remote origin configured"
        exit 1
    fi

    REPO_NAME=$(basename "${REMOTE_URL%.git}")
    BASE_PATH="/${REPO_NAME}"

    echo "Building docs for GitHub Pages (base path: ${BASE_PATH})..."
    (
        cd docs
        bun install
        DOCS_GH_PAGES=1 DOCS_BASE_PATH="$BASE_PATH" bun run build
    )

    if [[ ! -d "docs/out" ]]; then
        echo "Build succeeded but docs/out was not generated"
        exit 1
    fi

    WORKTREE_DIR=$(mktemp -d)
    cleanup() {
        git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
        rm -rf "$WORKTREE_DIR"
    }
    trap cleanup EXIT

    if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
        git worktree add "$WORKTREE_DIR" "origin/gh-pages" >/dev/null
        (
            cd "$WORKTREE_DIR"
            git checkout -B gh-pages
        )
    else
        git worktree add --detach "$WORKTREE_DIR" >/dev/null
        (
            cd "$WORKTREE_DIR"
            git checkout --orphan gh-pages
            git rm -rf . >/dev/null 2>&1 || true
        )
    fi

    rsync -a --delete --exclude=.git docs/out/ "$WORKTREE_DIR"/
    touch "$WORKTREE_DIR/.nojekyll"
    printf '%s\n' "opennexus.xyz" > "$WORKTREE_DIR/CNAME"

    (
        cd "$WORKTREE_DIR"
        git add -A

        if git diff --cached --quiet; then
            echo "No docs changes to publish"
            exit 0
        fi

        git commit -m "docs: publish GitHub Pages"
        git push origin gh-pages
    )

    echo "Published docs to origin/gh-pages"
