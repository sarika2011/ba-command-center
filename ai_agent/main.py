"""BA Command Center — FastAPI Backend

Run with: uvicorn ai_agent.main:app --reload
from the project root directory.
"""

import json
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, File, HTTPException, UploadFile, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ai_agent.config import PROJECT_ROOT, OUTPUT_DIRS, MOCK_MODE
from ai_agent import models, database, auth
from ai_agent.agents import (
    requirement_agent,
    meeting_agent,
    jira_agent,
    gap_agent,
    action_agent,
    minutes_agent,
    process_agent,
    roi_agent,
    risk_agent,
    glossary_agent,
    testcase_agent,
    orchestrator,
)
from ai_agent.rtm import rtm_engine

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

def _ensure_role_column():
    """Ensure SQLite table has 'role' column if created in previous version."""
    with database.engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'analyst'"))
            conn.commit()
        except Exception:
            pass

_ensure_role_column()

def _init_demo_users():
    """Seed default demo accounts into DB with explicit roles if not present."""
    db = database.SessionLocal()
    try:
        demo_accounts = [
            ("analyst", "demo123", "analyst"),
            ("admin", "admin123", "admin")
        ]
        for username, password, role in demo_accounts:
            existing = db.query(models.User).filter(models.User.username == username).first()
            if not existing:
                hashed = auth.get_password_hash(password)
                db.add(models.User(username=username, hashed_password=hashed, role=role))
            else:
                existing.role = role
        db.commit()
    except Exception as e:
        print(f"Demo user seeding warning: {e}")
        db.rollback()
    finally:
        db.close()

_init_demo_users()

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="BA Command Center API",
    description="AI-powered Business Analyst workflow assistant",
    version="3.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Path Normalization Middleware ────────────────────────────────────
@app.middleware("http")
async def fix_duplicate_api_prefix(request, call_next):
    """Normalize paths that accidentally include duplicate /api prefixes like /api/api/..."""
    if request.scope.get("path", "").startswith("/api/api/"):
        request.scope["path"] = request.scope["path"].replace("/api/api/", "/api/", 1)
    return await call_next(request)


# ── Request Models ───────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str

class TextInput(BaseModel):
    text: str


class MeetingInput(BaseModel):
    text: str
    topic: Optional[str] = ""
    attendees: Optional[str] = ""


class GapInput(BaseModel):
    as_is: str
    to_be: str


class SaveInput(BaseModel):
    agent: str
    result: dict
    filename: Optional[str] = ""

