#!/bin/bash

# Parallel Test Execution Script
# Runs Cypress component tests in parallel using cypress-split

set -e

# Default number of parallel workers
WORKERS=${1:-4}

# Results tracking (using regular arrays for bash 3.2 compatibility)
WORKER_STATUS=()
WORKER_CURRENT_TEST=()
WORKER_PASSED=()
WORKER_FAILED=()
WORKER_TOTAL=()
# Failed tests stored in a temporary file
FAILED_TESTS_FILE=$(mktemp)

# MoonDAO Brand Colors
MOON_PURPLE='\033[38;5;141m'    # Light purple
MOON_VIOLET='\033[38;5;135m'    # Medium violet
MOON_BLUE='\033[38;5;111m'      # Sky blue
MOON_CYAN='\033[38;5;117m'      # Cyan/teal
MOON_DEEP_PURPLE='\033[38;5;99m' # Deep purple
MOON_LAVENDER='\033[38;5;147m'  # Lavender
SUCCESS_GREEN='\033[38;5;120m'  # Success indicator
ERROR_RED='\033[38;5;196m'      # Error indicator
MOON_GOLD='\033[38;5;221m'      # Gold accent
NC='\033[0m' # No Color

# Array of MoonDAO colors for workers
COLORS=("$MOON_PURPLE" "$MOON_VIOLET" "$MOON_BLUE" "$MOON_CYAN" "$MOON_DEEP_PURPLE" "$MOON_LAVENDER")

