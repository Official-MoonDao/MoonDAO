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
# Failed test errors stored in a temporary file (format: test_file|error_message)
FAILED_TESTS_ERRORS_FILE=$(mktemp)

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
      # Check if it was already marked as failed (from AssertionErrors or other errors)
      if ! grep -Fxq "$previous_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
        WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
        echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $previous_test"
      else
        # It was marked as failed, make sure we show it as failed
        WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
        echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $previous_test"
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
  
  # Detect AssertionError or timeout errors - mark current test as failed
  # This must happen BEFORE checking for ✓ or ✗ symbols to catch errors early
  if [[ "$line" =~ (AssertionError|Timed out retrying|CypressError) ]]; then
    # Try to find the test file - prioritize current test, then extract from line
    local test_file=""
    if [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]]; then
      test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    else
      # Try to extract test file from the error line itself
      # Handle webpack paths like "(webpack://_N_E/./cypress/integration/mission/mission-wide-card.cy.tsx"
      test_file=$(echo "$line" | grep -oE "[^/[:space:]]+\.cy\.(tsx|ts|jsx|js)" | head -1)
      # If that doesn't work, try with path separators
      if [[ -z "$test_file" ]]; then
        test_file=$(echo "$line" | grep -oE "[^[:space:]]+/(mission|layout|dashboard|globe|launchpad|lib|lock|onboarding|privy|retroactive-rewards|safe|subscription|thirdweb|tokens|unit|mooney|nance|network)/[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" | grep -oE "[^/[:space:]]+\.cy\.(tsx|ts|jsx|js)" | head -1)
      fi
    fi
    
    if [[ -n "$test_file" ]]; then
      # Normalize test file name (remove webpack paths, keep relative path)
      # Convert "mission-wide-card.cy.tsx" to "mission/mission-wide-card.cy.tsx" if needed
      local normalized_file="$test_file"
      # If it's just a filename, try to find the full path from current test or extract from context
      if [[ ! "$normalized_file" =~ / ]]; then
        # Check if we have a current test with a path
        if [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]] && [[ "${WORKER_CURRENT_TEST[$worker_id]}" =~ / ]]; then
          # Extract directory from current test
          local dir=$(dirname "${WORKER_CURRENT_TEST[$worker_id]}")
          normalized_file="$dir/$test_file"
        fi
      fi
      
      # Mark as failed if not already marked (check both normalized and original)
      local already_failed=false
      if grep -Fxq "$normalized_file" "$FAILED_TESTS_FILE" 2>/dev/null || \
         grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
        already_failed=true
      fi
      
      if [[ "$already_failed" == "false" ]]; then
        # Store normalized version
        echo "$normalized_file" >> "$FAILED_TESTS_FILE"
        # Store error message for this test (extract meaningful part of error)
        local error_msg=$(echo "$line" | sed 's/^[[:space:]]*//' | head -c 200)
        echo "$normalized_file|$error_msg" >> "$FAILED_TESTS_ERRORS_FILE"
        # Note: Arrays modified in subshell don't persist, so we'll parse from logs later
        # But we still output the failure message for visibility
        echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $normalized_file"
      fi
    fi
    # Always show the error line
    echo -e "${color}[Worker $worker_id]${NC}      $line"
    return 0
  fi
  
  # Extract test completion (when a test file finishes) - show both pass and fail
  if [[ "$line" =~ ✗ ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    # Store failed test in file (append if not already present)
    if ! grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
      echo "$test_file" >> "$FAILED_TESTS_FILE"
      WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
      echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $test_file"
    fi
    WORKER_CURRENT_TEST[$worker_id]=""
    return 0
  fi
  
  # Show passing tests
  if [[ "$line" =~ ✓ ]] && [[ "$line" =~ PASSED ]]; then
    # Extract test file from the PASSED line
    local test_file=$(echo "$line" | grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" | head -1)
    # Fallback to current test if extraction fails
    if [[ -z "$test_file" ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]]; then
      test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    fi
    
    if [[ -n "$test_file" ]]; then
      # Only mark as passed if not already marked as failed (from AssertionErrors)
      if ! grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
        # Check if this test file has any AssertionErrors in the log so far
        # (This handles the case where AssertionError appears after ✓ PASSED)
        # Note: Arrays modified in subshell don't persist, so we'll parse from logs later
        # But we still check the failed tests file
        WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
        echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $test_file"
      else
        # Test was marked as failed, don't mark as passed
        WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
        echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $test_file"
      fi
      WORKER_CURRENT_TEST[$worker_id]=""
    fi
    return 0
  fi
  
  # Also check for "passing" or "failing" keywords that indicate test completion
  if [[ "$line" =~ (passing|passed|PASSED) ]] && [[ -n "${WORKER_CURRENT_TEST[$worker_id]}" ]] && ! [[ "$line" =~ ([0-9]+)\ (passing|passed) ]]; then
    local test_file="${WORKER_CURRENT_TEST[$worker_id]}"
    # Only mark as passed if not already marked as failed
    if ! grep -Fxq "$test_file" "$FAILED_TESTS_FILE" 2>/dev/null; then
      WORKER_PASSED[$worker_id]=$((${WORKER_PASSED[$worker_id]:-0} + 1))
      echo -e "${color}[Worker $worker_id]${NC} ${SUCCESS_GREEN}✓ PASSED${NC} $test_file"
    else
      # Test was marked as failed, don't mark as passed
      WORKER_FAILED[$worker_id]=$((${WORKER_FAILED[$worker_id]:-0} + 1))
      echo -e "${color}[Worker $worker_id]${NC} ${ERROR_RED}✗ FAILED${NC} $test_file"
    fi
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

# Track overall start time
OVERALL_START_TIME=$(date +%s)

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
  WORKER_START_TIME[$i]=$(date +%s)
  
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
    grep --line-buffered -v "failed to trash the existing run results" | \
    grep --line-buffered -v "Error: Command failed.*trash" | \
    tee "$LOG_DIR/worker-$i.log" | \
    while IFS= read -r line; do
      parse_cypress_line "$i" "$line" "$COLOR" || true
    done
    
    # Capture exit code and end time
    EXIT_CODE=${PIPESTATUS[0]}
    WORKER_END_TIME[$i]=$(date +%s)
    WORKER_STATUS[$i]="completed"
    
    # Note: Arrays modified in subshell don't persist, so we'll parse from logs later
    # Just show completion status here
    if [ $EXIT_CODE -eq 0 ]; then
      echo -e "${COLOR}[Worker $i]${NC} ${SUCCESS_GREEN}✓ Completed${NC}"
    else
      echo -e "${COLOR}[Worker $i]${NC} ${ERROR_RED}✗ Failed${NC} (exit code: $EXIT_CODE)"
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
  # Record end time if not already recorded
  if [ -z "${WORKER_END_TIME[$i]}" ]; then
    WORKER_END_TIME[$i]=$(date +%s)
  fi
done

# Record overall end time
OVERALL_END_TIME=$(date +%s)

# Small delay to ensure all output is flushed
sleep 1

# Clear any remaining progress lines
echo ""

# Function to parse final statistics from log files
parse_log_statistics() {
  for ((i=1; i<=WORKERS; i++)); do
    local log_file="$LOG_DIR/worker-$i.log"
    if [ -f "$log_file" ]; then
      # Count test files that ran from "Running:" lines (raw Cypress output)
      local all_tests=$(grep -oE "Running:\ +[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" "$log_file" 2>/dev/null | sort -u | wc -l | tr -d ' \n')
      all_tests=${all_tests:-0}
      
      # Also try counting from our formatted "▶" lines if "Running:" pattern isn't found
      if [ "$all_tests" -eq 0 ]; then
        all_tests=$(grep -oE "▶ [^[:space:]]+\.cy\.(tsx|ts|jsx|js)" "$log_file" 2>/dev/null | sort -u | wc -l | tr -d ' \n')
        all_tests=${all_tests:-0}
      fi
      
      # Check if worker exited with non-zero code (indicates failures)
      local worker_exit_failed=$(grep -c "✗ Failed.*exit code" "$log_file" 2>/dev/null || echo "0")
      worker_exit_failed=$(echo "$worker_exit_failed" | tr -d ' \n')
      worker_exit_failed=${worker_exit_failed:-0}
      
      # Count unique failed test files from error messages
      # Strategy: Track which test file was running when each AssertionError occurred
      # This handles cases where AssertionError appears after "✓ PASSED"
      local failed_test_files=$(mktemp)
      
      # Get all test execution markers with line numbers (both "Running:" and "▶")
      # Also include "✓ PASSED" lines to track which tests completed
      grep -n -E "(Running:\ +|▶ |✓ PASSED)" "$log_file" 2>/dev/null | \
        grep -E "\.cy\.(tsx|ts|jsx|js)" > "$failed_test_files.running" || true
      
      # Get all AssertionError lines with their line numbers
      grep -n "AssertionError" "$log_file" 2>/dev/null > "$failed_test_files.errors" || true
      
      # For each AssertionError, find the most recent test execution marker before it
      if [ -f "$failed_test_files.errors" ] && [ -s "$failed_test_files.errors" ]; then
        while IFS=: read -r error_line_num rest; do
          # Find the most recent test execution line before this error
          # Look for "Running:", "▶", or "✓ PASSED" patterns
          local test_file=$(awk -F: -v err_line="$error_line_num" '
            $1 < err_line {
              # Match "Running: filename.cy.tsx" or "▶ filename.cy.tsx" or "✓ PASSED filename.cy.tsx"
              if (match($0, /Running:\ +([^[:space:]]+\.cy\.(tsx|ts|jsx|js))/, arr1)) {
                last_test = arr1[1]
              } else if (match($0, /▶ ([^[:space:]]+\.cy\.(tsx|ts|jsx|js))/, arr2)) {
                last_test = arr2[1]
              } else if (match($0, /✓ PASSED ([^[:space:]]+\.cy\.(tsx|ts|jsx|js))/, arr3)) {
                # If AssertionError appears after "✓ PASSED", that test should be marked as failed
                last_test = arr3[1]
              }
            }
            END { if (last_test) print last_test }
          ' "$failed_test_files.running" 2>/dev/null)
          
          if [ -n "$test_file" ]; then
            echo "$test_file" >> "$failed_test_files"
          fi
        done < "$failed_test_files.errors"
      fi
      
      # Also check for our formatted "✗ FAILED" lines (most reliable - from real-time detection)
      grep "✗ FAILED" "$log_file" 2>/dev/null | \
        grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" >> "$failed_test_files" 2>/dev/null || true
      
      # Also check for Cypress summary format: "filename.cy.tsx (failed)"
      grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js).*\(failed" "$log_file" 2>/dev/null | \
        grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" >> "$failed_test_files" 2>/dev/null || true
      
      # Count unique failed test files
      local unique_failed=0
      if [ -f "$failed_test_files" ]; then
        unique_failed=$(sort -u "$failed_test_files" 2>/dev/null | grep -v '^$' | wc -l | tr -d ' \n')
        unique_failed=${unique_failed:-0}
      fi
      
      # Cleanup temp files
      rm -f "$failed_test_files" "$failed_test_files.running" "$failed_test_files.errors" 2>/dev/null || true
      
      # Count AssertionErrors as a sanity check
      local assertion_error_count=$(grep -c "AssertionError" "$log_file" 2>/dev/null || echo "0")
      assertion_error_count=$(echo "$assertion_error_count" | tr -d ' \n')
      assertion_error_count=${assertion_error_count:-0}
      
      # Use unique_failed as the primary count
      local max_failed=$unique_failed
      
      # If we have AssertionErrors but found fewer failed tests, we need to ensure we count them
      # This handles cases where test file extraction fails or AssertionError appears after test completion
      if [ "$assertion_error_count" -gt 0 ] 2>/dev/null; then
        # If we found fewer failed tests than AssertionErrors, try to extract more
        if [ "$max_failed" -lt "$assertion_error_count" ] 2>/dev/null; then
          # Look for test files near AssertionErrors more aggressively
          local additional_failed=$(grep -B50 "AssertionError" "$log_file" 2>/dev/null | \
            grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" | sort -u | wc -l | tr -d ' \n')
          additional_failed=${additional_failed:-0}
          if [ "$additional_failed" -gt "$max_failed" ] 2>/dev/null; then
            max_failed=$additional_failed
          fi
        fi
        # Ensure at least 1 failure if we have AssertionErrors and worker exited with error
        if [ "$max_failed" -eq 0 ] 2>/dev/null && [ "$worker_exit_failed" -gt 0 ] 2>/dev/null; then
          max_failed=1
        fi
      fi
      
      # If worker exited with error but we didn't detect failures, assume at least 1 failure
      if [ "$worker_exit_failed" -gt 0 ] 2>/dev/null && [ "$max_failed" -eq 0 ] 2>/dev/null; then
        max_failed=1
      fi
      
      # Calculate passed tests
      # Important: If a test has AssertionErrors, it should be marked as failed, not passed
      # So we need to ensure max_failed reflects all tests with AssertionErrors
      if [ "$all_tests" -gt 0 ] 2>/dev/null; then
        # Ensure max_failed doesn't exceed all_tests
        if [ "$max_failed" -gt "$all_tests" ] 2>/dev/null; then
          max_failed=$all_tests
        fi
        
        if [ "$max_failed" -gt 0 ] 2>/dev/null && [ "$max_failed" -le "$all_tests" ] 2>/dev/null; then
          WORKER_FAILED[$i]=$max_failed
          WORKER_PASSED[$i]=$((all_tests - max_failed))
        else
          WORKER_FAILED[$i]=0
          WORKER_PASSED[$i]=$all_tests
        fi
      else
        # Fallback: count from formatted output if available
        local passing_count=$(grep -c "✓ PASSED" "$log_file" 2>/dev/null || echo "0")
        passing_count=$(echo "$passing_count" | tr -d ' \n')
        passing_count=${passing_count:-0}
        
        # If we have failures detected, subtract them from passing count
        if [ "$max_failed" -gt 0 ] 2>/dev/null && [ "$passing_count" -ge "$max_failed" ] 2>/dev/null; then
          WORKER_PASSED[$i]=$((passing_count - max_failed))
          WORKER_FAILED[$i]=$max_failed
        else
          WORKER_PASSED[$i]=$passing_count
          WORKER_FAILED[$i]=${max_failed:-0}
        fi
      fi
      
      # Ensure values are clean integers (defensive)
      WORKER_PASSED[$i]=$(printf "%d" "${WORKER_PASSED[$i]:-0}" 2>/dev/null || echo "0")
      WORKER_FAILED[$i]=$(printf "%d" "${WORKER_FAILED[$i]:-0}" 2>/dev/null || echo "0")
      
      
      # Extract total tests from "Running:" lines with pattern (X of Y)
      local total=$(grep -oE "\([0-9]+\ of\ ([0-9]+)\)" "$log_file" | tail -1 | grep -oE "[0-9]+" | tail -1 | tr -d ' \n')
      if [ -z "$total" ]; then
        # Fallback: try to get from summary line like "Tests: 30"
        total=$(grep -oE "Tests?:\ +([0-9]+)" "$log_file" | tail -1 | grep -oE "[0-9]+" | head -1 | tr -d ' \n')
      fi
      if [ -n "$total" ] && [ "$total" -gt 0 ] 2>/dev/null; then
        WORKER_TOTAL[$i]=$(printf "%d" "$total" 2>/dev/null || echo "0")
      else
        # Last resort: use the count we already calculated
        if [ "$all_tests" -gt 0 ] 2>/dev/null; then
          WORKER_TOTAL[$i]=$all_tests
        else
          WORKER_TOTAL[$i]=0
        fi
      fi
      # Ensure clean integer
      WORKER_TOTAL[$i]=$(printf "%d" "${WORKER_TOTAL[$i]:-0}" 2>/dev/null || echo "0")
      
      # Extract failed test files from the raw Cypress log
      # Only extract if this worker has failures
      local worker_failed_clean=$(echo "${WORKER_FAILED[$i]:-0}" | tr -d '\n' | tr -d ' ')
      worker_failed_clean=${worker_failed_clean:-0}
      if [ "$worker_failed_clean" -gt 0 ] 2>/dev/null; then
        # 1. Extract from Cypress summary format like "card.cy.tsx/Card -- Layouts (failed"
        grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)/[^[:space:]]*\(failed" "$log_file" 2>/dev/null | \
          cut -d'/' -f1 | \
          sort -u | while read -r failed_test; do
          if [ -n "$failed_test" ]; then
            if ! grep -Fxq "$failed_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
              echo "$failed_test" >> "$FAILED_TESTS_FILE"
            fi
          fi
        done
        
        # 2. Extract test files that appear in lines with error messages
        # Look for test files in the same line or nearby lines with errors
        grep -B3 -A3 -E "(AssertionError|Error:|Timed out|expected.*to be|expected.*to contain)" "$log_file" 2>/dev/null | \
          grep -oE "[^/[:space:]]+\.cy\.(tsx|ts|jsx|js)" | \
          sort -u | while read -r failed_test; do
          if [ -n "$failed_test" ] && [ "$failed_test" != "cy." ] && [ "$failed_test" != ".cy." ]; then
            if ! grep -Fxq "$failed_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
              echo "$failed_test" >> "$FAILED_TESTS_FILE"
            fi
          fi
        done
        
        # 3. If we still don't have enough failed tests, extract from "Running:" lines
        # that appear before error messages (within 20 lines)
        local found_failed=$(wc -l < "$FAILED_TESTS_FILE" 2>/dev/null | tr -d ' ' || echo "0")
        found_failed=$(echo "$found_failed" | tr -d '\n' | tr -d ' ')
        local worker_failed=$(echo "${WORKER_FAILED[$i]:-0}" | tr -d '\n' | tr -d ' ')
        if [ -n "$found_failed" ] && [ -n "$worker_failed" ] && [ "$found_failed" -lt "$worker_failed" ] 2>/dev/null; then
          # Find lines with errors and look backwards for test file names
          grep -n -E "(AssertionError|Error:|Timed out)" "$log_file" 2>/dev/null | \
            cut -d: -f1 | \
            while read -r error_line; do
            # Look backwards up to 20 lines for a test file
            sed -n "$((error_line > 20 ? error_line - 20 : 1)),${error_line}p" "$log_file" | \
              grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" | \
              head -1 | while read -r failed_test; do
              if [ -n "$failed_test" ]; then
                if ! grep -Fxq "$failed_test" "$FAILED_TESTS_FILE" 2>/dev/null; then
                  echo "$failed_test" >> "$FAILED_TESTS_FILE"
                fi
              fi
            done
          done
        fi
      fi
    fi
  done
}

# Function to extract error messages for failed tests from log files
extract_error_messages() {
  # Create a temporary file to store test->error mappings
  local error_map_file=$(mktemp)
  
  # Process each worker's log file
  for ((i=1; i<=WORKERS; i++)); do
    local log_file="$LOG_DIR/worker-$i.log"
    if [ ! -f "$log_file" ]; then
      continue
    fi
    
    # Build a map of test execution lines (line number -> test file)
    # Extract test files and normalize paths
    local test_executions=$(mktemp)
    grep -n -E "(Running:\ +|▶ )" "$log_file" 2>/dev/null | \
      grep -E "\.cy\.(tsx|ts|jsx|js)" | \
      while IFS=: read -r line_num rest; do
        # Extract test file name (handle both "Running: path/to/test.cy.tsx" and "▶ path/to/test.cy.tsx")
        local test_path=$(echo "$rest" | grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" | head -1)
        if [ -n "$test_path" ]; then
          # Normalize the path
          local normalized=$(echo "$test_path" | sed 's|.*cypress/integration/||' | sed 's|webpack://.*/||' | sed 's|^\./||' | sed 's|^_N_E/\./||')
          echo "$line_num|$normalized" >> "$test_executions"
        fi
      done
    
    # Get all failed test files
    local failed_tests=$(grep -oE "[^[:space:]]+\.cy\.(tsx|ts|jsx|js)" "$FAILED_TESTS_FILE" 2>/dev/null | sort -u)
    
    while IFS= read -r test_file; do
      if [ -z "$test_file" ]; then
        continue
      fi
      
      # Normalize test file name for matching
      local normalized_test=$(echo "$test_file" | sed 's|.*cypress/integration/||' | sed 's|webpack://.*/||' | sed 's|^\./||' | sed 's|^_N_E/\./||')
      local test_basename=$(basename "$normalized_test")
      
      # Find test execution line numbers for this test
      # Try multiple matching strategies
      local test_line_nums=""
      
      # Strategy 1: Exact match on normalized path
      test_line_nums=$(grep "^[0-9]*|$normalized_test$" "$test_executions" 2>/dev/null | cut -d'|' -f1 | sort -n)
      
      # Strategy 2: Match by basename
      if [ -z "$test_line_nums" ]; then
        test_line_nums=$(grep "|.*$test_basename$" "$test_executions" 2>/dev/null | cut -d'|' -f1 | sort -n)
      fi
      
      # Strategy 3: Partial path match (handle cases like "onboarding/create-team.cy.tsx" vs "create-team.cy.tsx")
      if [ -z "$test_line_nums" ]; then
        test_line_nums=$(grep "|.*/$test_basename$" "$test_executions" 2>/dev/null | cut -d'|' -f1 | sort -n)
      fi
      
      # Strategy 4: Match any occurrence of the basename
      if [ -z "$test_line_nums" ]; then
        test_line_nums=$(grep "|.*$test_basename" "$test_executions" 2>/dev/null | cut -d'|' -f1 | sort -n)
      fi
      
      # Process each occurrence of this test
      for test_line_num in $test_line_nums; do
        if [ -z "$test_line_num" ]; then
          continue
        fi
        
        # Find the next test execution or end of file
        local next_test_line=$(awk -F'|' -v start="$test_line_num" '$1 > start {print $1; exit}' "$test_executions" 2>/dev/null)
        
        if [ -z "$next_test_line" ]; then
          # No next test, read to end of file (limit to 200 lines after test start)
          local end_line=$((test_line_num + 200))
          local file_lines=$(wc -l < "$log_file" | tr -d ' ')
          if [ "$end_line" -gt "$file_lines" ]; then
            end_line=$file_lines
          fi
        else
          local end_line=$next_test_line
        fi
        
        # Extract error messages between test start and next test
        # Look for AssertionError, Error:, Timed out, expected, etc.
        # Also look for Cypress failure formats and other error indicators
        local error_lines=$(sed -n "${test_line_num},${end_line}p" "$log_file" 2>/dev/null | \
          grep -E "(AssertionError|Error:|Timed out|expected.*to be|expected.*to contain|expected.*to equal|CypressError|Assertion failed|failed|FAILED|✗|Error|error)" | \
          grep -v "✓ PASSED" | grep -v "passing" | \
          head -10 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | grep -v '^$' | grep -v "^\[Worker")
        
        if [ -n "$error_lines" ]; then
          # Join multiple error lines with semicolons and truncate if too long
          local error_msg=$(echo "$error_lines" | head -5 | tr '\n' ';' | sed 's/;$/ /' | head -c 800)
          if [ -n "$error_msg" ] && [ "$error_msg" != " " ]; then
            # Store normalized test file -> error message mapping (avoid duplicates)
            if ! grep -q "^$normalized_test|" "$error_map_file" 2>/dev/null; then
              echo "$normalized_test|$error_msg" >> "$error_map_file"
            fi
          fi
        fi
      done
      
      # If still no error found, try a broader search around error messages
      if ! grep -q "^$normalized_test|" "$error_map_file" 2>/dev/null; then
        # Search for errors near the test file name (broader context)
        local error_context=$(grep -B10 -A10 -E "(AssertionError|Error:|Timed out|failed|FAILED|✗)" "$log_file" 2>/dev/null | \
          grep -B10 -A10 "$test_basename" | \
          grep -E "(AssertionError|Error:|Timed out|expected.*to be|expected.*to contain|expected.*to equal|failed|FAILED)" | \
          grep -v "✓ PASSED" | grep -v "passing" | \
          head -3 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | grep -v '^$' | grep -v "^\[Worker" | head -c 500)
        
        if [ -n "$error_context" ] && [ "$error_context" != " " ]; then
          echo "$normalized_test|$error_context" >> "$error_map_file"
        fi
      fi
      
      # Also check for Cypress summary format errors (test file name followed by error)
      if ! grep -q "^$normalized_test|" "$error_map_file" 2>/dev/null; then
        # Look for patterns like "test.cy.tsx (failed)" or "test.cy.tsx/ComponentName (failed)"
        local summary_error=$(grep -E "$test_basename.*\(failed|$test_basename.*FAILED|$test_basename.*✗" "$log_file" 2>/dev/null | \
          grep -E "(failed|FAILED|✗|Error|error)" | \
          head -2 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | grep -v '^$' | head -c 400)
        
        if [ -n "$summary_error" ] && [ "$summary_error" != " " ]; then
          echo "$normalized_test|$summary_error" >> "$error_map_file"
        fi
      fi
      
      # Last resort: find any error lines that appear after this test starts
      if ! grep -q "^$normalized_test|" "$error_map_file" 2>/dev/null; then
        # Find first occurrence of test, then look for any error patterns in next 100 lines
        local first_test_line=$(grep -n -E "(Running:\ +|▶ )" "$log_file" 2>/dev/null | \
          grep -E "$test_basename" | head -1 | cut -d: -f1)
        
        if [ -n "$first_test_line" ]; then
          local search_end=$((first_test_line + 100))
          local file_lines=$(wc -l < "$log_file" | tr -d ' ')
          if [ "$search_end" -gt "$file_lines" ]; then
            search_end=$file_lines
          fi
          
          local any_error=$(sed -n "${first_test_line},${search_end}p" "$log_file" 2>/dev/null | \
            grep -E "(AssertionError|Error:|Timed out|expected|failed|FAILED|✗)" | \
            grep -v "✓ PASSED" | grep -v "passing" | \
            head -2 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | grep -v '^$' | grep -v "^\[Worker" | head -c 400)
          
          if [ -n "$any_error" ] && [ "$any_error" != " " ]; then
            echo "$normalized_test|$any_error" >> "$error_map_file"
          fi
        fi
      fi
    done <<< "$failed_tests"
    
    rm -f "$test_executions"
  done
  
  # Return the error map file path
  echo "$error_map_file"
}

# Function to generate summary report
generate_summary() {
  # Parse statistics from log files for accuracy
  parse_log_statistics
  
  # Extract error messages for failed tests
  local error_map_file=$(extract_error_messages)
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
    # Clean and default values before arithmetic - use printf to ensure clean integers
    local passed_val=$(printf "%d" "${WORKER_PASSED[$i]:-0}" 2>/dev/null || echo "0")
    local failed_val=$(printf "%d" "${WORKER_FAILED[$i]:-0}" 2>/dev/null || echo "0")
    local total_val=$(printf "%d" "${WORKER_TOTAL[$i]:-0}" 2>/dev/null || echo "0")
    TOTAL_PASSED=$((TOTAL_PASSED + passed_val))
    TOTAL_FAILED=$((TOTAL_FAILED + failed_val))
    TOTAL_TESTS=$((TOTAL_TESTS + total_val))
    
    # Clean values for display using printf to ensure clean integers
    local display_passed=$(printf "%d" "${WORKER_PASSED[$i]:-0}" 2>/dev/null || echo "0")
    local display_failed=$(printf "%d" "${WORKER_FAILED[$i]:-0}" 2>/dev/null || echo "0")
    local display_total=$(printf "%d" "${WORKER_TOTAL[$i]:-0}" 2>/dev/null || echo "0")
    
    # Calculate worker duration
    local worker_start=${WORKER_START_TIME[$i]:-$OVERALL_START_TIME}
    local worker_end=${WORKER_END_TIME[$i]:-$OVERALL_END_TIME}
    local worker_duration=$((worker_end - worker_start))
    local worker_minutes=$((worker_duration / 60))
    local worker_seconds=$((worker_duration % 60))
    local worker_time_str=""
    if [ "$worker_minutes" -gt 0 ]; then
      worker_time_str="${worker_minutes}m ${worker_seconds}s"
    else
      worker_time_str="${worker_seconds}s"
    fi
    
    echo -e "${COLOR}Worker $i:${NC}"
    echo -e "  Port: $((8079 + i))"
    echo -e "  Status: ${WORKER_STATUS[$i]:-unknown}"
    echo -e "  Passed: ${SUCCESS_GREEN}${display_passed}${NC}"
    echo -e "  Failed: ${ERROR_RED}${display_failed}${NC}"
    if [ "$display_total" -gt 0 ] 2>/dev/null; then
      echo -e "  Total: ${display_total}"
    fi
    echo -e "  Duration: ${MOON_GOLD}${worker_time_str}${NC}"
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
  
  # Calculate and display total duration
  local total_duration=$((OVERALL_END_TIME - OVERALL_START_TIME))
  local total_minutes=$((total_duration / 60))
  local total_seconds=$((total_duration % 60))
  local total_time_str=""
  if [ "$total_minutes" -gt 0 ]; then
    total_time_str="${total_minutes}m ${total_seconds}s"
  else
    total_time_str="${total_seconds}s"
  fi
  echo -e "  Total Duration: ${MOON_GOLD}${total_time_str}${NC}"
  echo ""
  
  # Show failed tests if any
  if [ $TOTAL_FAILED -gt 0 ] && [ -f "$FAILED_TESTS_FILE" ]; then
    local failed_count=$(wc -l < "$FAILED_TESTS_FILE" | tr -d ' ')
    if [ "$failed_count" -gt 0 ]; then
      echo -e "${ERROR_RED}Failed Tests:${NC}"
      # Normalize and deduplicate test file names
      # Remove webpack paths, normalize to relative paths
      local normalized_failed=$(mktemp)
      while read -r test_file; do
        # Remove webpack:// paths and extract just the test file path
        local normalized=$(echo "$test_file" | sed 's|.*cypress/integration/||' | sed 's|webpack://.*/||' | sed 's|^\./||' | sed 's|^_N_E/\./||')
        # If it's still a full path, extract just the relative part
        if [[ "$normalized" =~ cypress/integration/ ]]; then
          normalized=$(echo "$normalized" | sed 's|.*cypress/integration/||')
        fi
        # Skip empty or invalid entries, but keep valid test file names
        if [[ -n "$normalized" ]] && [[ "$normalized" =~ \.cy\.(tsx|ts|jsx|js)$ ]]; then
          echo "$normalized" >> "$normalized_failed"
        elif [[ -n "$normalized" ]] && [[ "$normalized" =~ / ]]; then
          # Might be a directory path, try to extract filename
          local filename=$(basename "$normalized")
          if [[ "$filename" =~ \.cy\.(tsx|ts|jsx|js)$ ]]; then
            echo "$normalized" >> "$normalized_failed"
          fi
        fi
      done < "$FAILED_TESTS_FILE"
      
      # Sort and deduplicate, then display with error messages
      if [ -f "$normalized_failed" ]; then
        # Create sorted list in temp file to avoid subshell issues
        local sorted_failed=$(mktemp)
        sort -u "$normalized_failed" > "$sorted_failed"
        
        # Process each failed test and display with errors
        while IFS= read -r test_file; do
          echo -e "  ${ERROR_RED}✗${NC} $test_file"
          
          # Look up error message for this test
          local error_msg=""
          local test_basename=$(basename "$test_file")
          
          # Try exact match first from error map file
          if [ -n "$error_map_file" ] && [ -f "$error_map_file" ]; then
            error_msg=$(grep "^$test_file|" "$error_map_file" 2>/dev/null | cut -d'|' -f2- | head -1)
          fi
          
          # If no exact match, try matching by basename from error map file
          if [ -z "$error_msg" ] && [ -n "$error_map_file" ] && [ -f "$error_map_file" ]; then
            error_msg=$(grep "|.*$test_basename" "$error_map_file" 2>/dev/null | \
              grep "^[^|]*$test_basename|" | cut -d'|' -f2- | head -1)
          fi
          
          # Also check the real-time error capture file
          if [ -z "$error_msg" ] && [ -f "$FAILED_TESTS_ERRORS_FILE" ]; then
            error_msg=$(grep "^$test_file|" "$FAILED_TESTS_ERRORS_FILE" 2>/dev/null | cut -d'|' -f2- | head -1)
            if [ -z "$error_msg" ]; then
              error_msg=$(grep "|.*$test_basename" "$FAILED_TESTS_ERRORS_FILE" 2>/dev/null | \
                grep "^[^|]*$test_basename|" | cut -d'|' -f2- | head -1)
            fi
          fi
          
          # Last resort: search log files directly for errors related to this test
          if [ -z "$error_msg" ] || [ "$error_msg" == " " ]; then
            for ((j=1; j<=WORKERS; j++)); do
              local worker_log="$LOG_DIR/worker-$j.log"
              if [ ! -f "$worker_log" ]; then
                continue
              fi
              
              # Find test execution and extract errors that follow
              local test_line=$(grep -n -E "(Running:\ +|▶ )" "$worker_log" 2>/dev/null | \
                grep -E "$test_basename" | head -1 | cut -d: -f1)
              
              if [ -n "$test_line" ]; then
                # Look for errors in next 150 lines
                local search_end=$((test_line + 150))
                local file_lines=$(wc -l < "$worker_log" | tr -d ' ')
                if [ "$search_end" -gt "$file_lines" ]; then
                  search_end=$file_lines
                fi
                
                local direct_error=$(sed -n "${test_line},${search_end}p" "$worker_log" 2>/dev/null | \
                  grep -E "(AssertionError|Error:|Timed out|expected.*to be|expected.*to contain|expected.*to equal|failed|FAILED)" | \
                  grep -v "✓ PASSED" | grep -v "passing" | \
                  head -2 | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | grep -v '^$' | grep -v "^\[Worker" | head -c 500)
                
                if [ -n "$direct_error" ] && [ "$direct_error" != " " ]; then
                  error_msg="$direct_error"
                  break
                fi
              fi
            done
          fi
          
          # Display error message if found
          if [ -n "$error_msg" ] && [ "$error_msg" != " " ]; then
            # Clean up the error message (remove ANSI codes)
            local clean_error=$(echo "$error_msg" | sed 's/\x1b\[[0-9;]*m//g')
            # Split by semicolon and show first few error lines
            echo "$clean_error" | tr ';' '\n' | head -3 | while IFS= read -r err_line; do
              err_line=$(echo "$err_line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
              if [ -n "$err_line" ] && [ "$err_line" != " " ]; then
                echo -e "    ${MOON_VIOLET}→${NC} $err_line"
              fi
            done
          fi
        done < "$sorted_failed"
        
        rm -f "$normalized_failed" "$sorted_failed"
      fi
      
      # Cleanup error map file
      if [ -f "$error_map_file" ]; then
        rm -f "$error_map_file"
      fi
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

# Cleanup temporary files
if [ -f "$FAILED_TESTS_FILE" ]; then
  rm -f "$FAILED_TESTS_FILE"
fi
if [ -f "$FAILED_TESTS_ERRORS_FILE" ]; then
  rm -f "$FAILED_TESTS_ERRORS_FILE"
fi

# Exit with appropriate code
if [ $FAILED -eq 0 ] && [ $TOTAL_FAILED -eq 0 ]; then
  echo -e "${SUCCESS_GREEN}✓ All tests passed! ✨${NC}"
  exit 0
else
  echo -e "${ERROR_RED}✗ Some tests failed${NC}"
  exit 1
fi


