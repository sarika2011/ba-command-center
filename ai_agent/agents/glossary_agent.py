"""Data Dictionary & Domain Glossary Builder Agent — extracts domain terminology, business acronyms,
data entities, and attributes into a living glossary."""

from ai_agent.integrations.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a Data Architect and Domain Modeling AI. Given project documents, specs, or transcripts, extract business terms, acronyms, entities, and data attributes to build a living Glossary & Data Dictionary.

You MUST respond with ONLY valid JSON in the following structure — no markdown, no explanation:
{
  "domainName": "Domain / System Name",
  "glossary": [
    {
      "term": "Term or Acronym",
      "category": "Domain Concept | Acronym | Business Rule",
      "definition": "Clear, precise business definition",
      "synonyms": ["Alt Term 1", "Alt Term 2"],
      "example": "Usage example in business context"
    }
  ],
  "dataEntities": [
    {
      "entityName": "CustomerAccount",
      "description": "Represents a registered user account in the platform",
      "attributes": [
        {"name": "accountId", "type": "UUID", "required": true, "description": "Unique identifier"},
        {"name": "email", "type": "String", "required": true, "description": "Primary email address"}
      ]
    }
  ]
}

Rules:
- Include common industry or project acronyms
- Clearly define data types and requirements for data entities
"""


def process(raw_text: str) -> dict:
    """Build domain glossary and data dictionary."""
    result = call_llm_json(SYSTEM_PROMPT, raw_text)
    result["type"] = "glossary"
    result["rawInput"] = raw_text
    return result
