# Business Analyst (BA) Command Center (v3.0 Pro)

> ⚠️ **MOCK MODE ACTIVE** 
> All features (auth, file storage, database, RBAC, UI) are **fully functional**.
> To enable real Claude AI responses, set `MOCK_MODE=false` and add your real `ANTHROPIC_API_KEY` to `.env`.
> No code changes required — it's a single env var switch.

An AI-powered Business Analyst Command Center web application featuring 12 specialized agents to streamline the entire product discovery, requirements management, and delivery lifecycle.

## Architecture

This project uses a modern decoupled frontend and backend architecture:

1. **Frontend:** Vanilla HTML5, CSS3 (glassmorphism design system), and modular JavaScript.
2. **Backend:** FastAPI (Python) server with SQLAlchemy ORM and JWT OAuth2 authentication.
3. **Database & Storage:** Dual persistence model:
   - SQLite Database (`ba_command_center.db`) for multi-user session and output storage.
   - Categorized file system folders for `.json` and formatted `.md` artifacts.
4. **AI Integration:** Anthropic Claude (via `anthropic` SDK) with automated offline **Mock Mode** fallback when no API key is provided.

## Core Features & The 12 Agents

| # | Agent Name | Category | Primary Function |
|---|---|---|---|
| 0 | **Auto-Detect Orchestrator** | Routing | Analyzes input text intent and automatically delegates to the best agent. |
| 1 | **Requirements Clarifier** | Requirements | Extracts INVEST user stories, Gherkin Given/When/Then ACs, ambiguities, assumptions, edge cases, NFRs, and DoR checklists. |
| 2 | **JIRA Ticket Drafter** | Requirements | Converts requirements into ready-to-import JIRA issues with story points, labels, dependencies, and DoD. |
| 3 | **Gap Analysis (As-Is vs To-Be)** | Requirements | Compares current vs desired architectures, calculates severity scores, and creates implementation roadmap phases. |
| 4 | **QA Test Case Generator** | Quality Assurance | Produces comprehensive test suites (happy path, edge cases, negative tests, step-by-step execution, and test data requirements). |
| 5 | **Meeting Prep & Facilitation** | Meetings | Generates timeboxed agendas, role-based questions (functional, technical, business), risks, and preparation checklists. |
| 6 | **Executive Meeting Minutes** | Meetings | Synthesizes transcripts into formal executive minutes, discussion points, consensus logs, and formal decision registers. |
| 7 | **Action Items Extractor** | Meetings | Extracts actionable tasks, assignees, priorities, and deadlines with interactive completion checkboxes. |
| 8 | **Process & Workflow Modeler** | Strategy & Architecture | Generates BPMN swimlanes, decision gateways, handoff risk matrices, bottlenecks, and visual Mermaid.js flowcharts. |
| 9 | **Business Case & ROI Builder** | Strategy & Architecture | Builds executive financial summaries (cost breakdown, annual savings, payback period, ROI %) and strategic alignment OKRs. |
| 10 | **Risk & Assumption Log (RAID)** | Strategy & Architecture | Evaluates technical/business risks on a 1-9 scoring matrix, mitigation strategies, key assumptions, issues, and external dependencies. |
| 11 | **Data Dictionary & Glossary** | Strategy & Architecture | Extracts business terminology, domain acronyms, and structured data entities with attribute types and validation constraints. |

## Additional Enterprise Features

- **Requirements Traceability Matrix (RTM):** Live end-to-end matrix linking Business Needs → User Stories → JIRA Tickets → QA Test Cases → RAID Risks & Decisions, with CSV export.
- **Command Palette (`Ctrl+K` / `Cmd+K`):** Instant spotlight search to jump to any agent or tool.
- **Built-in Mock Mode:** Run and test all 12 agents immediately without entering an API key.
- **Authentication:** Built-in JWT authentication with persistent user sessions and one-click demo logins.

---

## Setup Instructions

### 1. Requirements

- Python 3.10+
- Modern Web Browser

### 2. Environment Setup

From the root project directory:

```bash
pip install -r requirements.txt
```

### 3. API Key Configuration (Optional)

Copy `.env.example` to `.env` (or edit `.env`) to use live Claude models:

```env
ANTHROPIC_API_KEY=your_actual_key_here
LLM_MODEL=claude-sonnet-4-6
LLM_MAX_TOKENS=4096
```

> **Note:** If no API key is provided, the application runs in **Mock Mode**, generating structured simulation responses for all 12 agents.

### 4. Running the Application

Start the FastAPI backend server (which also hosts the frontend):

```bash
uvicorn ai_agent.main:app --reload
```

The application will be live at: [http://localhost:8000](http://localhost:8000)

### 5. Demo Accounts

The application automatically seeds demo user credentials for instant testing:
- **Analyst:** `analyst` / `demo123`
- **Admin:** `admin` / `admin123`

---

## Output Folders

Generated outputs are automatically saved to the SQLite database and exported into categorized folders:
- `Requirements/`
- `Meetings/`
- `Jira_Tickets/`
- `Gap_Analysis/`
- `Action_Items/`
- `Test_Cases/`
- `Meeting_Minutes/`
- `Process_Models/`
- `Business_Cases/`
- `Risk_Logs/`
- `Domain_Glossaries/`

You can view, search, and reopen saved files anytime via the **Files** button in the top navigation bar.
