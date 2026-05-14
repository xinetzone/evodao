#!/bin/bash
# push-to-github.sh — One-click GitHub push for Enter.pro projects
# Repo: git@github.com:xinetzone/evodao.git
# Usage: bash push-to-github.sh

set -e

GITHUB_REPO="git@github.com:xinetzone/evodao.git"
BRANCH="main"

echo "=== GitHub Push Script for Enter.pro ==="
echo "Target: $GITHUB_REPO ($BRANCH)"
echo ""

# 1. Check for SSH key, generate if missing
if [ ! -f ~/.ssh/id_ed25519 ]; then
  echo "No SSH key found. Generating ed25519 key..."
  ssh-keygen -t ed25519 -C "enter-pro-push" -f ~/.ssh/id_ed25519 -N ""
  echo ""
  echo "=========================================="
  echo ">>> ADD THIS PUBLIC KEY TO GITHUB:"
  echo ">>> GitHub -> Settings -> SSH Keys -> New SSH Key"
  echo "=========================================="
  echo ""
  cat ~/.ssh/id_ed25519.pub
  echo ""
  echo "=========================================="
  read -p "Press Enter after adding the key to GitHub..."
else
  echo "SSH key found: ~/.ssh/id_ed25519"
fi

# 2. Test SSH connection to GitHub
echo ""
echo "Testing SSH connection to GitHub..."
SSH_RESULT=$(ssh -T git@github.com -o StrictHostKeyChecking=no 2>&1 | head -1 || true)
echo "$SSH_RESULT"

# 3. Configure GitHub remote (uses 'github' to avoid overwriting 'origin')
echo ""
echo "Configuring remote..."
git remote remove github 2>/dev/null || true
git remote add github "$GITHUB_REPO"
echo "Remote 'github' set to $GITHUB_REPO"

# 4. Show commits to be pushed
echo ""
echo "Commits to push:"
git log --oneline -5

# 5. Push
echo ""
echo "Pushing to GitHub ($BRANCH)..."
git push github HEAD:$BRANCH --force

echo ""
echo "=========================================="
echo "Done! Code pushed to:"
echo "https://github.com/xinetzone/evodao"
echo "=========================================="
