#!/bin/bash
# Drops Miguel Moncada-Larrotiz's commits from the current branch via interactive rebase.
# Run from repo root: ./ui/scripts/drop-miguel-commits.sh
# Make sure you're on launchpad-testing and have a clean working tree.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Safety checks
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "launchpad-testing" ]]; then
  echo "Error: You must be on launchpad-testing. Current branch: $CURRENT_BRANCH"
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "Error: Working tree is not clean. Commit or stash your changes first."
  git status --short
  exit 1
fi

echo "Fetching latest main..."
git fetch origin main

# Backup current branch (in case you need to restore)
BACKUP_BRANCH="launchpad-testing-backup-$(date +%Y%m%d-%H%M)"
echo "Creating backup branch $BACKUP_BRANCH..."
git branch "$BACKUP_BRANCH"

# Create temp script for GIT_SEQUENCE_EDITOR (runs in subshell, can't use exported functions)
EDITOR_SCRIPT=$(mktemp)
cat > "$EDITOR_SCRIPT" << 'EDITOR_EOF'
#!/bin/bash
# Change "pick" to "drop" for Miguel's commits
MIGUEL_COMMITS="90106d7a|2cb559b3|1f5e41c8|de93d50a|b55c3a89|8710a6e8|096467f8|1da89e8f|39c3a323|dd997597|59380aca|00da77a6|188c39e4|2b8f9643|1b44bd1b|8023f72c|b2842a51|759ad256|84e24c8b|2802ea11|bd8a0056"
sed -i.bak -E "s/^pick (${MIGUEL_COMMITS}) /drop \1 /" "$1"
rm -f "$1.bak"
EDITOR_EOF
chmod +x "$EDITOR_SCRIPT"

echo "Starting rebase - dropping 21 commits by Miguel..."
GIT_SEQUENCE_EDITOR="$EDITOR_SCRIPT" git rebase -i origin/main

rm -f "$EDITOR_SCRIPT"

echo ""
echo "Done! Miguel's commits have been dropped."
echo "Backup saved as $BACKUP_BRANCH (restore with: git reset --hard $BACKUP_BRANCH)"
echo ""
echo "If you had conflicts, resolve them and run: git rebase --continue"