# ── Helper ───────────────────────────────────────────────────────────
def _result_to_markdown(agent_key: str, result: dict) -> str:
    """Convert a result dict to readable Markdown."""
    lines = [f"# BA Command Center — {agent_key.replace('-', ' ').title()}\n"]
    lines.append(f"_Generated: {datetime.utcnow().isoformat()}_\n")

    if agent_key == "requirements":
        lines.append("## User Stories\n")
        for s in result.get("userStories", []):
            lines.append(f"### {s.get('id', '')}")
            lines.append(f"**As a** {s.get('role', 'user')}, **I want** {s.get('want', '')}, **so that** {s.get('benefit', '')}\n")
        lines.append("## Acceptance Criteria\n")
        for ac in result.get("acceptanceCriteria", []):
            lines.append(f"- **{ac.get('storyId', '')}**: Given {ac.get('given', '')} | When {ac.get('when', '')} | Then {ac.get('then', '')}")
        lines.append("\n## Ambiguities\n")
        for a in result.get("ambiguities", []):
            lines.append(f"- ⚠️ {a}")
        lines.append("\n## Assumptions\n")
        for a in result.get("assumptions", []):
            lines.append(f"- 💡 {a}")
        lines.append("\n## Edge Cases\n")
        for e in result.get("edgeCases", []):
            lines.append(f"- 🔄 {e}")

    elif agent_key == "meeting-prep":
        lines.append(f"## Meeting: {result.get('meetingTopic', '')}\n")
        lines.append(f"**Duration:** {result.get('duration', '')}  ")
        lines.append(f"**Attendees:** {', '.join(result.get('attendeeList', []))}\n")
        lines.append("## Agenda\n")
        for a in result.get("agenda", []):
            lines.append(f"| {a.get('time', '')} | {a.get('item', '')} | {a.get('desc', '')} |")
        lines.append("\n## Questions\n")
        for cat, qs in result.get("questions", {}).items():
            lines.append(f"### {cat.title()}")
            for q in qs:
                lines.append(f"- {q}")
        lines.append("\n## Risks\n")
        for r in result.get("risks", []):
            lines.append(f"- **{r.get('type', '')}**: {r.get('desc', '')}")
        lines.append("\n## Checklist\n")
        for c in result.get("checklist", []):
            lines.append(f"- [ ] {c}")

    elif agent_key == "jira":
        lines.append(f"## {result.get('title', '')}\n")
        lines.append(f"**User Story:** {result.get('userStory', '')}\n")
        lines.append(f"**Story Points:** {result.get('storyPoints', {}).get('points', '?')} — {result.get('storyPoints', {}).get('reasoning', '')}\n")
        lines.append(f"**Labels:** {', '.join(result.get('labels', []))}\n")
        lines.append("### Acceptance Criteria\n")
        for ac in result.get("acceptanceCriteria", []):
            lines.append(f"- **AC-{ac.get('id', '')}**: Given {ac.get('given', '')} | When {ac.get('when', '')} | Then {ac.get('then', '')}")
        lines.append("\n### Dependencies\n")
        for d in result.get("dependencies", []):
            lines.append(f"- {d}")
        lines.append("\n### Definition of Done\n")
        for d in result.get("definitionOfDone", []):
            lines.append(f"- [ ] {d}")

    elif agent_key == "gap-analysis":
        lines.append(f"**As-Is items:** {result.get('asIsCount', 0)} | **To-Be items:** {result.get('toBeCount', 0)}\n")
        lines.append("## Gaps\n")
        for g in result.get("gaps", []):
            lines.append(f"- **[{g.get('severity', '')}] {g.get('type', '')}**: {g.get('item', '')} — {g.get('desc', '')}")
        lines.append("\n## Conflicts\n")
        for c in result.get("conflicts", []):
            lines.append(f"- As-Is: {c.get('asIs', '')} → To-Be: {c.get('toBe', '')} — {c.get('desc', '')}")
        lines.append("\n## Recommendations\n")
        for r in result.get("recommendations", []):
            lines.append(f"- **[{r.get('priority', '')}]** {r.get('action', '')} (Effort: {r.get('effort', '')})")
        lines.append("\n## Impact\n")
        lines.append("### Business")
        for i in result.get("impact", {}).get("business", []):
            lines.append(f"- {i}")
        lines.append("### Technical")
        for i in result.get("impact", {}).get("technical", []):
            lines.append(f"- {i}")

    elif agent_key == "action-items":
        lines.append(f"## Summary\n{result.get('summary', '')}\n")
        lines.append("## Decisions\n")
        for d in result.get("decisions", []):
            lines.append(f"- ✅ {d}")
        lines.append("\n## Action Items\n")
        lines.append("| # | Task | Owner | Deadline |")
        lines.append("|---|------|-------|----------|")
        for i, a in enumerate(result.get("actionItems", []), 1):
            lines.append(f"| {i} | {a.get('task', '')} | {a.get('owner', 'TBD')} | {a.get('deadline', 'TBD')} |")
        lines.append("\n## Open Questions\n")
        for q in result.get("openQuestions", []):
            lines.append(f"- ❓ {q}")
        lines.append("\n## Risks\n")
        for r in result.get("risks", []):
            lines.append(f"- ⚠️ {r}")

    elif agent_key == "test-cases":
        lines.append(f"## {result.get('featureTitle', 'QA Test Suite')}\n")
        lines.append(f"{result.get('summary', '')}\n")
        lines.append("## Test Cases\n")
        for tc in result.get("testCases", []):
            lines.append(f"### {tc.get('id', '')}: {tc.get('title', '')}")
            lines.append(f"- **Type:** {tc.get('type', '')} | **Priority:** {tc.get('priority', '')} | **Requirement:** {tc.get('requirementId', '')}")
            lines.append(f"- **Preconditions:** {tc.get('preconditions', 'None')}")
            lines.append("**Execution Steps:**")
            for st in tc.get("steps", []):
                lines.append(f"  1. {st}")
            lines.append(f"- **Expected Result:** {tc.get('expectedResult', '')}\n")
        if result.get("testDataRequirements"):
            lines.append("## Test Data Requirements\n")
            for td in result.get("testDataRequirements", []):
                lines.append(f"- {td}")

    elif agent_key in ("minutes", "meeting-minutes"):
        lines.append(f"## {result.get('title', 'Executive Meeting Minutes')}\n")
        lines.append(f"**Date:** {result.get('date', '')}  ")
        lines.append(f"**Attendees:** {', '.join(result.get('attendees', []))}\n")
        lines.append("## Executive Summary\n")
        lines.append(f"{result.get('executiveSummary', '')}\n")
        lines.append("## Discussion Points\n")
        for dp in result.get("discussionPoints", []):
            lines.append(f"### {dp.get('topic', '')}")
            lines.append(f"- **Summary:** {dp.get('summary', '')}")
            lines.append(f"- **Consensus:** {dp.get('consensus', '')}\n")
        lines.append("## Decisions Log\n")
        for d in result.get("decisions", []):
            if isinstance(d, dict):
                lines.append(f"- **[{d.get('id', '')}]** {d.get('decision', '')} — _Rationale: {d.get('rationale', '')}_ (Owner: {d.get('owner', '')})")
            else:
                lines.append(f"- ✅ {d}")
        lines.append("\n## Action Items\n")
        lines.append("| ID | Task | Owner | Due Date | Priority |")
        lines.append("|---|---|---|---|---|")
        for a in result.get("actionItems", []):
            lines.append(f"| {a.get('id', '')} | {a.get('task', '')} | {a.get('owner', '')} | {a.get('dueDate', '')} | {a.get('priority', '')} |")
        if result.get("openQuestions"):
            lines.append("\n## Open Questions\n")
            for q in result.get("openQuestions", []):
                lines.append(f"- ❓ {q}")
        if result.get("nextSteps"):
            lines.append("\n## Next Steps\n")
            for s in result.get("nextSteps", []):
                lines.append(f"- ➡️ {s}")

    elif agent_key == "process-model":
        lines.append(f"## Process: {result.get('processName', 'Workflow Model')}\n")
        lines.append(f"{result.get('overview', '')}\n")
        lines.append("## Swimlanes & Actors\n")
        for sl in result.get("swimlanes", []):
            lines.append(f"### Role: {sl.get('role', '')}")
            for st in sl.get("steps", []):
                lines.append(f"- {st}")
        lines.append("\n## Decision Points\n")
        for dp in result.get("decisionPoints", []):
            lines.append(f"- **[{dp.get('id', '')}] {dp.get('question', '')}** (Actor: {dp.get('actor', '')})")
            for br in dp.get("branches", []):
                lines.append(f"  - Condition: _{br.get('condition', '')}_ → Target: `{br.get('target', '')}`")
        lines.append("\n## Bottlenecks & Friction Points\n")
        for bn in result.get("bottlenecks", []):
            lines.append(f"- **Stage:** {bn.get('stage', '')} | **Cause:** {bn.get('cause', '')} | **Recommendation:** {bn.get('recommendation', '')}")
        lines.append("\n## Handoffs\n")
        for ho in result.get("handoffs", []):
            lines.append(f"- **{ho.get('from', '')} → {ho.get('to', '')}**: Artifact: `{ho.get('artifact', '')}` (Risk: {ho.get('risk', '')})")
        if result.get("mermaidDiagram"):
            lines.append("\n## Mermaid Diagram\n")
            lines.append(f"```mermaid\n{result.get('mermaidDiagram', '')}\n```")

    elif agent_key == "business-case":
        lines.append(f"## {result.get('projectTitle', 'Executive Business Case')}\n")
        lines.append(f"### Problem Statement\n{result.get('problemStatement', '')}\n")
        lines.append(f"### Proposed Solution\n{result.get('proposedSolution', '')}\n")
        if result.get("financialSummary"):
            fs = result.get("financialSummary", {})
            lines.append("## Financial Summary\n")
            lines.append("| Estimated Cost | Annual Savings | Payback Period | Estimated ROI |")
            lines.append("|---|---|---|---|")
            lines.append(f"| {fs.get('estimatedCost', '')} | {fs.get('annualSavings', '')} | {fs.get('paybackPeriod', '')} | {fs.get('estimatedRoi', '')} |\n")
        lines.append("## Cost Breakdown\n")
        for c in result.get("costBreakdown", []):
            lines.append(f"- **{c.get('category', '')}**: {c.get('amount', '')} ({c.get('notes', '')})")
        lines.append("\n## Benefit Breakdown\n")
        for b in result.get("benefitBreakdown", []):
            lines.append(f"- **{b.get('benefit', '')}**: {b.get('value', '')} [{b.get('type', '')}]")
        if result.get("strategicAlignment"):
            lines.append("\n## Strategic Alignment\n")
            for sa in result.get("strategicAlignment", []):
                lines.append(f"- 🎯 {sa}")
        lines.append(f"\n## Recommendation\n**{result.get('recommendation', '')}**")

    elif agent_key == "risk-log":
        lines.append(f"## RAID Risk & Assumption Log\n_{result.get('projectContext', '')}_\n")
        lines.append("## Risk Register\n")
        lines.append("| ID | Category | Description | Likelihood | Impact | Score | Mitigation Strategy | Owner |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for r in result.get("risks", []):
            if isinstance(r, dict):
                lines.append(f"| {r.get('id', '')} | {r.get('category', '')} | {r.get('description', '')} | {r.get('likelihood', '')} | {r.get('impact', '')} | {r.get('score', '')}/9 | {r.get('mitigationStrategy', '')} | {r.get('owner', '')} |")
            else:
                lines.append(f"| RISK | General | {r} | Medium | Medium | 4/9 | Monitor | Team |")
        lines.append("\n## Key Assumptions\n")
        for a in result.get("assumptions", []):
            lines.append(f"- **[{a.get('id', '')}]** {a.get('statement', '')} — _Validation: {a.get('validationMethod', '')}_ (Status: {a.get('status', '')})")
        if result.get("issues"):
            lines.append("\n## Active Issues\n")
            for iss in result.get("issues", []):
                lines.append(f"- **[{iss.get('id', '')}]** {iss.get('problem', '')} — _Impact: {iss.get('impact', '')}_ (Owner: {iss.get('resolutionOwner', '')})")
        if result.get("dependencies"):
            lines.append("\n## Dependencies\n")
            for dep in result.get("dependencies", []):
                lines.append(f"- **[{dep.get('id', '')}]** {dep.get('description', '')} (Party: {dep.get('dependentParty', '')}, Due: {dep.get('dueDate', '')})")

    elif agent_key == "glossary":
        lines.append(f"## Data Dictionary & Glossary: {result.get('domainName', 'Domain Glossary')}\n")
        lines.append("## Terms & Acronyms\n")
        lines.append("| Term | Category | Definition | Synonyms |\n|---|---|---|---|")
        for g in result.get("glossary", []):
            syn = ", ".join(g.get("synonyms", []))
            lines.append(f"| **{g.get('term', '')}** | {g.get('category', '')} | {g.get('definition', '')} | {syn} |")
        if result.get("dataEntities"):
            lines.append("\n## Data Entities\n")
            for ent in result.get("dataEntities", []):
                lines.append(f"### Entity: {ent.get('entityName', '')}")
                lines.append(f"{ent.get('description', '')}\n")
                lines.append("| Attribute | Type | Required | Description |")
                lines.append("|---|---|---|---|")
                for attr in ent.get("attributes", []):
                    lines.append(f"| `{attr.get('name', '')}` | {attr.get('type', '')} | {'Yes' if attr.get('required') else 'No'} | {attr.get('description', '')} |")

    else:
        lines.append(f"```json\n{json.dumps(result, indent=2)}\n```")

    return "\n".join(lines)


def _save_output_to_db(agent_key: str, result: dict, user: models.User, db: Session, filename: str = "") -> dict:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base = filename or f"{agent_key}_{ts}"
    base = base.replace(" ", "_").replace("/", "_")
    
    md_content = _result_to_markdown(agent_key, result)
    json_str = json.dumps(result, indent=2, ensure_ascii=False)
    
    saved_id = None
    try:
        db_output = models.AgentOutput(
            agent_key=agent_key,
            filename=base,
            raw_input=result.get("rawInput", ""),
            json_result=json_str,
            markdown_result=md_content,
            owner_id=user.id if user else None
        )
        db.add(db_output)
        db.commit()
        db.refresh(db_output)
        saved_id = db_output.id
    except Exception as e:
        print(f"Database save warning: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    # Also persist to local file system folders if configured
    target_dir = OUTPUT_DIRS.get(agent_key)
    if target_dir:
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            with open(target_dir / f"{base}.json", "w", encoding="utf-8") as jf:
                jf.write(json_str)
            with open(target_dir / f"{base}.md", "w", encoding="utf-8") as mf:
                mf.write(md_content)
        except Exception as e:
            print(f"Disk file write notice: {e}")
    
    return {
        "saved": True,
        "id": saved_id,
        "filename": base
    }

# ── Auth Endpoints ───────────────────────────────────────────────────

@app.post("/api/register")
def register_user(user: UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password, role="analyst")
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User created successfully"}

@app.post("/api/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    user_role = getattr(user, "role", "analyst") or "analyst"
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user_role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username,
        "role": user_role
    }

@app.get("/api/me")
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": getattr(current_user, "role", "analyst") or "analyst"
    }

# ── API Endpoints ────────────────────────────────────────────────────

@app.post("/api/detect-intent")
async def detect_intent(body: TextInput, current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = orchestrator.detect_intent(body.text)
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/requirements")
async def process_requirements(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = requirement_agent.process(body.text)
        save_info = _save_output_to_db("requirements", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/meeting-prep")
async def process_meeting_prep(body: MeetingInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = meeting_agent.process(body.text, body.topic, body.attendees)
        save_info = _save_output_to_db("meeting-prep", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/jira")
async def process_jira(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = jira_agent.process(body.text)
        save_info = _save_output_to_db("jira", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gap-analysis")
async def process_gap_analysis(body: GapInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = gap_agent.process(body.as_is, body.to_be)
        save_info = _save_output_to_db("gap-analysis", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/action-items")
async def process_action_items(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = action_agent.process(body.text)
        save_info = _save_output_to_db("action-items", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/minutes")
async def process_minutes(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = minutes_agent.process(body.text)
        save_info = _save_output_to_db("minutes", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process-model")
async def process_workflow(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = process_agent.process(body.text)
        save_info = _save_output_to_db("process-model", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/business-case")
async def process_business_case(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = roi_agent.process(body.text)
        save_info = _save_output_to_db("business-case", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/risk-log")
async def process_risk_log(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = risk_agent.process(body.text)
        save_info = _save_output_to_db("risk-log", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/glossary")
async def process_glossary(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = glossary_agent.process(body.text)
        save_info = _save_output_to_db("glossary", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/test-cases")
async def process_test_cases(body: TextInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        result = testcase_agent.process(body.text)
        save_info = _save_output_to_db("test-cases", result, current_user, db)
        result["_saveInfo"] = save_info
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rtm")
async def get_requirements_traceability_matrix(current_user: models.User = Depends(auth.get_current_user)):
    return JSONResponse(content=rtm_engine.get_rtm())


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".txt", ".docx", ".md"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Use .txt, .md, or .docx",
        )

    content = await file.read()

    if ext in (".txt", ".md"):
        text = content.decode("utf-8", errors="replace")
    elif ext == ".docx":
        import zipfile
        import io
        import re as re_mod
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                xml = z.read("word/document.xml").decode("utf-8")
                text = re_mod.sub(r"<[^>]+>", " ", xml)
                text = re_mod.sub(r"\s+", " ", text).strip()
        except Exception:
            raise HTTPException(status_code=400, detail="Failed to parse .docx file")
    else:
        text = content.decode("utf-8", errors="replace")

    return JSONResponse(content={"text": text, "filename": file.filename})


@app.get("/api/saved-files")
async def list_saved_files(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """List all saved output files for the current user."""
    outputs = db.query(models.AgentOutput).filter(models.AgentOutput.owner_id == current_user.id).order_by(models.AgentOutput.created_at.desc()).all()
    
    files = {
        "requirements": [],
        "meeting-prep": [],
        "jira": [],
        "gap-analysis": [],
        "action-items": [],
        "test-cases": [],
        "minutes": [],
        "process-model": [],
        "business-case": [],
        "risk-log": [],
        "glossary": []
    }
    
    for output in outputs:
        if output.agent_key not in files:
            files[output.agent_key] = []
        files[output.agent_key].append({
            "id": output.id,
            "name": output.filename,
            "modified": output.created_at.isoformat(),
        })
            
    return JSONResponse(content=files)


@app.get("/api/saved-files/{file_id}")
async def get_saved_file(file_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Get contents of a saved file from DB."""
    output = db.query(models.AgentOutput).filter(models.AgentOutput.id == file_id, models.AgentOutput.owner_id == current_user.id).first()
    if not output:
        raise HTTPException(status_code=404, detail="File not found")
        
    return JSONResponse(content={
        "id": output.id,
        "filename": output.filename,
        "agent_key": output.agent_key,
        "json_result": json.loads(output.json_result),
        "markdown_result": output.markdown_result
    })

@app.post("/api/save")
async def save_output(body: SaveInput, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Manually save a result to the DB."""
    try:
        save_info = _save_output_to_db(body.agent, body.result, current_user, db, body.filename)
        return JSONResponse(content=save_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Admin-Only Workspaces Endpoints (RBAC) ───────────────────────────

@app.get("/api/admin/workspaces/files")
async def list_all_workspaces_files(
    db: Session = Depends(database.get_db), 
    admin_user: models.User = Depends(auth.require_admin)
):
    """Admin-only: List all saved outputs across ALL users' workspaces."""
    outputs = (
        db.query(models.AgentOutput, models.User.username, models.User.role)
        .join(models.User, models.AgentOutput.owner_id == models.User.id)
        .order_by(models.AgentOutput.created_at.desc())
        .all()
    )
    
    files = {
        "requirements": [],
        "meeting-prep": [],
        "jira": [],
        "gap-analysis": [],
        "action-items": [],
        "test-cases": [],
        "minutes": [],
        "process-model": [],
        "business-case": [],
        "risk-log": [],
        "glossary": []
    }
    
    for output, username, role in outputs:
        if output.agent_key not in files:
            files[output.agent_key] = []
        files[output.agent_key].append({
            "id": output.id,
            "name": output.filename,
            "modified": output.created_at.isoformat(),
            "owner_username": username,
            "owner_role": role or "analyst",
            "owner_id": output.owner_id
        })
            
    return JSONResponse(content={
        "total_files": len(outputs),
        "files": files
    })

@app.get("/api/admin/workspaces/files/{file_id}")
async def get_admin_workspace_file(
    file_id: int, 
    db: Session = Depends(database.get_db), 
    admin_user: models.User = Depends(auth.require_admin)
):
    """Admin-only: Retrieve any output file across all workspaces."""
    output = (
        db.query(models.AgentOutput, models.User.username)
        .join(models.User, models.AgentOutput.owner_id == models.User.id)
        .filter(models.AgentOutput.id == file_id)
        .first()
    )
    if not output:
        raise HTTPException(status_code=404, detail="File not found")
        
    agent_output, owner_username = output
    return JSONResponse(content={
        "id": agent_output.id,
        "filename": agent_output.filename,
        "agent_key": agent_output.agent_key,
        "owner_username": owner_username,
        "json_result": json.loads(agent_output.json_result),
        "markdown_result": agent_output.markdown_result
    })


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    from ai_agent.config import ANTHROPIC_API_KEY
    return {
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "api_key_configured": bool(ANTHROPIC_API_KEY) and ANTHROPIC_API_KEY not in ("mock_mode", "your-real-key-here") and not ANTHROPIC_API_KEY.startswith("your_"),
        "version": "3.0.0",
        "db": "connected",
        "note": "[MOCK MODE] AI responses are simulated. Set MOCK_MODE=false + real ANTHROPIC_API_KEY to enable live Claude." if MOCK_MODE else "Live mode — real Claude API active."
    }


# ── Serve Frontend Static Files ─────────────────────────────────────
frontend_dir = PROJECT_ROOT / "frontend"
if frontend_dir.exists():
    @app.get("/")
    async def serve_index():
        return FileResponse(frontend_dir / "index.html")

    app.mount("/", StaticFiles(directory=str(frontend_dir)), name="static")
