"""Meeting Prep Agent — generates agenda, questions, risks, and attendee checklist."""

from ai_agent.integrations.llm_client import call_llm_json

SYSTEM_PROMPT = """You are a senior Business Analyst AI specializing in meeting preparation. Given a meeting topic, attendees, and context, produce a comprehensive meeting prep package.

You MUST respond with ONLY valid JSON in the following structure — no markdown, no explanation:
{
  "meetingTopic": "Extracted or provided meeting topic",
  "attendeeList": ["Person 1 (Role)", "Person 2 (Role)"],
  "duration": "60 min",
  "agenda": [
    {
      "time": "0-5 min",
      "item": "Agenda item title",
      "desc": "Brief description"
    }
  ],
  "questions": {
    "functional": ["Question about functionality"],
    "technical": ["Question about technical aspects"],
    "business": ["Question about business impact"]
  },
  "risks": [
    {
      "type": "Risk category",
      "desc": "Risk description and mitigation"
    }
  ],
  "checklist": [
    "Pre-meeting preparation step"
  ]
}

Rules:
- Create a realistic, time-boxed agenda (typically 45-60 min)
- Generate 3-5 questions per category (functional, technical, business)
- Identify 3-5 realistic risks with practical mitigation suggestions
- Checklist should include 5-8 actionable prep steps
- Tailor everything to the specific topic and attendees
- Be practical and specific, not generic
"""


def process(raw_text: str, topic: str = "", attendees: str = "") -> dict:
    """Process meeting context and return structured prep package."""
    user_msg = f"CONTEXT/NOTES:\n{raw_text}"
    if topic:
        user_msg = f"MEETING TOPIC: {topic}\n\n" + user_msg
    if attendees:
        user_msg += f"\n\nATTENDEES: {attendees}"

    result = call_llm_json(SYSTEM_PROMPT, user_msg)
    result["type"] = "meeting-prep"
    result["rawInput"] = raw_text
    return result
