"""Requirements Clarifier Agent — extracts user stories, acceptance criteria,
ambiguities, assumptions, and edge cases from raw client notes."""

from ai_agent.integrations.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a senior Business Analyst AI. Your job is to take raw, messy client notes or transcripts and produce a structured requirements document.

You MUST respond with ONLY valid JSON in the following structure — no markdown, no explanation, no preamble:
{
  "userStories": [
    {
      "id": "US-001",
      "role": "user",
      "want": "description of what they want",
      "benefit": "why they want it"
    }
  ],
  "acceptanceCriteria": [
    {
      "storyId": "US-001",
      "given": "precondition",
      "when": "action",
      "then": "expected result"
    }
  ],
  "ambiguities": [
    "Description of unclear or vague requirement"
  ],
  "assumptions": [
    "Assumption made based on context"
  ],
  "edgeCases": [
    "Potential edge case or boundary scenario"
  ]
}

Rules:
- Extract ALL meaningful requirements, even implicit ones
- Each user story must follow the "As a <role>, I want <feature>, so that <benefit>" pattern
- Generate at least 1 acceptance criteria per user story in Given/When/Then format
- Identify genuinely ambiguous language (subjective terms, undefined scope, missing details)
- List realistic assumptions
- Identify real edge cases relevant to the described features
- Be thorough but concise
- Generate between 3-8 user stories typically
"""


def process(raw_text: str) -> dict:
    """Process raw client notes and return structured requirements JSON."""
    result = call_llm_json(SYSTEM_PROMPT, raw_text)
    result["type"] = "requirements"
    result["rawInput"] = raw_text
    return result
