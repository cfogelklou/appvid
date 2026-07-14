#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

FAILURES=0
FAILED_CHECKS=()

run_check() {
    local name="$1"
    local cmd="$2"

    echo -e "${YELLOW}▶ ${name}${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}✓ ${name} passed${NC}\n"
    else
        echo -e "${RED}✗ ${name} failed${NC}\n"
        FAILURES=$((FAILURES + 1))
        FAILED_CHECKS+=("$name")
    fi
}

echo -e "${BLUE}=== AppVid Lint Checks ===${NC}\n"

cd "$PROJECT_ROOT"

run_check "ESLint"             "bun run lint"
run_check "TypeScript"         "npx tsc --noEmit"
run_check "Prettier"           "bun run format:check"

echo "==============================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}All lint checks passed!${NC}"
    exit 0
else
    echo -e "${RED}${FAILURES} check(s) failed:${NC}"
    for c in "${FAILED_CHECKS[@]}"; do
        echo -e "${RED}  - ${c}${NC}"
    done
    exit 1
fi
