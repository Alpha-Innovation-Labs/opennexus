# Run setup and verify command/skill symlinks (+ marketplace links)
# Usage: just setup-verify

setup-verify:
    #!/usr/bin/env bash
    set -euo pipefail

    repo_root="$(pwd)"

    cargo run --bin opennexus -- setup --harness opencode
    cargo run --bin opennexus -- marketplace install "$repo_root" fumadocs

    command_src_dir=".nexus/ai_harness/commands"
    command_dst_dir=".opencode/command"
    skill_src_dir=".nexus/ai_harness/skills"
    skill_dst_dir=".opencode/skills"
    rules_src_dir=".nexus/ai_harness/rules"
    rules_dst_dir=".opencode/rules"

    marketplace_pkg_dir=".nexus/marketplace/fumadocs"
    marketplace_context_src="$marketplace_pkg_dir/context"
    marketplace_context_link=".nexus/context/fumadocs"
    marketplace_command_src="$marketplace_pkg_dir/commands/nexus-fumadocs-sync.md"
    marketplace_command_link=".nexus/ai_harness/commands/nexus-marketplace-fumadocs-sync.md"
    marketplace_opencode_link=".opencode/command/nexus-marketplace-fumadocs-sync.md"

    if [ ! -d "$command_src_dir" ] || [ ! -d "$command_dst_dir" ]; then
      echo "setup-verify: missing command directories"
      exit 1
    fi

    if [ ! -d "$skill_src_dir" ] || [ ! -d "$skill_dst_dir" ]; then
      echo "setup-verify: missing skill directories"
      exit 1
    fi

    if [ ! -d "$rules_src_dir" ] || [ ! -d "$rules_dst_dir" ]; then
      echo "setup-verify: missing rule directories"
      exit 1
    fi

    cmd_expected=$(find "$command_src_dir" -maxdepth 1 \( -type f -o -type l \) -name "*.md" | wc -l | tr -d ' ')
    cmd_actual=$(find "$command_dst_dir" -maxdepth 1 -type l -name "*.md" | wc -l | tr -d ' ')

    if [ "$cmd_expected" -ne "$cmd_actual" ]; then
      echo "setup-verify: command symlink count mismatch (expected $cmd_expected, got $cmd_actual)"
      exit 1
    fi

    while IFS= read -r path; do
      target=$(readlink "$path")
      case "$target" in
        ../../.nexus/ai_harness/commands/*) ;;
        *)
          echo "setup-verify: unexpected command link target: $path -> $target"
          exit 1
          ;;
      esac
    done < <(find "$command_dst_dir" -maxdepth 1 -type l -name "*.md" | sort)

    skill_expected=0
    while IFS= read -r skill_path; do
      if [ -f "$skill_path/SKILL.md" ]; then
        skill_expected=$((skill_expected + 1))
      fi
    done < <(find "$skill_src_dir" -maxdepth 1 -mindepth 1 -type d | sort)

    skill_actual=$(find "$skill_dst_dir" -maxdepth 1 -type l | wc -l | tr -d ' ')

    if [ "$skill_expected" -ne "$skill_actual" ]; then
      echo "setup-verify: skill symlink count mismatch (expected $skill_expected, got $skill_actual)"
      exit 1
    fi

    while IFS= read -r path; do
      target=$(readlink "$path")
      case "$target" in
        ../../.nexus/ai_harness/skills/*) ;;
        *)
          echo "setup-verify: unexpected skill link target: $path -> $target"
          exit 1
          ;;
      esac
    done < <(find "$skill_dst_dir" -maxdepth 1 -type l | sort)

    # Verify rules are linked to opencode
    while IFS= read -r path; do
      target=$(readlink "$path")
      case "$target" in
        ../../.nexus/ai_harness/rules/*) ;;
        *)
          echo "setup-verify: unexpected rule link target: $path -> $target"
          exit 1
          ;;
      esac
    done < <(find "$rules_dst_dir" -maxdepth 1 -type l | sort)

    # Verify marketplace package persisted under .nexus/marketplace/<name>
    if [ ! -d "$marketplace_pkg_dir" ]; then
      echo "setup-verify: marketplace package dir missing: $marketplace_pkg_dir"
      exit 1
    fi

    if [ ! -d "$marketplace_context_src" ]; then
      echo "setup-verify: marketplace context source missing: $marketplace_context_src"
      exit 1
    fi

    if [ ! -f "$marketplace_command_src" ]; then
      echo "setup-verify: marketplace command source missing: $marketplace_command_src"
      exit 1
    fi

    # Verify context is linked from active .nexus/context to marketplace package
    if [ ! -L "$marketplace_context_link" ]; then
      echo "setup-verify: expected context symlink missing: $marketplace_context_link"
      exit 1
    fi

    ctx_target=$(readlink "$marketplace_context_link")
    if [ "$ctx_target" != "../marketplace/fumadocs/context" ]; then
      echo "setup-verify: unexpected marketplace context link target: $marketplace_context_link -> $ctx_target"
      exit 1
    fi

    # Verify marketplace command is namespaced and linked in active harness sources
    if [ ! -L "$marketplace_command_link" ]; then
      echo "setup-verify: expected marketplace command symlink missing: $marketplace_command_link"
      exit 1
    fi

    cmd_target=$(readlink "$marketplace_command_link")
    if [ "$cmd_target" != "../../marketplace/fumadocs/commands/nexus-fumadocs-sync.md" ]; then
      echo "setup-verify: unexpected marketplace command link target: $marketplace_command_link -> $cmd_target"
      exit 1
    fi

    # Verify command is linked into default harness selected in .nexus/config.json
    if [ ! -f ".nexus/config.json" ]; then
      echo "setup-verify: missing .nexus/config.json"
      exit 1
    fi

    harness=$(python3 -c "import json, pathlib; p=pathlib.Path('.nexus/config.json'); d=json.loads(p.read_text()) if p.exists() else dict(); print(d.get('harness','opencode'))")

    case "$harness" in
      opencode)
        if [ ! -L "$marketplace_opencode_link" ]; then
          echo "setup-verify: expected opencode marketplace command link missing: $marketplace_opencode_link"
          exit 1
        fi
        opencode_target=$(readlink "$marketplace_opencode_link")
        if [ "$opencode_target" != "../../.nexus/ai_harness/commands/nexus-marketplace-fumadocs-sync.md" ]; then
          echo "setup-verify: unexpected opencode marketplace command link: $marketplace_opencode_link -> $opencode_target"
          exit 1
        fi
        ;;
      claude)
        marketplace_claude_link=".claude/commands/nexus-marketplace-fumadocs-sync.md"
        if [ ! -L "$marketplace_claude_link" ]; then
          echo "setup-verify: expected claude marketplace command link missing: $marketplace_claude_link"
          exit 1
        fi
        claude_target=$(readlink "$marketplace_claude_link")
        if [ "$claude_target" != "../../.nexus/ai_harness/commands/nexus-marketplace-fumadocs-sync.md" ]; then
          echo "setup-verify: unexpected claude marketplace command link: $marketplace_claude_link -> $claude_target"
          exit 1
        fi
        ;;
      *)
        echo "setup-verify: unsupported harness '$harness' for marketplace command verification"
        exit 1
        ;;
    esac

    echo "setup-verify: commands/skills/rules + marketplace links look correct"
