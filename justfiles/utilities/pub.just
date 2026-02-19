# Publish release (bumps versions, tags, publishes crates)
# Usage: just pub
# Example: just pub

pub:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Checking git status..."
    if ! git diff --quiet --exit-code || ! git diff --cached --quiet --exit-code; then
        echo "Found uncommitted changes. Committing all changes before release..."
        git add .
        git commit -m "chore: prepare for release"
        echo "Committed all pending changes"
    else
        echo "Git working directory is clean"
    fi

    CURRENT_VERSION=$(grep '^version = ' Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
    echo "Current version: $CURRENT_VERSION"

    MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
    MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
    PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)

    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
    echo "New version: $NEW_VERSION"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" Cargo.toml
    else
        sed -i "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" Cargo.toml
    fi
    echo "Updated Cargo.toml to version $NEW_VERSION"

    echo "Updating wrapper versions to $NEW_VERSION..."
    NEW_VERSION="$NEW_VERSION" node -e "const fs=require('fs');const p='wrappers/npm/opennexus/package.json';const d=JSON.parse(fs.readFileSync(p,'utf8'));d.version=process.env.NEW_VERSION;fs.writeFileSync(p, JSON.stringify(d, null, 2)+'\\n');"
    awk -v v="$NEW_VERSION" 'BEGIN{done=0} /^version = "/ && !done {print "version = \"" v "\""; done=1; next} {print}' wrappers/python/opennexus/pyproject.toml > wrappers/python/opennexus/pyproject.toml.tmp
    mv wrappers/python/opennexus/pyproject.toml.tmp wrappers/python/opennexus/pyproject.toml
    echo "Updated wrapper package versions"

    cargo check --quiet
    echo "Updated Cargo.lock"

    echo "Committing version bump..."
    git add Cargo.toml Cargo.lock wrappers/npm/opennexus/package.json wrappers/python/opennexus/pyproject.toml
    git commit -m "chore: bump version to $NEW_VERSION"
    echo "Committed version bump"

    echo "Creating git tag v$NEW_VERSION..."
    git tag "v$NEW_VERSION"
    echo "Created tag v$NEW_VERSION"

    if git remote | grep -q .; then
        echo "Pushing to remote..."
        git push
        git push --tags
        echo "Pushed commits and tags"
    else
        echo "No git remote configured. Skipping push."
    fi

    echo "Publishing to crates.io..."
    cargo publish --package opennexus
    echo "Published version $NEW_VERSION to crates.io"
