# EVODAO — AI Multi-Modal Agent Platform

[![Built with enter.pro](https://img.shields.io/badge/Build%20with-Enter.pro-FC5776?style=for-the-badge&labelColor=1F1F1F)](https://enter.pro)

**English** | [中文文档](./README.zh.md)

*Automatically synced with your [enter.pro](https://enter.pro) workspace*

---

## What is EVODAO?

EVODAO is an AI agent platform that takes a natural language goal, automatically breaks it into parallel sub-tasks, executes them simultaneously, and can self-reflect and evolve its output over multiple rounds.

### Core Features

| Feature | Description |
|---------|-------------|
| **Parallel Task Execution** | AI decomposes goals into sub-tasks and executes them concurrently |
| **Self-Evolution** | Agent reflects on results and iteratively improves them |
| **4 Output Modes** | Text, Build (code + ZIP), Q&A chat, Image generation |
| **Multi-Model** | GLM, Claude, GPT, Gemini, Doubao image models |
| **Long-Term Memory** | Cross-session memory retrieval for better context |
| **Usage Quotas** | Per-user run count + token consumption limits |
| **Subscription Plans** | Basic / Pro plans with auto-applied quota presets |
| **Admin Panel** | User management, memory viewer, quota & plan assignment |
| **i18n** | Full Chinese / English bilingual support |

### Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: Enter AI All (multi-model proxy)
- **i18n**: i18next

### Documentation

| Doc | Description |
|-----|-------------|
| [`docs/project-report.md`](./docs/project-report.md) | Full project retrospective & architecture |
| [`docs/db-schema.md`](./docs/db-schema.md) | Database schema reference |

---

## Project URLs

**Live app:** https://8f02c91ef0784272997f9a04c5d2fd3f-latest.preview.enter.pro  
**Edit & build in Enter:** https://enter.pro/project/8f02c91ef0784272997f9a04c5d2fd3f


---

## Continue building

Keep developing your app directly in [Enter.pro](https://enter.pro/project/8f02c91ef0784272997f9a04c5d2fd3f).  
Prompt new features, refine the UI, or connect integrations — all changes are versioned and synced automatically to GitHub.

---

## Local development

Prefer to work locally? You can clone this repo and start developing right away:

```bash
# Step 1: Clone your project repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate into the project folder
cd <YOUR_PROJECT_NAME>

# Step 3: Install all dependencies
npm install

# Step 4: Start the local development server
npm run dev
```

Push your commits — Enter.pro will automatically detect and sync your latest changes.

---

## Tech stack

This project uses:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

---

## Deployment

To deploy, open your Enter.pro project and click "Publish"

Your app will automatically build and go live at your production URL.

---

✨ Keep prompting, keep building — Enter.pro handles the rest.