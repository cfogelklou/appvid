#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

FAILURES=0
FAILED_STEPS=()

run_step() {
    local name="$1"
    local cmd="$2"

    echo -e "${YELLOW}▶ ${name}${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}✓ ${name} passed${NC}\n"
    else
        echo -e "${RED}✗ ${name} failed${NC}\n"
        FAILURES=$((FAILURES + 1))
        FAILED_STEPS+=("$name")
    fi
}

echo -e "${BLUE}=== AppVid Sanity Check ===${NC}\n"

cd "$PROJECT_ROOT"

run_step "Lint & Type & Format"  "bash scripts/lintall.sh"
run_step "Tests"                  "bash scripts/testall.sh"
run_step "Production build"       "bun run build"

echo "==============================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}=== All sanity checks passed! ===${NC}"
    exit 0
else
    echo -e "${RED}${FAILURES} step(s) failed:${NC}"
    for s in "${FAILED_STEPS[@]}"; do
        echo -e "${RED}  - ${s}${NC}"
    done
    exit 1
fi
