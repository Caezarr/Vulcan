#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INDEX_FILE="$REPO_ROOT/docs/INDEX.md"
SKILLS_DIR="$REPO_ROOT/skills"
AGENTS_DIR="$REPO_ROOT/agents"

echo "Validating skills and agents index..."
echo

missing=0

check_directory() {
    local dir=$1
    local type=$2
    
    echo "Checking $type in $dir..."
    
    while IFS= read -r -d '' file; do
        basename=$(basename "$file")
        
        if [[ "$basename" == "README.md" ]]; then
            continue
        fi
        
        name="${basename%.md}"
        
        if ! grep -q "$name" "$INDEX_FILE"; then
            echo "  ❌ Missing: $type/$basename is not listed in docs/INDEX.md"
            missing=$((missing + 1))
        else
            echo "  ✓ Found: $name"
        fi
    done < <(find "$dir" -maxdepth 1 -type f -name "*.md" -print0 | sort -z)
}

if [[ ! -f "$INDEX_FILE" ]]; then
    echo "ERROR: docs/INDEX.md not found!"
    exit 1
fi

check_directory "$SKILLS_DIR" "skills"
echo
check_directory "$AGENTS_DIR" "agents"
echo

if [[ $missing -gt 0 ]]; then
    echo "❌ FAILED: $missing skill(s)/agent(s) missing from docs/INDEX.md"
    echo
    echo "Please add the missing entries to docs/INDEX.md and include:"
    echo "  - Name (without .md extension)"
    echo "  - One-line purpose"
    echo "  - Path to the file"
    echo "  - How to invoke (for skills) or invoked by (for agents)"
    exit 1
else
    echo "✅ SUCCESS: All skills and agents are indexed in docs/INDEX.md"
fi
