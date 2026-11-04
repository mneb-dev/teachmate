# TeachMate

A personal AI Teaching Assistant desktop application built with **Electron**, **React**, **Vite**,
**TypeScript**, **Tailwind CSS** and **Lucide React**.

TeachMate is **local-first**. There is no Express server, no cloud backend, no Supabase/Firebase and
no remote database. All application data will live on your machine.

> Status: project foundation only. The desktop shell, secure IPC bridge and tooling are in place.
> Teaching modules come next.

## Prerequisites

- **Node.js 20+** (developed on Node 24)
- **npm 10+**
- Windows, macOS or Linux

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` builds the main and preload scripts, starts the Vite dev server for the renderer and
opens the Electron window. Renderer changes hot-reload, and main/preload changes restart Electron
automatically.

> **Electron binary:** recent Electron versions download their binary the first time you run them,
> not during `npm install`, so the first `npm run dev` can take a little longer. To fetch it ahead of
> time, run `node node_modules/electron/install.js`.

## Scripts

| Script                 | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the app in development mode (HMR + auto-restart)     |
| `npm run build`        | Type-check, then build main/preload/renderer into `out/`   |
| `npm run preview`      | Run the production build from `out/` in Electron           |
| `npm start`            | Alias for `preview`                                        |
| `npm run typecheck`    | Type-check the Node side and the web side (`tsc --noEmit`) |
| `npm run lint`         | Run ESLint                                                 |
| `npm run lint:fix`     | Run ESLint with auto-fix                                   |
| `npm run format`       | Format the codebase with Prettier                          |
| `npm run format:check` | Check formatting without writing                           |
| `npm test`             | Run unit tests (Vitest): storage, validation, AI handoff   |

## Project structure

```
teachmate/
├─ electron.vite.config.ts   # One Vite config for main, preload and renderer
├─ tsconfig.json             # Project references
├─ tsconfig.node.json        # Main + preload + shared (Node/Electron types)
├─ tsconfig.web.json         # Renderer + shared (DOM types, JSX)
├─ eslint.config.js          # ESLint flat config (TS, React hooks, Prettier)
├─ .prettierrc               # Prettier + Tailwind class sorting
├─ resources/                # App icons and static assets for packaging (later)
└─ src/
   ├─ shared/
   │  ├─ ipc.ts              # IPC contract: channel names + types (single source of truth)
   │  ├─ ai.ts               # Provider-independent AI types (capabilities, requests, results)
   │  ├─ conversations.ts    # Conversation/message/attachment model + size limits
   │  ├─ documents.ts        # Teaching document model (lesson plans, objectives)
   │  ├─ document-rules.ts   # Form validation + content checks (shared by UI and main)
   │  ├─ calculation-rules.ts # Assessment/TOS validation, answer-key check, save-blocking checks
   │  ├─ tos.ts              # Bloom distribution + TOS maths (exact row/column totals)
   │  ├─ rubric.ts           # Rubric model + scoring maths, reading AI rubric tables
   │  ├─ activities.ts       # Learning activity categories, activity parser/merger, checks
   │  ├─ annotation.ts       # DLL annotation settings + paragraph/length/claim checks
   │  ├─ review.ts           # Lesson plan review criteria, report reader, checks, revisions, diff
   │  ├─ resources.ts        # Teaching Resources model, tag helpers
   │  ├─ document-text.ts    # Suggested titles and summaries
   │  └─ teaching.ts         # Formats, Bloom levels, domains, curriculum, defaults
   ├─ main/                  # Electron main process (Node.js)
   │  ├─ index.ts            # App lifecycle, window creation, security hardening
   │  ├─ services.ts         # Creates stores + AI providers under the user data folder
   │  ├─ ai/
   │  │  ├─ provider.ts      # AIProvider interface (implement this to add a provider)
   │  │  ├─ registry.ts      # Registered providers
   │  │  ├─ prompts/         # Prompt builders: chat, lesson plan, objectives
   │  │  ├─ runner.ts        # Runs prompts through a provider (with cancel)
   │  │  ├─ handoff/         # Markdown rendering, claude-cli:// deep links, saved prompts
   │  │  └─ providers/       # claude-code-handoff.ts (more providers go here)
   │  ├─ attachments/        # DOCX / PDF / TXT / MD text extraction
   │  ├─ export/             # Word (.docx) export: Markdown → DOCX, TOS table
   │  ├─ storage/            # Conversation, document + settings stores, validation, atomic writes
   │  └─ ipc/                # One file per area; every argument is validated
   ├─ preload/
   │  ├─ index.ts            # contextBridge: exposes window.teachmate
   │  └─ index.d.ts          # Window typings for the renderer
   └─ renderer/              # React UI (browser context, no Node)
      ├─ index.html          # Includes a strict Content-Security-Policy
      └─ src/
         ├─ main.tsx         # React entry
         ├─ app/
         │  ├─ App.tsx       # Router (HashRouter) + theme provider
         │  └─ navigation.ts # Sidebar items, routes and page metadata (single source of truth)
         ├─ components/
         │  ├─ layout/       # AppLayout, Sidebar, Topbar
         │  └─ ui/           # Card, Button, Badge, IconTile, PageHeader, SegmentedControl, …
         ├─ features/
         │  ├─ activities/   # Learning activities form + per-activity manager
         │  ├─ annotation/   # DLL annotation form (DLL source picker)
         │  ├─ assessment/   # Assessment form + question-type mixer
         │  ├─ assistant/    # AI Assistant: useAssistant state hook + chat components
         │  ├─ documents/    # Shared planning-tool workflow: editor hook, workspace, tool page
         │  ├─ lesson-planner/ # Lesson plan form
         │  ├─ objectives/   # Learning objectives form
         │  ├─ performance-task/ # Performance task form
         │  ├─ review/       # Lesson Plan Reviewer form, review summary, revised-plan panel
         │  ├─ rubric/       # Rubric settings, editor and score summary
         │  ├─ tos/          # TOS form + editable table
         │  ├─ dashboard/    # Dashboard sections (welcome, quick actions, recent items, status)
         │  └─ settings/     # Settings sections (AI provider, teaching defaults)
         ├─ pages/           # One per route (+ the shared PlaceholderPage)
         ├─ theme/           # ThemeProvider, light/dark mode, primary color presets
         ├─ hooks/           # useMediaQuery, useAppInfo
         ├─ data/sample.ts   # SAMPLE data for UI previews only (to be replaced by real data)
         ├─ lib/             # IPC bridge access, formatting, preferences, cn()
         └─ styles/index.css # Tailwind v4 entry + design tokens