# Function to parse Cypress output and extract meaningful information
parse_cypress_line() {
  local worker_id=$1
  local line="$2"
  local color=$3
  
  # Extract test file from "Running:" line
  if [[ "$line" =~ Running:\ +([^[:space:]]+\.cy\.(tsx|ts|jsx|js)) ]]; then
    local test_file="${BASH_REMATCH[1]}"
    
    # If there was a previous test running, mark it as completed (assume passed if no failure was detected)
    if [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]] && [[ "${WORKER_CURRENT_TEST[$worker_id]}" != "$test_file" ]]; then
      local previous_test="${WORKER_CURRENT_TEST[$worker_id]}"
      # Check if it was already marked as failed
      if ! grep -Fxq "$previous_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
        WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
        echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $previous_test"
      fi
    fi
    
    WORKER_CURRENT_TEST[$worker_id]="$test_file"
    # Extract progress like "(1 of 128)"
    if [[ "$line" =~ \(([0-9]+)\ of\ ([0-9]+)\) ]]; then
      local current="${BASH_REMATCH[1]}"
      local total="${BASH_REMATCH[2]}"
      WORKER_TOTAL[$worker_id]="$total"
      echo -e "${color}[Worker $worker_id]${NC} ${MOON_BLUE}▶${NC} $test_file ${MOON_GOLD}($current/$total)${NC}"
    else
      echo -e "${color}[Worker $worker_id]${NC} ${MOON_BLUE}▶${NC} $test_file"
    fi
    return 0
  fi
  
  # Extract summary statistics from final summary (format: "X passing (Xs) Y failing")
  if [[ "$line" =~ ([0-9]+)\ passing ]] || [[ "$line" =~ ([0-9]+)\ failed ]]; then
    # Try to extract both passing and failing from the same line or nearby context
    if [[ "$line" =~ ([0-9]+)\ passing.*([0-9]+)\ failing ]]; then
      WORKER_PASSED[$worker_id]="${BASH_REMATCH[1]}"
      WORKER_FAILED[$worker_id]="${BASH_REMATCH[2]}"
    elif [[ "$line" =~ ([0-9]+)\ passing ]]; then
      WORKER_PASSED[$worker_id]="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ([0-9]+)\ failing ]] || [[ "$line" =~ ([0-9]+)\ failed ]]; then
      WORKER_FAILED[$worker_id]="${BASH_REMATCH[1]}"
    fi
    return 0
  fi
  
  # Extract test completion (when a test file finishes) - show both pass and fail
  if [[ "$line" =~ ✗ ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    # Store failed test in file (append if not already present)
    if ! grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
      echo "$test_file" >> "$FAILED_TESTS_FILE"
    fi
    WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
    echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $test_file"
    WORKER_CURRENT_TEST[$worker_id]=""
    return 0
  fi
  
  # Show passing tests
  if [[ "$line" =~ ✓ ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
    echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $test_file"
    WORKER_CURRENT_TEST[$worker_id]=""
    return 0
  fi
  
  # Also check for "passing" or "failing" keywords that indicate test completion
  if [[ "$line" =~ (passing|passed|PASSED) ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]] && ! [[ "$line" =~ ([0-9]+)\ (passing|passed) ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
    echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $test_file"
    WORKER_CURRENT_TEST[$worker_id]=""
    return 0
  fi
  
  if [[ "$line" =~ (failing|failed|FAILED) ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]] && ! [[ "$line" =~ ([0-9]+)\ (failing|failed) ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    if ! grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
      echo "$test_file" >> "$FAILED_TESTS_FILE"
    fi
    WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
    echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $test_file"
    WORKER_CURRENT_TEST[$worker_id]=""
    return 0
  fi
  
  # Parse summary line that shows totals (e.g., "Tests: 128 passing, 0 failing")
  if [[ "$line" =~ Tests?:\ +([0-9]+)\ (passing|passed).*([0-9]+)\ (failing|failed) ]]; then
    WORKER_PASSED[$worker_id]="${BASH_REMATCH[1]}"
    WORKER_FAILED[$worker_id]="${BASH_REMATCH[3]}"
    return 0
  fi
  
  # Show important error/warning lines but filter noise
  if [[ "$line" =~ (Error|ERROR|Failed|FAILED|Warning|WARNING|AssertionError) ]] && \
     ! [[ "$line" =~ (webpack|DevTools|dotenv|Cypress Config) ]]; then
    echo -e "${color}[Worker $worker_id]${NC} $line"
    return 0
  fi
  
  return 1
}

echo ""
echo -e "${MOON_PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MOON_PURPLE}    Parallel Test Execution${NC}"
echo -e "${MOON_PURPLE}    Running with $WORKERS workers${NC}"
echo -e "${MOON_PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create a temporary directory for logs
LOG_DIR=$(mktemp -d)
echo "Logs directory: $LOG_DIR"
echo ""

# Start all workers in parallel with logging
for ((i=1; i<=WORKERS; i++)); do
  COLOR_INDEX=$((i % 6))
  COLOR=${COLORS[$COLOR_INDEX]}
  
  # Calculate unique port for this worker (8080, 8081, 8082, ...)
  WORKER_PORT=$((8079 + i))
  
  echo -e "${COLOR}[Worker $i/$WORKERS]${NC} Starting on port $WORKER_PORT..."
  
  # Initialize worker tracking
  WORKER_STATUS[$i]="running"
  WORKER_CURRENT_TEST[$i]=""
  WORKER_PASSED[$i]=0
  WORKER_FAILED[$i]=0
  WORKER_PENDING[$i]=0
  
  # Run worker and pipe output to both log file and terminal with prefix
  (
    # Export environment variables for cypress-split and webpack dev server
    # cypress-split uses SPLIT_INDEX (zero-based) and SPLIT (total)
    export SPLIT_INDEX=$((i - 1))  # Zero-based: 0, 1, 2, 3
    export SPLIT=$WORKERS          # Total number of workers
    export CYPRESS_WEBPACK_DEV_SERVER_PORT=$WORKER_PORT
    export PORT=$WORKER_PORT  # Next.js also reads PORT env var
    
    # Run cypress component tests
    # Environment variables are exported above and will be available to Cypress
    yarn cy:run-ct 2>&1 | \
    grep --line-buffered -v "webpack.cache.PackFileCacheStrategy" | \
    grep --line-buffered -v "Restoring failed" | \
    tee "$LOG_DIR/worker-$i.log" | \
    while IFS= read -r line; do
      parse_cypress_line "$i" "$line" "$COLOR" || true
    done
    
    # Capture exit code
    EXIT_CODE=${PIPESTATUS[0]}
    WORKER_STATUS[$i]="completed"
    
    # Show final status
    if [ $EXIT_CODE -eq 0 ]; then
      echo -e "${COLOR}[Worker $i]${NC} ${SUCCESS_GREEN}✓ Completed${NC} - Passed: ${WORKER_PASSED[$i]:-0}, Failed: ${WORKER_FAILED[$i]:-0}"
    else
      echo -e "${COLOR}[Worker $i]${NC} ${ERROR_RED}✗ Failed${NC} (exit code: $EXIT_CODE) - Passed: ${WORKER_PASSED[$i]:-0}, Failed: ${WORKER_FAILED[$i]:-0}"
    fi
    
    exit $EXIT_CODE
  ) &
  
  # Store PID
  PIDS[$i]=$!
done

echo ""
echo -e "${MOON_VIOLET}Waiting for all workers to complete...${NC}"
echo ""

# Wait for all background jobs and track failures
FAILED=0
for ((i=1; i<=WORKERS; i++)); do
  if ! wait ${PIDS[$i]}; then
    FAILED=$((FAILED + 1))
  fi
done

# Small delay to ensure all output is flushed
sleep 1

# Clear any remaining progress lines
echo ""

# Function to parse final statistics from log files
parse_log_statistics() {
  for ((i=1; i<=WORKERS; i++)); do
    local log_file="$LOG_DIR/worker-$i.log"
    if [ -f "$log_file" ]; then
      # Extract passing count
      local passing=$(grep -oE "([0-9]+)\ passing" "$log_file" | tail -1 | grep -oE "[0-9]+" | head -1)
      if [ -n "$passing" ]; then
        WORKER_PASSED[$i]="$passing"
      fi
      
      # Extract failing count
      local failing=$(grep -oE "([0-9]+)\ failing" "$log_file" | tail -1 | grep -oE "[0-9]+" | head -1)
      if [ -z "$failing" ]; then
        failing=$(grep -oE "([0-9]+)\ failed" "$log_file" | tail -1 | grep -oE "[0-9]+" | head -1)
      fi
      if [ -n "$failing" ]; then
        WORKER_FAILED[$i]="$failing"
      fi
      
      # Extract total tests from "Running:" lines
      local total=$(grep -oE "\([0-9]+\ of\ ([0-9]+)\)" "$log_file" | tail -1 | grep -oE "[0-9]+" | tail -1)
      if [ -n "$total" ]; then
        WORKER_TOTAL[$i]="$total"
      fi
      
      # Extract failed test files from error messages and test results
      grep -E "(✗|FAILED|failed|Error|AssertionError)" "$log_file" | \
        grep -E "\.cy\.(tsx|ts|jsx|js)" | \
        sed -E 's/.*(cypress\/integration\/[^[:space:]]+\.cy\.(tsx|ts|jsx|js)).*/\1/' | \
        sort -u | while read -r failed_test; do
        if [ -n "$failed_test" ]; then
          # Append to failed tests file if not already present
          if ! grep -Fxq "$failed_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
            echo "$failed_test" >> "$FAILED_TESTS_FILE"
          fi
        fi
      done
    fi
  done
}

# Function to generate summary report
generate_summary() {
  # Parse statistics from log files for accuracy
  parse_log_statistics
  echo ""
  echo -e "${MOON_PURPLE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${MOON_PURPLE}                    Test Execution Summary${NC}"
  echo -e "${MOON_PURPLE}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  
  # Calculate totals
  TOTAL_PASSED=0
  TOTAL_FAILED=0
  TOTAL_TESTS=0
  
  for ((i=1; i<=WORKERS; i++)); do
    COLOR_INDEX=$((i % 6))
    COLOR=${COLORS[$COLOR_INDEX]}
    TOTAL_PASSED=$((TOTAL_PASSED + ${WORKER_PASSED[$i]:-0}))
    TOTAL_FAILED=$((TOTAL_FAILED + ${WORKER_FAILED[$i]:-0}))
    TOTAL_TESTS=$((TOTAL_TESTS + ${WORKER_TOTAL[$i]:-0}))
    
    echo -e "${COLOR}Worker $i:${NC}"
    echo -e "  Port: $((8079 + i))"
    echo -e "  Status: ${WORKER_STATUS[$i]:-unknown}"
    echo -e "  Passed: ${SUCCESS_GREEN}${WORKER_PASSED[$i]:-0}${NC}"
    echo -e "  Failed: ${ERROR_RED}${WORKER_FAILED[$i]:-0}${NC}"
    if [ -n "${WORKER_TOTAL[$i]}" ]; then
      echo -e "  Total: ${WORKER_TOTAL[$i]}"
    fi
    echo ""
  done
  
  echo -e "${MOON_PURPLE}────────────────────────────────────────────────────────────────${NC}"
  echo -e "${MOON_BLUE}Overall Statistics:${NC}"
  echo -e "  Total Passed: ${SUCCESS_GREEN}$TOTAL_PASSED${NC}"
  echo -e "  Total Failed: ${ERROR_RED}$TOTAL_FAILED${NC}"
  if [ $TOTAL_TESTS -gt 0 ]; then
    echo -e "  Total Tests: $TOTAL_TESTS"
    local success_rate=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_PASSED / $TOTAL_TESTS) * 100}")
    echo -e "  Success Rate: ${MOON_GOLD}${success_rate}%${NC}"
  fi
  echo ""
  
  # Show failed tests if any
  if [ $TOTAL_FAILED -gt 0 ] && [ -f "$FAILED_TESTS_FILE" ]; then
    local failed_count=$(wc -l < "$FAILED_TESTS_FILE" | tr -d ' ')
    if [ "$failed_count" -gt 0 ]; then
      echo -e "${ERROR_RED}Failed Tests:${NC}"
      # Sort failed tests alphabetically and display
      sort "$FAILED_TESTS_FILE" | while read -r test_file; do
        echo -e "  ${ERROR_RED}✗${NC} $test_file"
      done
      echo ""
    fi
  fi
  
  echo -e "${MOON_PURPLE}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${MOON_BLUE}Detailed logs saved to: $LOG_DIR${NC}"
  echo ""
}

# Generate summary report
generate_summary

# Cleanup temporary file
if [ -f "$FAILED_TESTS_FILE" ]; then
  rm -f "$FAILED_TESTS_FILE"
fi

# Exit with appropriate code
if [ $FAILED -eq 0 ] && [ $TOTAL_FAILED -eq 0 ]; then
  echo -e "${SUCCESS_GREEN}✓ All tests passed! ✨${NC}"
  exit 0
else
  echo -e "${ERROR_RED}✗ Some tests failed${NC}"
  exit 1
fi

