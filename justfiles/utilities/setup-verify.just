# Run setup and verify command/skill symlinks
# Usage: just setup-verify

setup-verify:
    #!/usr/bin/env bash
    set -euo pipefail

    cargo run --bin opennexus -- setup

    command_src_dir=".nexus/ai_harness/commands"
    command_dst_dir=".opencode/command"
    skill_src_dir=".nexus/ai_harness/skills"
    skill_dst_dir=".opencode/skills"

    if [ ! -d "$command_src_dir" ] || [ ! -d "$command_dst_dir" ]; then
      echo "setup-verify: missing command directories"
      exit 1
    fi

    if [ ! -d "$skill_src_dir" ] || [ ! -d "$skill_dst_dir" ]; then
      echo "setup-verify: missing skill directories"
      exit 1
    fi

    cmd_expected=$(find "$command_src_dir" -maxdepth 1 -type f -name "*.md" | wc -l | tr -d ' ')
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

    echo "setup-verify: commands and skills links look correct"
