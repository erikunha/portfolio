#!/usr/bin/env bash
# ======================================================
# ErikOS 2026 — Principal Frontend Engineer Workstation
# ======================================================
#
# A battle-tested bootstrap for high-throughput AI-native
# frontend engineering on Apple Silicon macOS.
#
# What this script does:
#   - Homebrew + all CLI and GUI packages
#   - Fish shell + Starship prompt (no tide conflicts)
#   - mise as the ONLY runtime manager (no fnm, nvm, pyenv)
#   - Git: signed commits, delta pager, gitleaks hook (FIXED)
#   - AI tooling: Claude Code, ollama with good coding models
#   - Claude Code context budgets raised for skill quality
#   - Convention-aware shell functions for AI workflows
#   - macOS developer defaults
#
# Safe to rerun (idempotent). No hardcoded user paths.
# Works on arm64 and x86_64.
#
# Usage:
#   curl -fsSL <url> | bash
#   # or
#   bash install.sh
# ======================================================

set -euo pipefail
trap 'echo "Error on line $LINENO — aborting." >&2' ERR
IFS=$'\n\t'

START_TIME=$(date +%s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# ======================================================
# Helpers
# ======================================================

log()   { echo "  $*"; }
title() { echo ""; echo "── $* ──────────────────────"; }
ok()    { echo "  [ok] $*"; }
skip()  { echo "  [skip] $*"; }

command_exists() { command -v "$1" &>/dev/null; }

# ======================================================
# Architecture detection
# ======================================================

ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
  BREW_PREFIX="/opt/homebrew"
else
  BREW_PREFIX="/usr/local"
fi

# ======================================================
# 1. Homebrew
# ======================================================

title "Homebrew"

if ! command_exists brew; then
  log "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$("$BREW_PREFIX/bin/brew" shellenv)"
brew update --quiet
ok "Homebrew $(brew --version | head -1)"

# ======================================================
# 2. Core CLI Tools
# ======================================================

title "CLI Tools"

CLI_TOOLS=(
  # VCS
  "git"
  "gh"
  "git-delta"        # better diffs
  "lazygit"          # git TUI
  "git-absorb"       # automatic fixup commits

  # Search + navigation
  "fzf"
  "ripgrep"
  "fd"
  "zoxide"           # smart cd replacement

  # File viewers
  "jq"
  "bat"
  "eza"              # ls replacement
  "yq"               # YAML processor

  # Shell history
  "atuin"

  # Env management
  "direnv"
  "mise"             # single runtime manager for node/python/go/rust

  # HTTP + network
  "httpie"
  "websocat"
  "doggo"            # DNS lookup

  # Benchmarking + profiling
  "hyperfine"

  # System monitoring
  "btop"
  "dust"             # disk usage
  "procs"            # process viewer

  # Build utilities
  "mkcert"           # local HTTPS (missing from original)
  "watchman"         # file watcher for Next.js / React Native
  "tmux"             # session persistence

  # Codebase utilities
  "tokei"            # codebase metrics

  # Shell
  "fish"
  "starship"

  # Media (active use)
  "ffmpeg"
)

for tool in "${CLI_TOOLS[@]}"; do
  if brew list --formula "$tool" &>/dev/null; then
    skip "$tool already installed"
  else
    log "Installing $tool..."
    brew install "$tool" || log "WARN: $tool failed, continuing"
  fi
done

ok "CLI tools done"

# ======================================================
# 3. Security + Supply Chain Tools
# ======================================================

title "Security Tools"

SECURITY_TOOLS=(
  "gitleaks"   # secret scanning
  "trivy"      # vulnerability scanning
  "grype"      # container/package vuln scanner
  "syft"       # SBOM generator
  "cosign"     # artifact signing
  "age"        # file encryption
  "step"       # certificate management
)

for tool in "${SECURITY_TOOLS[@]}"; do
  brew list --formula "$tool" &>/dev/null || brew install "$tool" || true
done

ok "Security tools done"

# ======================================================
# 4. Containers + Kubernetes
# ======================================================

title "Containers"

CONTAINER_TOOLS=(
  "colima"
  "docker"
  "docker-compose"
  "lazydocker"
  "kubectl"
  "kubectx"
  "k9s"
  "act"          # GitHub Actions local runner
)

for tool in "${CONTAINER_TOOLS[@]}"; do
  brew list --formula "$tool" &>/dev/null || brew install "$tool" || true
done

# Start colima if not running
if command_exists colima && ! colima status &>/dev/null 2>&1; then
  log "Starting Colima (4 CPU, 8GB RAM, 60GB disk)..."
  colima start --cpu 4 --memory 8 --disk 60 || log "WARN: colima start failed"
fi

export DOCKER_BUILDKIT=1
ok "Containers done"

# ======================================================
# 5. Infrastructure
# ======================================================

title "Infrastructure"

INFRA_TOOLS=(
  "terraform"
  "awscli"
)

for tool in "${INFRA_TOOLS[@]}"; do
  brew list --formula "$tool" &>/dev/null || brew install "$tool" || true
done

ok "Infrastructure tools done"

# ======================================================
# 6. AI CLI Tools
# ======================================================

title "AI CLI Tools"

AI_TOOLS=(
  "ollama"   # local model runner
  "llm"      # multi-provider CLI
  "aichat"   # alternate AI chat
)

for tool in "${AI_TOOLS[@]}"; do
  brew list --formula "$tool" &>/dev/null || brew install "$tool" || true
done

ok "AI CLI tools done"

# ======================================================
# 7. GUI Applications (Casks)
# ======================================================

title "GUI Applications"

CASKS=(
  # Primary editor
  "zed"              # fast, AI-native editor (primary)
  "visual-studio-code"  # fallback + extensions ecosystem

  # Terminals
  "ghostty"          # GPU-accelerated, fastest terminal (new)
  "warp"             # AI terminal (fallback)
  # Note: iTerm2 intentionally excluded — Ghostty replaces it

  # Browsers (all needed for frontend cross-browser testing)
  "google-chrome"
  "brave-browser"
  "firefox"
  "zen-browser"      # privacy-focused, Firefox-based (new)

  # AI Desktop Apps
  "claude"           # primary AI (Claude desktop)
  "chatgpt"          # secondary AI (ChatGPT desktop)
  # Note: Codex, Copilot, Antigravity are AI app sprawl — install manually if needed

  # Communication
  "slack"
  "discord"
  "telegram"
  "whatsapp"
  "zoom"

  # Note-taking + knowledge
  "obsidian"
  "notion"

  # Media + entertainment
  "amazon-kindle"
  "prime-video"
  # "obs" — uncomment if streaming/recording

  # Developer tools
  "postman"
  "dbeaver-community"
  "mitmproxy"
  "devtoys"
  "utm"              # lightweight ARM64 VM (replaces Parallels for most dev use)

  # System utilities
  "raycast"          # launcher + automation (replaces Spotlight)
  "rectangle"        # window management
  "maccy"            # clipboard manager
  "betterdisplay"    # display management
  "monitorcontrol"   # external display brightness/volume
  "stats"            # menu bar system stats
  "hiddenbar"        # hide menu bar icons
  "alt-tab"          # better cmd-tab
  "karabiner-elements" # keyboard remapping
  "appcleaner"       # clean uninstall
  "shottr"           # screenshot + OCR
  "keepingyouawake"  # prevent sleep during builds

  # Logitech
  "logioptionsplus"
)

for cask in "${CASKS[@]}"; do
  if brew list --cask "$cask" &>/dev/null 2>&1; then
    skip "$cask already installed"
  else
    log "Installing $cask..."
    brew install --cask "$cask" || log "WARN: $cask failed, continuing"
  fi
done

ok "GUI applications done"

# ======================================================
# 8. Runtime Installation via mise
#    mise is the ONLY version manager.
#    fnm, nvm, and pyenv must not be installed.
# ======================================================

title "Language Runtimes (mise)"

# Verify competing managers are absent
for conflict in fnm pyenv; do
  if command_exists "$conflict"; then
    echo "  WARN: $conflict is installed alongside mise — this causes version conflicts."
    echo "  Run: brew remove $conflict"
  fi
done

mise install node@lts   || true
mise install python@latest || true
mise install go@latest  || true
mise install rust@stable || true
mise install bun@latest  || true  # fast script runner, not package manager

mise use --global node@lts    || true
mise use --global python@latest || true
mise use --global go@latest   || true
mise use --global rust@stable || true
mise use --global bun@latest  || true

# pnpm via corepack (Node.js package manager — the only one)
corepack enable pnpm || true
corepack prepare pnpm@latest --activate || true

ok "Runtimes done"

# ======================================================
# 9. mkcert — local HTTPS
# ======================================================

title "Local HTTPS (mkcert)"

if command_exists mkcert; then
  mkcert -install || log "WARN: mkcert -install failed (may need sudo)"
  ok "mkcert CA installed"
else
  log "WARN: mkcert not found — run: brew install mkcert && mkcert -install"
fi

# ======================================================
# 10. Ollama — Local AI Models
# ======================================================

title "Ollama Models"

# Register as a background service so it always runs
if command_exists ollama; then
  brew services start ollama || true

  # Pull modern coding-capable models
  # These replace llama3/codellama which are poor at coding
  OLLAMA_MODELS=(
    "qwen2.5-coder:14b"    # best local coding model, fits in 32GB
    "deepseek-r1:7b"       # reasoning model for architecture decisions
  )

  for model in "${OLLAMA_MODELS[@]}"; do
    log "Pulling ollama model: $model"
    ollama pull "$model" || log "WARN: failed to pull $model"
  done

  ok "Ollama configured as background service"
else
  log "WARN: ollama not found"
fi

# ======================================================
# 11. Git Configuration
# ======================================================

title "Git Configuration"

git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global rebase.autostash true
git config --global fetch.prune true
git config --global rerere.enabled true

# delta as pager (binary is 'delta', formula is 'git-delta')
if command_exists delta; then
  git config --global core.pager delta
  git config --global interactive.diffFilter "delta --color-only"
  git config --global delta.navigate true
  git config --global delta.light false
fi

# Editor — VSCode (blocking) for interactive git operations
# This correctly handles rebase -i, commit messages, merge conflicts
if command_exists code; then
  git config --global core.editor "code --wait"
elif command_exists zed; then
  git config --global core.editor "zed --wait"
else
  git config --global core.editor nano
fi

# SSH signing key (ed25519)
SSH_KEY="$HOME/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ]; then
  log "Generating SSH signing key..."
  ssh-keygen -t ed25519 -C "$(whoami)@$(hostname -s)" -f "$SSH_KEY" -N ""
fi

git config --global gpg.format ssh
git config --global user.signingkey "$SSH_KEY.pub"
git config --global commit.gpgsign true

# ──────────────────────────────────────────────────────
# CRITICAL FIX: Global git hooks directory
#
# core.hooksPath must be a DIRECTORY path, not a hook name.
# Setting it to "pre-commit" (hook name) means no hooks ever run.
# The directory is where all hooks live — git looks inside it.
# ──────────────────────────────────────────────────────
HOOKS_DIR="$HOME/.config/git/hooks"
mkdir -p "$HOOKS_DIR"
git config --global core.hooksPath "$HOOKS_DIR"

# gitleaks pre-commit hook — secret scanning on every commit
PRECOMMIT_HOOK="$HOOKS_DIR/pre-commit"
if [ ! -f "$PRECOMMIT_HOOK" ] || ! grep -q "gitleaks" "$PRECOMMIT_HOOK"; then
  cat > "$PRECOMMIT_HOOK" << 'HOOK'
#!/usr/bin/env bash
# Global pre-commit: scan staged files for secrets
if command -v gitleaks &>/dev/null; then
  gitleaks detect --no-git --staged -v || exit 1
fi
HOOK
  chmod +x "$PRECOMMIT_HOOK"
  ok "gitleaks pre-commit hook installed at $PRECOMMIT_HOOK"
fi

# Verify the fix works
ACTUAL_HOOKS_PATH="$(git config --global core.hooksPath)"
if [ "$ACTUAL_HOOKS_PATH" != "$HOOKS_DIR" ]; then
  echo "  WARN: core.hooksPath is '$ACTUAL_HOOKS_PATH', expected '$HOOKS_DIR'"
else
  ok "core.hooksPath correctly set to $HOOKS_DIR"
fi

ok "Git configured"

# ======================================================
# 12. Fish Shell
# ======================================================

title "Fish Shell"

FISH_BIN="$BREW_PREFIX/bin/fish"

# Add fish to valid shells if not already present
if ! grep -qF "$FISH_BIN" /etc/shells 2>/dev/null; then
  log "Adding fish to /etc/shells..."
  echo "$FISH_BIN" | sudo tee -a /etc/shells
fi

# Set fish as default shell
if [ "$SHELL" != "$FISH_BIN" ]; then
  log "Setting fish as default shell..."
  chsh -s "$FISH_BIN" || log "WARN: chsh failed — run manually: chsh -s $FISH_BIN"
fi

mkdir -p "$HOME/.config/fish/functions"

# ──────────────────────────────────────────────────────
# config.fish
# Key decisions:
#   - starship only (tide removed — conflicts with starship)
#   - mise only (fnm/nvm removed — three managers = version races)
#   - SLASH_COMMAND_TOOL_CHAR_BUDGET=100000 (was 24000 — was truncating skills)
#   - includeGitInstructions handled in Claude Code settings
# ──────────────────────────────────────────────────────
cat > "$HOME/.config/fish/config.fish" << 'FISHRC'

if not status is-interactive
    exit
end

# ── PATH ──────────────────────────────────────────────
fish_add_path /opt/homebrew/bin
fish_add_path /usr/local/bin
fish_add_path $HOME/.local/bin

# ── Locale ────────────────────────────────────────────
set -Ux LANG en_US.UTF-8
set -Ux LC_ALL en_US.UTF-8

# ── Editor ────────────────────────────────────────────
# code --wait blocks the shell until the file is closed (correct for git)
# Zed equivalent: zed --wait
if command -q code
    set -Ux EDITOR "code --wait"
else if command -q zed
    set -Ux EDITOR "zed --wait"
end

# ── Claude Code: raise context budgets ────────────────
# Default of 24000 truncates skills and deep-research outputs.
# 100000 allows full skill invocations without truncation.
set -Ux SLASH_COMMAND_TOOL_CHAR_BUDGET 100000

# ── GitHub token from macOS Keychain ──────────────────
# Store with: security add-generic-password -s github-pat -a "$USER" -w "<token>"
set -x GITHUB_PERSONAL_ACCESS_TOKEN (security find-generic-password -s github-pat -a "$USER" -w 2>/dev/null)

# ── Runtime manager (mise is the ONLY manager) ────────
if command -q mise
    mise activate fish | source
end

# ── Prompt: Starship ──────────────────────────────────
# tide is intentionally absent — it conflicts with starship
if command -q starship
    starship init fish | source
end

# ── Navigation ────────────────────────────────────────
if command -q zoxide
    zoxide init fish | source
end

if command -q atuin
    atuin init fish | source
end

if command -q direnv
    direnv hook fish | source
end

# ── Aliases ───────────────────────────────────────────
alias ll  'eza -lah --git --icons'
alias gs  'git status -sb'
alias gp  'git pull --rebase'
alias glog 'git log --oneline --graph --decorate -20'

# Route cd through zoxide (enforces habit adoption)
abbr --add cd z

# Guard: prevent npm muscle-memory from corrupting pnpm lockfiles
function npm
    if set -q argv[1]; and string match -q "install" $argv[1]
        echo "Use pnpm, not npm. Running: pnpm $argv"
        command pnpm $argv
    else
        echo "Use pnpm in this project. Forwarding to pnpm..."
        command pnpm $argv
    end
end

# ── AI Workflow Functions ──────────────────────────────

# convention-aware commit message generation
# Knows the feat(scope): description convention
function ai-commit
    set -l convention 'Write a git commit message. Format: type(scope): description\n\nRules:\n- type: feat|fix|chore|docs|style|refactor|perf|test|ci\n- scope: the feature area (hero, shell, contact, ci, deps, api, design-system, auth)\n- description: imperative present tense, lowercase, no period, max 72 chars\n- Return ONLY the commit message, no explanation, no quotes'
    git diff --staged | llm -s "$convention"
end

# generate a PR body from the diff vs main
function ai-pr
    set -l template ""
    if test -f .github/pull_request_template.md
        set template (cat .github/pull_request_template.md)
    else
        set template "## Summary\n\n## Type of change\n\n## Test plan\n\n## Visual changes"
    end
    git diff origin/main...HEAD | llm -s "Fill this PR template from the diff. Be specific and concrete. Template:\n$template"
end

# pipe git diff to LLM for analysis
function ai-diff
    git diff | llm
end

# ── Greeting ──────────────────────────────────────────
function fish_greeting
    set node_ver (node -v 2>/dev/null; or echo "N/A")
    set bun_ver  (bun --version 2>/dev/null; or echo "N/A")
    echo "  Node $node_ver  Bun $bun_ver"
end

FISHRC

ok "Fish configured"

# ======================================================
# 13. Starship Prompt
# ======================================================

title "Starship Prompt"

# Clean config — no emoji (causes rendering issues in some terminals)
# Optimized for speed and information density
cat > "$HOME/.config/starship.toml" << 'STARSHIP'
add_newline = false
command_timeout = 500

format = """
$directory$git_branch$git_status$nodejs$python$rust$go $character"""

[character]
success_symbol = ">"
error_symbol = "!"

[directory]
truncation_length = 3
truncate_to_repo = true

[git_branch]
symbol = ""
format = " [$symbol$branch]($style)"
style = "bold yellow"

[git_status]
format = "[$all_status$ahead_behind]($style) "
style = "bold red"
conflicted = "="
ahead = "+"
behind = "-"
diverged = "+-"
untracked = "?"
stashed = "$"
modified = "!"
staged = "+"
renamed = "r"
deleted = "d"

[nodejs]
format = " [node $version]($style)"
style = "bold green"
detect_files = ["package.json", ".nvmrc", ".node-version"]

[python]
format = " [py $version]($style)"
style = "bold blue"
detect_files = ["pyproject.toml", "requirements.txt", ".python-version"]

[rust]
format = " [rs $version]($style)"
detect_files = ["Cargo.toml"]

[go]
format = " [go $version]($style)"
detect_files = ["go.mod"]

[time]
disabled = true
STARSHIP

ok "Starship configured"

# ======================================================
# 14. Claude Code Settings
# ======================================================

title "Claude Code Settings"

CLAUDE_SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$HOME/.claude"

# Only update if file doesn't exist or doesn't have our key settings
if [ ! -f "$CLAUDE_SETTINGS" ] || ! grep -q '"skillListingBudgetFraction"' "$CLAUDE_SETTINGS" 2>/dev/null; then
  log "Writing Claude Code settings..."
  cat > "$CLAUDE_SETTINGS" << 'CLAUDEJSON'
{
  "cleanupPeriodDays": 180,
  "skillListingBudgetFraction": 0.08,
  "includeGitInstructions": true,
  "attribution": {
    "commit": "",
    "pr": ""
  },
  "permissions": {
    "allow": [
      "Bash",
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "NotebookEdit",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "Task",
      "TodoWrite",
      "Skill(*)"
    ]
  },
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
CLAUDEJSON
  ok "Claude Code settings written"
else
  skip "Claude Code settings already configured"
fi

# ======================================================
# 15. Zed Editor Settings
# ======================================================

title "Zed Editor"

# Zed syncs settings, extensions, keymaps, and themes via your Zed account.
# On a new machine: open Zed, sign in — settings restore automatically.
# This script does NOT write settings.json to avoid overwriting synced config.
#
# If you need a baseline (first-ever Zed setup, no account):
#   curl -fsSL https://gist.github.com/<your-gist>/zed-settings.json \
#     > ~/.config/zed/settings.json
#
# Key config that SHOULD be in your synced settings:
#   agent.default_model: claude-sonnet-4-6 (not 4-5, which is now outdated)
#   context_servers: sequential-thinking, github, playwright, chrome-devtools
#   lsp.typescript-language-server.tsserver.maxTsServerMemory: 8192

mkdir -p "$HOME/.config/zed"
ok "Zed: sign in to restore synced settings"

# ======================================================
# 16. macOS Developer Defaults
# ======================================================

title "macOS Defaults"

defaults write NSGlobalDomain AppleShowAllExtensions -bool true
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false

# Key repeat: fastest comfortable setting
defaults write NSGlobalDomain KeyRepeat -int 1
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Finder
defaults write com.apple.finder ShowPathbar -bool true
defaults write com.apple.finder ShowStatusBar -bool true
defaults write com.apple.finder _FXSortFoldersFirst -bool true

# Disable screenshot shadows
defaults write com.apple.screencapture disable-shadow -bool true

# Disable automatic termination of inactive apps
defaults write NSGlobalDomain NSDisableAutomaticTermination -bool true

# Disable Homebrew analytics
brew analytics off || true

killall Finder 2>/dev/null || true
ok "macOS defaults applied"

# ======================================================
# 17. VSCode CLI symlink + Settings Sync
# ======================================================

title "VSCode CLI"

# VSCode syncs settings, extensions, and keybindings via Settings Sync.
# On a new machine: open VSCode, sign in with GitHub → everything restores.
# This script only sets up the CLI shortcut.

VSCODE_APP="/Applications/Visual Studio Code.app"
VSCODE_CLI="$VSCODE_APP/Contents/Resources/app/bin/code"

if [ -f "$VSCODE_CLI" ] && [ ! -L "$BREW_PREFIX/bin/code" ]; then
  sudo ln -sf "$VSCODE_CLI" "$BREW_PREFIX/bin/code" || true
  ok "VSCode CLI linked"
else
  skip "VSCode CLI already linked or app not found"
fi

# Note: VSCode Settings Sync handles:
#   - User settings (settings.json)
#   - Keybindings
#   - Extensions (200+ are synced but consider workspace profiles to scope them)
#   - Snippets
# Sign in via: VSCode > Accounts > Turn on Settings Sync

# ======================================================
# 18. Cleanup: Remove Known Conflicting Tools
# ======================================================

title "Cleanup"

REMOVE_FORMULAE=(
  "fnm"    # conflicts with mise for node management
  "pyenv"  # conflicts with mise for python management
  "yarn"   # conflicts with pnpm
  "thefuck" # low value, atuin history is better
)

for formula in "${REMOVE_FORMULAE[@]}"; do
  if brew list --formula "$formula" &>/dev/null 2>&1; then
    log "Removing $formula (conflicts with preferred tool)..."
    brew remove "$formula" || log "WARN: could not remove $formula"
  fi
done

# Remove dead cask
if brew list --cask "fig" &>/dev/null 2>&1; then
  log "Removing fig (dead product, shut down in 2023)..."
  brew uninstall --cask fig || true
fi

# If tide fisher plugin is installed, remove it
# tide conflicts with starship when both are in config.fish
TIDE_INSTALLED=false
if command_exists fish; then
  if fish -c "fisher list" 2>/dev/null | grep -q "tide"; then
    TIDE_INSTALLED=true
  fi
fi

if $TIDE_INSTALLED; then
  log "Removing tide fisher plugin (conflicts with starship)..."
  fish -c "fisher remove ilancosman/tide@v5" || true
fi

ok "Cleanup done"

# ======================================================
# 19. Fisher (Fish Plugin Manager)
# ======================================================

title "Fish Plugins"

# Install fisher if not present
if ! fish -c "type -q fisher" 2>/dev/null; then
  log "Installing fisher..."
  fish -c "curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher" || true
fi

# Install fzf fish integration (only)
# nvm.fish intentionally excluded — mise handles node versions
if fish -c "fisher list" 2>/dev/null | grep -q "fzf"; then
  skip "fzf.fish already installed"
else
  fish -c "fisher install patrickf1/fzf.fish" || true
fi

ok "Fish plugins done"

# ======================================================
# 20. Summary
# ======================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "════════════════════════════════════════════════════"
echo "  ErikOS 2026 setup complete in ${DURATION}s"
echo ""
echo "  Next steps:"
echo "  1. exec fish                        -- activate new shell"
echo "  2. gh auth login                    -- GitHub CLI auth"
echo "  3. git config user.name 'Name'"
echo "  4. git config user.email 'email'"
echo "  5. Open Ghostty                     -- new terminal"
echo "  6. Open Zed, sign in                -- restores synced settings"
echo "  7. Open VSCode, sign in             -- restores Settings Sync"
echo "  8. Open Claude desktop, sign in"
echo "  9. Store GitHub PAT in Keychain:"
echo "     security add-generic-password -s github-pat -a \"\$USER\" -w '<token>'"
echo ""
echo "  Verify secret scanning is active:"
echo "  cd /tmp && git init test && cd test"
echo "  git commit --allow-empty -m test"
echo "  -- should run gitleaks"
echo ""
echo "  Verify Claude Code context budget:"
echo "  echo \$SLASH_COMMAND_TOOL_CHAR_BUDGET"
echo "  -- should print 100000"
echo "════════════════════════════════════════════════════"
echo ""
