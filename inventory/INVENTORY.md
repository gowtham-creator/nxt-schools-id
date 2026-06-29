# Development Environment Inventory
**Machine:** gowthams-macbook-pro · macOS 26.5.1 · Home `/Users/gowthamreddy`
**Project:** `/Volumes/WD Green SSD/Nxt Schools ID Card Sft` (external WD Green SSD)
**Generated:** 2026-06-29 · Discovered via context-mode sandbox (no context flooding)

> Raw machine dumps live beside this file: `claude-skills.txt`, `mcp-servers.json`,
> `npm-global.txt`, `npx-cache.txt`, `install-history.txt`, `claude-desktop-config.json`.

---

## 1. Runtimes & Package Managers
| Tool | Version | Notes |
|------|---------|-------|
| Node | v24.13.1 | via nvm (`~/.nvm/versions/node/v24.13.1`) |
| npm  | 11.8.0  | global prefix above |
| pnpm | 11.0.8  | installed global |
| bun  | 1.3.14  | installed (used by TalkToFigma via `bunx`) |
| yarn | —       | not installed |

**Native toolchains (from `brew` history):** node, jq, wget, git-lfs, **cocoapods**,
**flutter** (cask), **google-cloud-sdk** (cask), claude-code (cask).
→ Implies prior **mobile (Flutter/iOS)**, **Firebase/GCP**, and **Git LFS** capability.

## 2. Global npm Packages (9)
- `@anthropic-ai/claude-code@2.1.170` — this CLI
- `context-mode@1.0.39` — context-window protection (active in this project)
- `firebase-tools@15.11.0` — Firebase deploy/emulators
- `firecrawl-cli@1.15.2` — web scraping/crawling
- `uipro-cli@2.2.3` — UI scaffolding CLI
- `vercel@54.14.2` — Vercel deploy CLI
- `corepack`, `npm`, `pnpm` — tooling

## 3. npx-Invoked Packages (26 — from `~/.npm/_npx` cache)
Build/UI: `create-next-app`, `shadcn`, `getdesign`, `uilora`, `@21st-dev/magic`,
`impeccable`, `serve`, `tsx`, `puppeteer-core`
MCP/agent: `@playwright/mcp`, `chrome-devtools-mcp`, `@upstash/context7-mcp`,
`@modelcontextprotocol/server-sequential-thinking`, `mcp-three`, `add-mcp`, `ctx7`,
`cursor-talk-to-figma-mcp` (+socket)
Skills/workflow: `claude-mem`, `get-shit-done-cc`, `codeburn`, `skills`,
`@aidesigner/agent-skills`, `antigravity-awesome-skills`, `firecrawl-cli`, `vercel`

## 4. MCP Servers
**Global (9, active everywhere):**
| Server | Transport | Purpose |
|--------|-----------|---------|
| `supabase` | https://mcp.supabase.com/mcp | DB/auth/storage management |
| `context7` | npx `@upstash/context7-mcp` | live library docs *(API key in config — see §8)* |
| `serena` | uvx (oraios/serena) | semantic code navigation/editing |
| `playwright` | npx `@playwright/mcp` | browser automation/testing |
| `chrome-devtools` | npx `chrome-devtools-mcp` | perf/devtools |
| `magic` | npx `@21st-dev/magic` | AI UI component generation |
| `figma` | https://mcp.figma.com/mcp | Figma design read |
| `TalkToFigma` | bunx `cursor-talk-to-figma-mcp` | Figma read/write |
| `sequential-thinking` | npx MCP | structured reasoning |

**Project-scoped MCPs (other projects):** `my-clone`→playwright,miro · `cubixso`→mcp-three,blender,uilora · `nutrigreenz`→supabase

## 5. Claude Plugins & Marketplaces
**Enabled plugins (7):** `context-mode`, `frontend-design`, `figma`, `claude-mem`,
`python-development` (wshobson/agents), `vercel`, `andrej-karpathy-skills`.

**Marketplaces registered (11):** claude-plugins-official, claude-code-workflows,
context-mode, thedotmack/claude-mem, karpathy-skills, ui-ux-pro-max-skill,
addyosmani-agent-skills, antigravity-awesome-skills, understand-anything.

## 6. Claude Skills — 1471 user skills in `~/.claude/skills`
Plus plugin command-suites: **`gsd:` (Get-Shit-Done, ~45 cmds)** and **`sc:` (SuperClaude, ~30 cmds)**.
High-value clusters for THIS project (full list in `claude-skills.txt`):
- **Frontend/UI:** frontend-design, shadcn, ui-ux-pro-max, tailwind-design-system, radix-ui-design-system, nextjs-app-router-patterns, react-best-practices, magic-ui-generator
- **Backend/DB:** supabase-automation, nextjs-supabase-auth, postgresql, postgres-best-practices, database-design, database-architect, drizzle-orm-expert, prisma-expert, zod-validation-expert
- **Docs/Files:** pdf-official, xlsx-official, docx-official, file-uploads
- **Quality/Sec:** playwright-skill, webapp-testing, e2e-testing, security-audit, privacy-by-design, gdpr-data-handling, backend-security-coder
- **Architecture/PM:** backend-architect, system-architect, spec-driven-development, planning-with-files
- **Mobile (if needed):** flutter-expert, expo-*, react-native-architecture

**Subagents available:** backend-architect, frontend-architect, security-engineer, quality-engineer, system-architect, root-cause-analyst, requirements-analyst, refactoring-expert, deep-research, + many domain agents.

## 7. Active Claude Config (`~/.claude/settings.json`)
- `effortLevel: xhigh`, `skipDangerousModePermissionPrompt: true`, theme dark-daltonized, fullscreen TUI
- Auto-memory disabled (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`)
- **Hooks:** context-mode (PreToolUse/SessionStart), gsd-prompt-guard (Write/Edit), gsd-check-update, gsd-context-monitor (PostToolUse)

## 8. ⚠️ Security Flags
1. **context7 API key is stored in plaintext** in `~/.claude.json` (and copied into
   `inventory/mcp-servers.json`). Rotate it and move to an env var if this folder is ever shared/committed.
2. `skipDangerousModePermissionPrompt: true` is enabled globally — tool calls won't prompt. Be deliberate.
3. This project folder is **not a git repo** yet — init before writing app code so work is recoverable.