```

Path aliases: `@renderer/*` points to `src/renderer/src/*`, and `@shared/*` points to `src/shared/*`.

## Design system

- **Colors.** The interface uses three: **primary** (magenta by default), **neutral** (surfaces,
  borders, text) and **success** (status only). They're defined as CSS variables in
  `styles/index.css`, with separate values for light and dark mode.
- **Primary color.** It's set from a single OKLCH hue (`--primary-hue`). Users can change it in
  **Settings → Appearance** with a preset or the custom hue slider.
- **Theme.** Light, Dark or System. It's applied as a `.dark` class on `<html>`, and the top bar
  has a quick toggle.
- **Saved preferences.** Theme, primary color and sidebar state are UI preferences saved per
  device in `localStorage`.

## Adding a new page

1. Add an entry to `NAV_GROUPS` in `app/navigation.ts`: label, path, icon, description and
   planned features. The sidebar, route, top-bar title and placeholder page are created from it
   automatically.
2. When the module is ready, give its path its own page in `app/App.tsx`, replacing the
   `PlaceholderPage`.

## Security model

The renderer is treated as untrusted web content:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- The preload script exposes **only named, purpose-specific functions** on `window.teachmate`. It
  never exposes `ipcRenderer`, a generic `invoke(channel)`, the filesystem or shell execution.
- Every IPC handler in the main process checks that the call comes from the app's own page (the dev
  server URL or `file://`) and validates its arguments.
- Navigation away from the app is blocked. `window.open` is denied, and only `https:` links are
  passed to the system browser.
- All permission requests (camera, microphone, geolocation, notifications, …) are denied by default.
- A strict CSP (`script-src 'self'`) is set in `index.html`.
- ESLint stops renderer code from importing `electron` or Node built-ins.

## Adding a new IPC capability

1. **Contract.** Add a channel name to `IpcChannel`, add its types to `IpcContract`, and add the
   function signature to `TeachMateApi` in `src/shared/ipc.ts`.
2. **Main.** Implement the handler (validate every argument!) under `src/main/ipc/` and register it
   with `handle(...)` in `src/main/ipc/index.ts`.
3. **Preload.** Add the matching function to the `api` object in `src/preload/index.ts`.
4. **Renderer.** Call it through `teachmate` from `@renderer/lib/ipc`.

Filesystem access, local data storage and any future AI-provider calls all belong in the main process,
behind specific IPC functions like these.

## Local data

Everything is stored under Electron's per-user data folder (`app.getPath('userData')`), for
example `%APPDATA%\TeachMate` on Windows. Nothing is sent to a remote server.

| Path                       | Contents                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `conversations/<id>.json`  | One file per conversation (messages + extracted document text)                                  |
| `documents/<id>.json`      | All teaching documents: lesson plans, objectives, assessments, TOS, tasks, rubrics, annotations |
| `resources/<id>/`          | Teaching Resources: `original.<ext>` (untouched copy), `extracted.txt`, `resource.json`         |
| `handoffs/handoff-<id>.md` | Prompts prepared for Claude Code                                                                |
| `settings.json`            | App settings (Claude Code workspace folder, teaching defaults)                                  |
| `Local Storage/`           | UI preferences only (theme, primary color, sidebar state)                                       |

**Safe file operations:**

- JSON files are written atomically (temp file + rename), and everything the renderer sends is
  validated in the main process before it is written.
- Imported files are copied with exclusive flags into a new folder, so nothing in the library is
  ever overwritten. A broken import leaves nothing behind.
- **Exports never overwrite silently.** If the chosen file already exists, TeachMate asks "Replace
  it?" and only writes after you confirm.
- **Automatic saving:** once a document has been saved, later edits are saved about 1.5 seconds
  after you stop typing, as long as its calculations are valid.

## Teaching Resources

Teaching Resources is a local library of DOCX, PDF, TXT and Markdown files
(`src/main/storage/resource-store.ts`).

- **Add files:** choose files from your computer. The **original is preserved byte for byte**,
  and its text is extracted for previews and AI prompts. Duplicates are detected by content and
  only added when you choose **Add anyway**.
- **Organise:** each file can have a title, subject, grade level, tags and a description.
- **Search** covers titles, tags, descriptions and the text inside the files, with filters for
  subject, grade and tag.
- **Preview:** Markdown files are shown rendered; other files show their extracted text. **Open
  original** opens the preserved file in its usual app.
- **Delete** asks for confirmation and removes only TeachMate's copy.
- **Use in the tools:** every tool's reference picker has **From library**, which sends a
  library file's text as a reference.

## DLL Annotation

1. **Choose the DLL:** upload one (it's kept in the library), pick it from Teaching Resources, or
   use a saved lesson plan. Its full text is stored with the annotation.
2. **Set the annotation:** an optional focus (e.g. a PPST indicator, pasted exactly), the number
   of paragraphs (1–5), the length (Short 50–80, Medium 90–130 or Long 140–200 words per
   paragraph), the perspective and the language.
3. **Prepare the prompt:** it uses the **entire lesson** and requires professional, concise
   language, an accurate reflection of the lesson, **no unsupported claims**, plain paragraphs and
   **exactly** the requested number of paragraphs ("Write exactly ONE paragraph").
4. **Check the result:** after you paste or edit the annotation, TeachMate checks the paragraph
   count, the words per paragraph and the formatting (no headings or lists). It also checks that
   **every figure** appears in the lesson; anything else is flagged as unsupported. **Join into one
   paragraph** fixes the count in one click.
5. **Edit, save (with autosave) and export** to Word or Markdown.

## Lesson Plan Reviewer

A quality check for a lesson plan before it is taught. It uses the same AI workflow as the other
tools (handoff or API provider, preview prompt, paste reply, edit, revise, save, version history,
Word export; Markdown export from Saved Documents).

1. **Choose the plan:** upload a DOCX or PDF (kept in Teaching Resources), pick it from the library
   or a saved lesson plan, or paste the text. The full text is stored with the review and is never
   changed. TeachMate suggests the plan type (DLL, DLP, Semi-Detailed, Multi-Day or Weekly) from
   the text; a saved lesson plan uses its own format.
2. **Configure:** review depth (Quick or Comprehensive), focus (Overall, Objectives, Activities,
   Assessment or Time allocation), the school's formatting requirements, additional instructions,
   and optional curriculum references (so official alignment can be checked against them).
3. **The review** covers eight criteria (A. Curriculum and Competency Alignment … H. Overall Lesson
   Structure). Each gets a status (Meets Expectations, Needs Improvement or Missing), evidence quoted
   from the plan, an explanation and a recommendation. The report also includes an overall
   evaluation, an **objective and assessment alignment table** with the four kinds of gaps,
   critical/recommended/optional improvements, and the assumptions made. The prompt forbids
   numerical scores (unless requested), invented DepEd policies or codes, and compliance claims
   without a supplied standard. It also separates "missing" from "cannot be judged from the plan".
4. **Review summary (TeachMate):** the status of each criterion, improvement counts and alignment
   gaps, read from the report. **Checks:** missing sections or criteria, statuses outside the three
   allowed, scores that weren't requested, compliance claims, DepEd orders and curriculum codes that
   aren't in the plan or references, and evidence quotes that don't appear in the plan word for
   word.
5. **Revised lesson plan:** rewrite the objectives, improve the activities, assessment, time
   allocation or named sections, or write a revised complete plan, starting from the original or the
   latest revision. Revisions are stored **separately** with the review (up to 5). The original plan
   and the review report are never replaced. Compare them **side by side** or as **changes**, which
   ignore formatting differences. **Save as new lesson plan** creates a separate lesson plan
   ("… (revised)") linked from the review.

## Saved Documents

- **Categories** with counts: Lesson Plans, Objectives, Activities, Assessments, TOS, Performance
  Tasks, Rubrics, Annotations and Reviews.
- **Search, open and edit** (each document opens in its tool), **rename**, **delete** (with
  confirmation), **export to Word** and **export to Markdown**.
- **Import a file** as a new lesson plan, objectives, activity set, assessment, performance task or
  annotation.
  Word files keep headings and lists, and the original is kept in Teaching Resources. TOS and
  rubrics are calculated, so they can't be imported.

## Planning tools (Lesson Planner, Learning Objectives)

Both tools use the same workflow (`src/renderer/src/features/documents/`):

1. **Collect.** The form is checked inline using rules shared with the main process
   (`src/shared/document-rules.ts`).
2. **Attach references.** You can attach DOCX, PDF, TXT or MD files, such as a curriculum guide or
   competency list. Their text is extracted in the main process.
3. **Prepare the prompt.** The main process builds a structured prompt from the **saved** document
   (`src/main/ai/prompts/lesson-plan.ts`, `objectives.ts`). **Preview prompt** shows exactly what
   will be sent.
4. **Send.** The prompt goes through the selected provider. Today that's the Claude Code handoff;
   an API provider would return the content directly.
5. **Display.** The content comes from the provider or from Claude's reply pasted back. TeachMate
   never invents content.
6. **Edit.** Switch to the Markdown **Edit** tab. **Preview** renders it.
7. **Revise.** Describe the changes you want. The prompt includes the current content plus your
   instruction, and you get back a complete revised document.
8. **Save.** Documents are saved locally. Up to 10 earlier versions are kept and can be restored.
   Find everything again under **Saved Documents**.

**Lesson plan formats:** Daily Lesson Log (DLL), Detailed (DLP), Semi-Detailed, Multi-Day and
Weekly. Each format has its own required structure and session limits. Curriculum: DepEd K-12
(DO 42, s. 2016 procedure steps), MATATAG (MATATAG procedure phases), ILAW (ILAW lesson phases,
taken from your ILAW reference documents), or **Auto**, which uses ILAW or MATATAG if the reference
documents follow one and K-12 otherwise.

**Learning objectives:** these use Bloom's Revised Taxonomy (Remembering → Creating), with a bank of
measurable verbs for each level. They cover the cognitive, psychomotor and affective domains
(psychomotor and affective only where they fit), use the ABCD form where practical, and give
assessment evidence for each objective.

**Alignment:** every prompt requires that each objective is practiced by an activity and checked by
an assessment. Lesson plans end with an "Alignment check" table.

**Curriculum codes are never invented.** The competency code field is filled in only by you. With
no code, the prompt forbids the model from inventing or guessing codes and asks for "Code: not
provided" instead. TeachMate also scans the content and flags any DepEd-style code (e.g.
`S8FE-Ia-15`) that doesn't appear word for word in your inputs or reference documents. It flags
objectives that use non-measurable verbs ("understand", "know", "appreciate", …) too.

**Teaching defaults** (**Settings → Teaching defaults**) pre-fill new documents. Out of the box:
Philippines, DepEd K-12 / MATATAG (auto), Grade 8, Computer Education / ICT, 60 minutes, English.

**Your profile** (**Settings → Your profile**) sets how the dashboard greets you. Enter your name and
choose **Ma’am**, **Sir** or **Name only**, e.g. "Good morning, Ma’am Liza". Until it's set, the
greeting says "Teacher". The profile is saved in the local settings file.

## Learning Activities

Learning Activities uses the same AI workflow as the planning tools (handoff or API provider,
preview prompt, paste reply, edit, revise, save, version history, Word and Markdown export).

- **Form:** subject, grade level, quarter, topic, competency (and optional code), learning
  objectives (**Use saved objectives** copies them from a saved Learning Objectives document),
  duration, number of activities, class size, available resources, learning environment, difficulty
  and additional instructions.
- **Categories (multi-select):** Motivation / Icebreaker, Introduction of Lesson, Guided Practice,
  Individual, Pair, Group, Collaborative Learning, Hands-on, Problem-Based, Project-Based,
  Inquiry-Based, Differentiated Instruction, Review / Reinforcement, Application / Enrichment,
  Assessment Activity, Reflection / Generalization.
- **Each activity** has a title, type, learning purpose, aligned objectives, estimated duration,
  materials, teacher instructions, student instructions, step-by-step procedure, expected output,
  assessment and (when appropriate) differentiation. The prompt asks for learner-centered,
  competency-based, grade-appropriate, low-cost activities whose durations fit the time available.
- **Checks (TeachMate, not the AI):** at least 5 minutes per activity before generating; after a
  reply, the number of activities, missing parts in each activity, and whether the estimated
  durations add up to more than the time available.
- **Per activity:** copy its instructions (student instructions + steps), or **regenerate** just
  that activity. The reply replaces only that activity; TeachMate merges it and renumbers.
- **Generate alternatives:** 1–5 new activities with different approaches, added after the current
  ones.
- **Add to lesson plan:** select activities and choose a saved lesson plan. They are appended as a
  "Learning Activities" section at the end; the plan's previous content stays in its history.

## Assessment Builder

The Assessment Builder uses the same workflow as the planning tools. Its form adds:

- **Question types:** multiple choice, true or false, identification, matching type, short answer,
  essay and problem solving. You mix several types with item counts, and the counts **must add
  up** to the number of questions. The total is shown live.
- **Bloom's distribution:** percentages, either **grouped** (Remembering + Understanding /
  Applying + Analyzing / Evaluating + Creating) or across **all six levels**. They must total
  100%. Item counts are derived exactly with the largest-remainder method, so 60/30/10 of 20 items
  gives 12/6/2.
- **Difficulty, explanations and references.** Difficulty sets the overall level, the answer key
  can include explanations, and reference documents can be attached.
- **Type-vs-level advice:** a warning appears when the chosen question types can't assess the
  requested levels, for example Evaluating items with only True or False.

The prompt sets out the test parts with continuous item numbers, the Bloom's table (or the TOS
allocation), item-writing rules for each type, an **Answer Key** table, a **Scoring Guide** for
open-ended items and a **Bloom's Taxonomy Summary**. After you paste the reply, TeachMate checks
that the answer key lists every item from 1 to N exactly once.

## Table of Specifications

The TOS is **calculated by TeachMate**; no AI is involved (`src/shared/tos.ts`):

- **Items per competency** are proportional to teaching hours. Percentages are rounded to 2
  decimals and always total exactly 100.00.
- **Items per Bloom column** follow the distribution (grouped or six levels).
- **Cells** are filled so that every **row total and column total is exact**, close to a
  proportional split. Item numbers run column by column, easiest level first.
- **Editing cells** is allowed. Every row total, column total and the grand total is validated
  live.
- **Saving and exporting are refused** (in the UI _and_ the main process) until all totals match.
  **Recalculate** restores the calculated table.
- **Build assessment** opens the Assessment Builder with the TOS attached. The number of items and
  the Bloom's distribution then come from the TOS, and the prompt includes the full competency ×
  level allocation.

## Performance Task Generator

The Performance Task Generator uses the same AI workflow as the planning tools. You provide the
subject, grade level, learning competency, lesson topic, number of days and minutes per day,
whether learners work individually, in pairs or in small groups, the **available resources**, the
expected output and any additional instructions.

The prompt requires these eight parts, in order:

1. Title.
2. Learning Objectives.
3. Real-World Scenario (GRASPS).
4. Student Instructions, day by day (`### Day 1` … `### Day N`) with minutes.
5. Materials Needed.
6. Expected Output.
7. Submission Requirements.
8. Assessment Criteria, with weights that add up to 100%.

The task must also be **practical**: doable in the time given, using only the listed resources,
with low-cost or offline alternatives, safety notes and support for learners who need it. After
you paste the reply, TeachMate flags any missing section. **Create rubric** opens the Rubric
Builder with the task's assessment criteria already filled in.

## Rubric Generator

The Rubric Generator supports **analytic** and **holistic** rubrics with **4 or 5 levels** (Excellent
→ Beginning, or the DepEd scale Outstanding → Did Not Meet Expectations). The rubric is structured,
editable data (`src/shared/rubric.ts`). **The AI writes the words; TeachMate does the numbers.**

- **Analytic:** each level has a score (e.g. 4–3–2–1) and each criterion a whole-number weight.
  Cell points = level score × weight, criterion max = top score × weight, and **total score = top
  score × Σ weights**. The calculation is shown, for example "Highest level 4 pts × weights
  (2 + 2 + 1 = 5) = 20".
- **Holistic:** each level has a point range. Ranges must run **without gaps or overlaps** up to the
  total, and changing the total recalculates them.
- **Validation:** level scores must go down from left to right. An optional **target total** is
  checked; if the weights don't fit it, TeachMate says what they must add up to, and **Adjust
  weights** fixes them. Saving and export are blocked until every number is correct, in the UI
  _and_ the main process.
- **AI drafting:** the prompt asks for a single Markdown table of criteria and descriptions, with
  no numbers. Pasting the reply **reads the table into the rubric**: any points in it are ignored,
  and your weights and scores are kept. A table with the wrong number of level columns is rejected
  with an explanation. You can also paste a rubric table you already have.

## Export to Word

**Export to Word** creates a `.docx` in the main process (`src/main/export/docx.ts`) and asks where
to save it:

- **Assessments** export as a **teacher copy** (with the answer key, scoring guide and Bloom's
  summary) or a **learner copy** (questions only, with a Name / Grade & Section / Date / Score
  line).
- **TOS** exports as a native landscape Word table with totals, item numbers and "Prepared by /
  Checked by / Approved by" lines.
- **Rubrics** export as native Word tables with points per cell, a Score column, the total score
  and a Name / Date line. Analytic rubrics are landscape.
- **Lesson plans, objectives, performance tasks and annotations** export their Markdown with
  headings, lists and tables. Plain-paragraph documents get their title as a heading.

**Export to Markdown** (from Saved Documents) writes the same content as a `.md` file; TOS and
rubrics are rendered fresh from their validated numbers.

Documents are saved, with their calculations validated, before they're exported. An existing file
is only replaced after you confirm.

## AI Assistant

### Why a manual Claude Code handoff?

TeachMate does **not** sign in to Claude and never reads, extracts or stores Claude login tokens or
session credentials. Anthropic's documentation states: _"Unless previously approved, Anthropic does
not allow third party developers to offer claude.ai login or rate limits for their products,
including agents built on the Claude Agent SDK. Use the API key authentication methods… instead."_
([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)). A Claude Pro/Max subscription
therefore can't be embedded in TeachMate.

Instead, the **Claude Code (manual handoff)** provider:

1. Builds a self-contained Markdown prompt from the conversation and the text of attached documents.
2. Saves it to `handoffs/` and copies it to the clipboard.
3. Opens Claude Code with its official deep link,
   [`claude-cli://open?cwd=…&q=…`](https://code.claude.com/docs/en/deep-links). Claude Code
   **pre-fills** the prompt but never sends it. Claude Code shows a "Prompt from an external
   link" warning, and you press Enter to send it. Prompts longer than the 5,000-character `q` limit
   are passed by reference to the saved file instead.
4. Shows a handoff card telling you to continue in Claude Code. The reply stays in Claude Code;
   TeachMate never shows a made-up response. You can paste the reply back with **Paste reply**,
   and it's labelled _"Response pasted from Claude Code"_.
5. **Copying the reply:** type `/copy` in Claude Code to copy the reply as its original Markdown.
   Selecting text in the terminal copies what is displayed instead: headings and bold lose their
   Markdown, and tables are drawn with box characters. When such text is pasted, TeachMate removes
   the response marker, indentation and padding, converts drawn tables to Markdown tables and
   rejoins cut-off table rows. It also points you to `/copy`, because headings and bold can't be
   recovered.

**Requirements:** Claude Code v2.1.91 or later, and at least one message sent in an interactive
session (that's what registers the `claude-cli://` link handler). On Windows, Claude Code opens in
Windows Terminal, PowerShell or cmd. In **Settings → AI provider**, you can choose the folder Claude
Code should open in. If TeachMate can't detect Claude Code, the prompt is still prepared and copied.

### Adding an official API provider later

1. Implement `AIProvider` (`src/main/ai/provider.ts`) in `src/main/ai/providers/`, e.g. a Claude
   API provider that uses an API key stored in the main process. Never expose the key to the
   renderer.
2. Declare its `capabilities` (`streaming`, `cancellation`, `returnsResponse`, `attachments`) and
   emit stream deltas through `context.emit`, honouring `context.signal` for Stop.
3. Register it in `src/main/services.ts`.

The UI adapts automatically. A provider picker appears once there's more than one provider. Stop
shows when `cancellation` is supported, streaming text renders live, and assistant replies get Copy
and Regenerate.

### Attachments

DOCX (via `mammoth`), PDF (via `unpdf`, text-based PDFs only), TXT and MD. You can attach up to
5 files per message, 15 MB each, and up to 200,000 characters of extracted text per file. Files
are picked in a native dialog run by the main process, so the renderer never handles file paths.
