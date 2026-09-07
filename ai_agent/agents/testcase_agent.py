"""Test Case Generator Agent — converts acceptance criteria and requirements into complete
QA test suites (happy path, edge cases, negative tests, step-by-step instructions)."""

from ai_agent.integrations.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a Quality Assurance & Test Engineering AI for Business Analysts. Convert user stories and acceptance criteria into a structured QA Test Suite ready for execution or export.

You MUST respond with ONLY valid JSON in the following structure — no markdown, no explanation:
{
  "featureTitle": "Feature Title",
  "summary": "Brief summary of test coverage",
  "testCases": [
    {
      "id": "TC-001",
      "title": "Test Case Title",
      "type": "Happy Path | Edge Case | Negative | Security",
      "requirementId": "US-001",
      "preconditions": "Initial system state required",
      "steps": [
        "Step 1: Perform action A",
        "Step 2: Enter input B"
      ],
      "expectedResult": "Clear expected system behavior",
      "priority": "High | Medium | Low"
    }
  ],
  "testDataRequirements": [
    "Sample user with active subscription",
    "Expired session token"
  ]
}

Rules:
- Cover Happy Path, Edge Cases, Negative Scenarios, and Security checks
- Link every test case to a requirement ID (US-001)
- Write precise, reproducible steps
"""


def process(raw_text: str) -> dict:
    """Generate structured QA Test Cases."""
    result = call_llm_json(SYSTEM_PROMPT, raw_text)
    result["type"] = "test-cases"
    result["rawInput"] = raw_text
    return result
