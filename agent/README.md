# MoonDAO Bug Detection Agent

An autonomous agent that scans the MoonDAO repository, runs tests across multiple browsers and viewports, detects bugs using AI, and creates fixes with minimal human intervention.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions (Trigger)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Cron (6hr)  │  │ Push Event  │  │ Issue Label (confirm)   │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Orchestrator                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Scanner  │→│ Tester   │→│ Analyzer │→│ Reporter │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                              │                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │                   │
│  │ Fixer    │←│ Reviewer │←│Confirmer │←────┘ (on label)       │
│  └──────────┘ └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌────────────────────────────┐
│   Playwright Tests  │              │      GitHub Issues/PRs     │
│  (Multi-browser)    │              │   (Human-in-the-loop)      │
└─────────────────────┘              └────────────────────────────┘
```

## Components

### 1. Scanner (`src/scanner.py`)
Monitors the git repository for changes since the last scan. Focuses on relevant UI/app changes and ignores documentation, tests, etc.

### 2. Tester (`src/tester.py`)
Runs Playwright tests across multiple configurations:
- **Browsers**: Chromium, Firefox, WebKit
- **Viewports**: Desktop, Tablet, Mobile
- **Wallet States**: Connected, Disconnected, Different Chains

### 3. Analyzer (`src/analyzer.py`)
Uses Claude AI to analyze test failures and determine:
- Whether it's a real bug or test flakiness
- Root cause analysis
- Affected files and components
- Severity and category classification
- Reproduction steps

### 4. Reporter (`src/reporter.py`)
Creates GitHub issues for detected bugs with:
- Detailed bug reports
- Evidence (screenshots, logs)
- Labels for categorization
- Suggested fix approach

### 5. Fixer (`src/fixer.py`)
Generates code fixes using Claude AI:
- Minimal, focused changes
- Type-safe TypeScript
- Following project conventions

### 6. Reviewer (`src/reviewer.py`)
Self-reviews generated fixes:
- Runs ESLint for linting
- Runs Prettier for formatting
- Checks TypeScript types
- Suggests improvements

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for containerized testing)

### Installation

```bash
# Install agent
cd agent
pip install -e .

# Install UI dependencies
cd ../ui
yarn install
npx playwright install --with-deps
```

### Configuration

Create a `.env` file in the `agent/` directory:

```env
ANTHROPIC_API_KEY=your_claude_api_key
GITHUB_TOKEN=your_github_pat
GITHUB_REPOSITORY=Official-MoonDao/MoonDAO
```

### GitHub Secrets

Add these secrets to your repository:
- `ANTHROPIC_API_KEY`: Claude API key
- `GITHUB_TOKEN`: Personal access token with repo/issues permissions

## Usage

### Run Manually

```bash
# Full detection cycle
python -m src.orchestrator run-cycle

# Handle bug confirmation
python -m src.orchestrator handle-confirmation 123

# Check status
python -m src.orchestrator status
```

### Via GitHub Actions

The agent runs automatically:
- **Every 6 hours** via scheduled workflow
- **On push** to main branch (optional)
- **On label** when `agent-confirmed` is added to an issue

### Docker

```bash
# Run full stack
docker-compose up

# Run just the agent
docker-compose run agent python -m src.orchestrator run-cycle
```

## Workflow

### Bug Detection Flow

1. **Scan**: Agent detects new commits in the repository
2. **Test**: Playwright runs exploratory tests across browsers/viewports
3. **Analyze**: Claude analyzes failures to identify real bugs
4. **Report**: Creates GitHub issues with detailed bug reports
5. **Wait**: Developer reviews and adds `agent-confirmed` label

### Bug Fixing Flow

1. **Confirm**: Developer adds `agent-confirmed` label to issue
2. **Generate**: Claude generates minimal code fix
3. **Review**: Agent self-reviews for quality and linting
4. **Test**: Runs regression tests to verify fix
5. **PR**: Creates pull request for developer review

## GitHub Labels

The agent uses these labels:

| Label | Purpose |
|-------|---------|
| `agent-detected` | Bug found by the agent |
| `needs-confirmation` | Waiting for human review |
| `agent-confirmed` | Human confirmed the bug |
| `fix-in-progress` | Agent is generating a fix |
| `fix-ready` | PR created for the fix |

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ANTHROPIC_API_KEY` | required | Claude API key |
| `GITHUB_TOKEN` | required | GitHub access token |
| `GITHUB_REPOSITORY` | `Official-MoonDao/MoonDAO` | Target repository |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `MAX_BUGS_PER_CYCLE` | `5` | Max bugs to report per run |
| `BASE_URL` | `http://localhost:3000` | App URL for testing |

## Self-Hosted Runner Setup

For Docker-based testing, we recommend a self-hosted runner:

### Option 1: EC2 Instance

```bash
# Launch t3.xlarge instance with Ubuntu 22.04
# SSH into instance

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install GitHub Actions runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz

# Configure runner
./config.sh --url https://github.com/Official-MoonDao/MoonDAO \
  --token YOUR_RUNNER_TOKEN \
  --labels self-hosted,linux,docker

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start
```

### Option 2: GitHub Larger Runners

Use `ubuntu-latest-16-cores` in workflows for more resources without self-hosting.

## Cost Estimation

| Component | Estimated Cost |
|-----------|---------------|
| Claude API | $10-50/day |
| Self-hosted Runner | $50-100/month |
| GitHub Actions | Free (or included) |

## Security Considerations

- Agent never has direct merge access
- All fixes require PR review
- Secrets are never exposed in logs
- Rate limiting on API calls
- No auto-merge enabled

## Troubleshooting

### Agent not detecting changes
- Check that `last_scan.txt` isn't stuck
- Verify git history is being fetched (`fetch-depth: 0`)

### Claude analysis failing
- Check API key is valid
- Review rate limits
- Check for quota issues

### Tests timing out
- Increase `PLAYWRIGHT_TIMEOUT`
- Check if app is starting correctly
- Review network conditions

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy src/

# Linting
ruff check src/
```

## License

MIT License - See LICENSE.md
