# AI QA Use Case Platform

Monorepo:

- `backend/`: Node.js + TypeScript + Express + SQL Server
- `frontend/`: Astro + React + shadcn/ui
- `database/`: SQL schema + seed helper
- `prompts/`: QA generation system prompt file

## 1) Install dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

## 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Fill SQL Server, JWT, AI, Trello and encryption values.

Notes:

- `EMAIL_ENCRYPTION_KEY` must be 64 hex chars.
- `AI_PROMPT_PATH=../prompts/qa-use-cases-to-trello-prompt.txt` is the default expected path.
- Trello sync needs:
  - `TRELLO_KEY`
  - `TRELLO_TOKEN`
  - `TRELLO_LIST_ID_FUNCTIONAL`
  - `TRELLO_LIST_ID_NEGATIVE`
  - `TRELLO_LIST_ID_EDGE`
  - `TRELLO_LIST_ID_REGRESSION`

## 3) Create database and schema

Run `database/001_schema.sql` in SQL Server.

That script is idempotent and now includes:

- Database creation (`dwsaimanagement`)
- Core tables (`users`, `projects`, `qa_generation_runs`, `qa_use_cases`)
- New UI-integration tables:
  - `project_sessions`
  - `session_preview_cards`
  - `prompt_templates`

Then generate seed values:

```bash
npm run seed:sql
```

Execute the generated SQL to insert the first user.

## 4) Run backend

```bash
npm --prefix backend run dev
```

- Base URL: `http://localhost:4000`
- Health: `GET /health`

## 5) Run frontend

```bash
npm --prefix frontend run dev
```

- URL: `http://localhost:4321`

## Current flow

1. Create project (with `iconName`).
2. Open project and create sessions (also with `iconName`).
3. In session detail, process text with AI to create preview cards.
4. Review preview cards before sending to Trello.
5. Edit system prompt in Prompt Panel and save per user.

## API summary

Auth:

- `POST /api/auth/login`
- `GET /api/auth/me`

Projects:

- `GET /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects`

Sessions and preview:

- `GET /api/projects/:projectId/sessions`
- `POST /api/projects/:projectId/sessions`
- `GET /api/sessions/:sessionId`
- `POST /api/sessions/:sessionId/process-preview`
- `POST /api/sessions/:sessionId/send-to-trello`

Prompt templates:

- `GET /api/prompt-templates/system`
- `PUT /api/prompt-templates/system`