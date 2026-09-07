"""Orchestrator — detects user intent and routes to the appropriate agent."""

from ai_agent.integrations.llm_client import call_llm_json

SYSTEM_PROMPT = """You are an intent detection system for a Business Analyst tool. Given user input text, determine which BA agent should handle it.

Available agents:
1. "requirements" — For raw client notes, feature requests, user needs, system requirements, INVEST stories, Gherkin ACs
2. "meeting-prep" — For upcoming meetings, agenda preparation, stakeholder questions, meeting checklists
3. "jira" — For feature descriptions that need to become JIRA tickets, story points, acceptance criteria
4. "gap-analysis" — For comparing current (As-Is) vs desired (To-Be) state, migration planning, roadmap phasing
5. "action-items" — For meeting notes/discussions that need action items, assignees, deadlines extracted
6. "test-cases" — For QA test suites, test plans, testing scenarios, positive/negative tests, validation criteria
7. "minutes" — For formal executive meeting minutes, call transcripts, audio notes, executive decision summaries
8. "process-model" — For workflow diagrams, BPMN, step-by-step business processes, swimlanes, handoffs, flowcharts
9. "business-case" — For ROI calculations, project proposals, cost-benefit analyses, financial justification, payback period
10. "risk-log" — For RAID logs, project risks, scoring matrix, mitigations, assumptions, issues, dependencies
11. "glossary" — For data dictionaries, domain concepts, business terminology, acronym definitions, data entities

You MUST respond with ONLY valid JSON — no markdown, no explanation:
{
  "agent": "requirements",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this agent was chosen"
}

Rules:
- Choose the MOST appropriate agent based on the content
- Confidence should be between 0.0 and 1.0
- If the text requests QA testing or test cases → test-cases
- If the text is a meeting transcript or call record needing formal minutes → minutes
- If the text contains meeting notes needing quick task/action extraction → action-items
- If the text describes a business workflow or process steps → process-model
- If the text discusses budget, ROI, financial payback, or a project business case → business-case
- If the text lists risks, mitigations, assumptions, or RAID items → risk-log
- If the text asks for definitions, glossary, acronyms, or data dictionary entities → glossary
- If the text describes a feature to convert into a ticket → jira
- If the text mentions preparing for an upcoming meeting → meeting-prep
- If the text compares As-Is vs To-Be states → gap-analysis
- If the text has raw client notes or requirements → requirements
- Default to "requirements" if truly ambiguous
"""


def detect_intent(text: str) -> dict:
    """Detect which agent should handle the given text."""
    result = call_llm_json(SYSTEM_PROMPT, text)
    return result
