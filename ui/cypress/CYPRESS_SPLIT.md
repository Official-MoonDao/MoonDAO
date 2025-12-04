# Cypress Test Parallelization with cypress-split

## Overview

Test parallelization for Cypress component tests using [cypress-split](https://github.com/bahmutov/cypress-split), significantly reducing test execution time and improving developer feedback loops.

## Problem

With 128 component tests running sequentially, test execution was taking:
- **Local**: 6-10 minutes
- **CI/CD**: 10-15 minutes

This created a bottleneck in the development workflow, slowing down PR reviews and developer productivity.

## Solution

Implemented cypress-split plugin for automatic test distribution with duration-based load balancing. Tests are now split across 4 parallel containers that run simultaneously, both locally and in CI.

## Performance Impact

| Environment | Before | After | Improvement |
|-------------|--------|-------|-------------|
| Local | 6-10 min | 2-3 min | **~70% faster** |
| CI/CD | 10-15 min | 3-5 min | **~70% faster** |

## Changes Made

### 1. GitHub Actions Workflow (`.github/workflows/ci.yml`)

- **Split component tests into 4 parallel jobs** using matrix strategy
- Each container runs a duration-balanced subset of tests (~32 tests each)
- Added timings cache for optimal test distribution across runs
- Each container starts its own Next.js dev server on port 3001

**Key changes:**
- Matrix strategy with `containers: [1, 2, 3, 4]`
- Environment variables: `SPLIT` and `SPLIT_TOTAL` for test distribution
- Separate artifact uploads per container to avoid conflicts
- Timings cache restoration for consistent performance

### 2. Cypress Configuration (`ui/cypress.config.js`)

- Integrated `cypress-split` plugin in component test setup
- Automatic test distribution based on duration data
- Zero manual configuration required

### 3. Dependencies (`ui/package.json`)

- Added `cypress-split@^1.24.2` to devDependencies

### 4. Git Configuration (`ui/.gitignore`)

- Added `.cypress-split-times` to gitignore (timings file generated after first run)

### 5. Test Script (`ui/scripts/test-parallel.sh`)

- Added parallel test execution script for local development
- Supports customizable number of workers
- Provides custom real-time progress tracking, consolidating all cypress worker processes into one view

## How It Works

### Intelligent Load Balancing

cypress-split uses test duration data to distribute tests optimally:

1. **First Run**: Tests distributed evenly by file count
2. **Subsequent Runs**: Tests distributed based on actual duration from previous runs
3. **Timings File**: Stores test durations in `.cypress-split-times` for optimal distribution
4. **Self-Optimizing**: Distribution improves with each run

## Usage

### Local Development

Run tests in parallel (4 workers):

```
yarn cy:run-ct:fast
```

Tests automatically run in 4 parallel containers on every push/PR. No additional configuration needed.

## Testing

- Verified parallel execution locally
- Confirmed test distribution across containers
- Validated CI workflow with matrix strategy
- Tested timings cache persistence

## Scaling Options

### Increase to 8 Containers (with great power...)

Update `.github/workflows/ci.yml`:

matrix:
  containers: [1, 2, 3, 4, 5, 6, 7, 8] # Expected performance: ~1-2 minutes

### Decrease to 2 Containers (Fewer Resources)

matrix:
  containers: [1, 2] # Expected performance: ~3-5 minutes

### Diminishing Returns: When More Workers Don't Help

There's a practical limit to parallelization effectiveness. Each worker incurs overhead:

- **Process overhead**: Starting/stopping Next.js dev servers, test runners, and log management
- **Resource consumption**: Memory, CPU, and network ports per worker
- **Distribution overhead**: Test splitting and coordination between workers
- **GitHub Actions build minutes**: Each parallel job consumes build minutes independently

**GitHub Actions Cost Consideration**: More parallel jobs multiply build minute consumption. Even if individual runs finish faster, total minutes consumed can be significantly higher:

- **4 workers**: 4 jobs × 3-5 min = **12-20 build minutes**
- **8 workers**: 8 jobs × 2-3 min = **16-24 build minutes** (slightly faster but ~20% more minutes)
- **16 workers**: 16 jobs × 1.5-2 min = **24-32 build minutes** (minimal speed gain, 60% more minutes)

**Minimum viable tests per worker**: Aim for at least **5-10 tests per worker** to amortize startup costs.

**With 128 tests:**
- **4 workers** = 32 tests/worker ✅ Optimal (best balance of speed and cost)
- **8 workers** = 16 tests/worker ✅ Good (faster but more expensive)
- **16 workers** = 8 tests/worker ⚠️ Marginal (diminishing returns, significantly more expensive)
- **32+ workers** = <4 tests/worker ❌ Overhead exceeds benefits, wasteful build minutes

## Resources

- [cypress-split GitHub](https://github.com/bahmutov/cypress-split)
- [Cypress Parallelization Docs](https://docs.cypress.io/guides/guides/parallelization)