# Action Tracker - CLAUDE.md

## What This App Is
An internal web app for ESG Global's sales team. It ingests meeting transcripts (pasted or uploaded as .docx), uses AI to automatically extract action items, and displays them on a shared Kanban board visible to all team members.

Built by Lewis Entwisle as a solo founder project using Claude as the primary development tool.

## Who It's For
5-10 internal ESG Global team members. Not a public-facing product.

## Live App
- **Vercel (dev/staging):** Connected to `esg-lewisent/action-tracker` on GitHub (personal repo)
- **AWS (prod target):** To be deployed via `Utiligroup/sales-enablement` org repo using Docker

## Tech Stack
- **Frontend:** React 18 + Vite
- **Database/Auth:** Supabase (temporary - migrating to AWS RDS Postgres)
- **AI Extraction:** OpenAI API (model: gpt-5-mini)
- **Drag and Drop:** Native HTML5 (replaced @dnd-kit and @hello-pangea/dnd due to jank issues)
- **File parsing:** mammoth (for .docx upload)
- **Hosting:** Vercel (staging), AWS (prod - pending)
- **Styling:** Plain CSS with CSS variables, DM Sans font

## Environment Variables
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=
For AWS Docker deployment, these are passed as build args (Vite bakes them in at build time).

## File Structure
/
├── public/
│   └── logo.svg              # ESG Global logo (used in nav + favicon)
├── src/
│   ├── App.jsx               # Root component, auth state, view routing, realtime subscription
│   ├── App.css               # All styles (single CSS file, no modules)
│   ├── main.jsx              # React entry point (StrictMode removed to fix drag issues)
│   ├── supabase.js           # Supabase client initialisation
│   └── components/
│       ├── Board.jsx         # Kanban board, filters, drag and drop, card rendering
│       ├── CardModal.jsx     # Card detail/edit modal (owner tags, client, due date, status)
│       ├── Login.jsx         # Email/password auth via Supabase
│       └── TranscriptUpload.jsx  # Transcript paste/upload, AI extraction, review, save
├── Dockerfile                # Multi-stage build (node builder + nginx serving)
├── nginx.conf                # Nginx config with SPA fallback routing
├── index.html                # Entry HTML, favicon, title
├── package.json              # Dependencies
└── vite.config.js            # Vite config

## Database (Supabase / RDS Postgres)

### Tables

**actions**
- id (uuid, primary key)
- title (text)
- owner (text) - legacy single owner field, kept for backwards compatibility
- owners (text[]) - array of owner names
- due_date (date)
- status (text) - 'todo' or 'done'
- comments (text)
- source_meeting (text) - meeting name from upload
- board_name (text) - which board this action belongs to
- client (text) - client/company this action relates to
- created_by (uuid) - references auth.users
- created_at (timestamptz)

**boards**
- id (uuid, primary key)
- name (text, unique)
- created_at (timestamptz)

### RLS
Both tables have RLS enabled with a single policy: authenticated users can do everything.

### Realtime
Enabled on the `actions` and `boards` tables via Supabase publication. The frontend subscribes to changes and re-fetches on any change. A `isDragging` ref prevents re-fetches mid-drag.

## Key Features Built

### Board (Board.jsx)
- Two columns: To Do / Done
- Native HTML5 drag and drop between columns
- Three multi-select filters: Board, Client, Owner
- Filter count shown in board meta
- Cards show: title, board tag (purple), client tag (blue), owner dots with initials, due date (colour coded: red = overdue, amber = due soon, green = on track)
- Delete board from filter dropdown with two-step confirmation
- Realtime sync across all users

### Card Modal (CardModal.jsx)
- Edit: title, owners (tag input with autocomplete), client, due date, board, status, comments
- Delete action with confirmation
- Source meeting shown as read-only

### Transcript Upload (TranscriptUpload.jsx)
- Paste transcript or drag/drop .docx file (mammoth extracts text)
- Click to upload .docx also supported
- AI extracts: title, client (per action), owners (array), due date, comments
- Streaming response with live progress bar and rolling action titles
- Review screen: edit all fields before saving
- Action summary table at bottom
- "Copy for email" copies an HTML table (styled with ESG blue header) to clipboard, pastes as formatted table in Outlook/Gmail
- All actions saved to Supabase in one insert

### Auth (Login.jsx)
- Email/password via Supabase Auth
- Sign up / sign in toggle
- Email confirmation disabled in Supabase (unnecessary for internal tool)

## Key Decisions Made

| Decision | What we chose | Why |
|---|---|---|
| Drag library | Native HTML5 | @hello-pangea/dnd and @dnd-kit both caused jank; native is handled by browser in C++ |
| AI model | gpt-5-mini | Sufficient for structured extraction, cheapest available on this OpenAI account |
| Multiple owners | Array field (owners text[]) | Meetings often assign actions to multiple people; single owner field kept for backwards compatibility |
| Client per action | Per-action field, not per-transcript | Meetings often cover multiple clients |
| Realtime | Supabase postgres_changes subscription | Simple, no extra infrastructure needed |
| Boards | Flexible user-created categories | Team uses different meeting types (Deal Reviews, Pipeline, etc.) |
| Email copy | HTML ClipboardItem | Tab-separated plain text doesn't render as table in email clients |

## What's Next (Pending)

### Immediate
- **Postgres/RDS migration** - moving away from Supabase to AWS RDS
- This requires building a Node/Express backend API layer since the React frontend cannot connect directly to Postgres from the browser
- Auth will need to move from Supabase Auth to JWT-based auth
- Realtime will become polling (every 30s) since Supabase realtime won't be available
- Your internal team is setting up RDS and will provide: Postgres URL, username, password

### Backend API needed (approximate endpoints)
- POST /auth/login
- POST /auth/register  
- GET /actions
- POST /actions
- PATCH /actions/:id
- DELETE /actions/:id
- GET /boards
- POST /boards
- DELETE /boards/:id

### Longer term (discussed but not built)
- Multiple owners tag input UI in CardModal (currently comma-separated text input in transcript upload, tag UI only in card modal)
- Usage analytics dashboard (currently using Supabase SQL queries manually)
- Admin-controlled user invites (currently open sign-up)

## Deployment

### Vercel (current staging)
- Connected to `esg-lewisent/action-tracker` (personal GitHub repo)
- Auto-deploys on push to main
- Environment variables set in Vercel dashboard

### AWS (target prod)
- Dockerfile and nginx.conf in repo root
- Multi-stage build: node:20-alpine builds the app, nginx:alpine serves the dist
- Build args required at docker build time:
```bash
docker build \
  --build-arg VITE_SUPABASE_URL=your_value \
  --build-arg VITE_SUPABASE_ANON_KEY=your_value \
  --build-arg VITE_OPENAI_API_KEY=your_value \
  -t action-tracker .
```
- Org repo: `Utiligroup/sales-enablement/action-tracker`
- Workflow: develop in personal repo → test on Vercel → copy files to org repo dev branch → PR to main → AWS team deploys

## Brand
- Primary colour: #006AB3 (ESG blue)
- Font: DM Sans
- Logo: /public/logo.svg (ESG Global SVG)