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
FAILED_SUITES=()

run_tests() {
    local name="$1"
    local dir="$2"

    echo -e "${YELLOW}▶ ${name}${NC}"

    if [ ! -d "$dir" ] || [ ! -f "$dir/package.json" ]; then
        echo -e "${YELLOW}⚠ Skipping ${name} — directory or package.json not found${NC}\n"
        return
    fi

    if ! grep -q '"test"' "$dir/package.json"; then
        echo -e "${YELLOW}⚠ Skipping ${name} — no test script in package.json${NC}\n"
        return
    fi

    cd "$dir"
    if CI=true bun run test --run; then
        echo -e "${GREEN}✓ ${name} passed${NC}\n"
    else
        echo -e "${RED}✗ ${name} failed${NC}\n"
        FAILURES=$((FAILURES + 1))
        FAILED_SUITES+=("$name")
    fi
    cd "$PROJECT_ROOT"
}

echo -e "${BLUE}=== AppVid Test Suites ===${NC}\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

run_tests "AppVid" "$PROJECT_ROOT"

echo "==============================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}${FAILURES} suite(s) failed:${NC}"
    for s in "${FAILED_SUITES[@]}"; do
        echo -e "${RED}  - ${s}${NC}"
    done
    exit 1
fi
