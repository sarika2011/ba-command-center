"""Anthropic Claude API wrapper for structured LLM calls (with Mock fallback).

MOCK MODE ACTIVE: Set MOCK_MODE=false and provide a real ANTHROPIC_API_KEY in .env
to switch to live Claude API calls. No code changes required.
"""

import json
import re
from anthropic import Anthropic
from ai_agent.config import ANTHROPIC_API_KEY, LLM_MODEL, LLM_MAX_TOKENS, MOCK_MODE


def _is_mock_mode() -> bool:
    """Returns True if running in mock mode (no real API calls made).
    
    Priority order:
    1. MOCK_MODE=true in .env  → always mock
    2. ANTHROPIC_API_KEY is empty or placeholder  → mock
    3. Otherwise  → real Claude API
    """
    if MOCK_MODE:
        return True
    if not ANTHROPIC_API_KEY:
        return True
    if ANTHROPIC_API_KEY in ("mock_mode", "your-real-key-here") or ANTHROPIC_API_KEY.startswith("your_"):
        return True
    return False

def _get_mock_response(system_prompt: str, user_message: str) -> str:
    """Generate a mock JSON response based on the agent's system prompt to allow running without an API key."""
    if "intent detection system" in system_prompt:
        msg = user_message.lower()
        agent = "requirements"
        if "gap" in msg or "to-be" in msg or "as-is" in msg:
            agent = "gap-analysis"
        elif "test" in msg or "qa" in msg or "test case" in msg:
            agent = "test-cases"
        elif "minutes" in msg or "transcript" in msg or "call log" in msg:
            agent = "minutes"
        elif "process" in msg or "workflow" in msg or "bpmn" in msg or "swimlane" in msg or "flowchart" in msg:
            agent = "process-model"
        elif "roi" in msg or "business case" in msg or "payback" in msg or "financial" in msg or "cost-benefit" in msg:
            agent = "business-case"
        elif "risk" in msg or "raid" in msg or "assumption" in msg or "mitigation" in msg:
            agent = "risk-log"
        elif "glossary" in msg or "dictionary" in msg or "acronym" in msg or "terminology" in msg:
            agent = "glossary"
        elif "ticket" in msg or "jira" in msg or "story point" in msg:
            agent = "jira"
        elif "action" in msg or "decision" in msg or "todo" in msg:
            agent = "action-items"
        elif "meeting" in msg or "attendees" in msg or "agenda" in msg:
            agent = "meeting-prep"
        
        return json.dumps({
            "agent": agent,
            "confidence": 0.95,
            "reasoning": f"[MOCK] Auto-detected '{agent}' based on keyword matching."
        })
        
    elif "userStories" in system_prompt:
        return json.dumps({
            "userStories": [
                {"id": "US-001", "role": "user", "want": "see real-time order tracking", "benefit": "I can know when my package arrives", "priority": "High", "storyPoints": 5},
                {"id": "US-002", "role": "admin", "want": "configure notification rules", "benefit": "the platform alerts users automatically", "priority": "Medium", "storyPoints": 3}
            ],
            "acceptanceCriteria": [
                {"storyId": "US-001", "given": "an active order", "when": "I open the tracking page", "then": "I see live map updates and estimated delivery time"}
            ],
            "ambiguities": ["GPS update frequency is not specified (e.g. 5s vs 30s)."],
            "assumptions": ["Assuming courier partners provide real-time webhooks."],
            "edgeCases": ["What if driver loses cellular signal during delivery?"],
            "nonFunctionalRequirements": [
                {"category": "Performance", "requirement": "Tracking updates must render within <500ms latency."},
                {"category": "Security", "requirement": "Location tokens must be encrypted end-to-end."},
                {"category": "Reliability", "requirement": "99.9% uptime for webhook listener service."}
            ],
            "definitionOfReady": [
                {"item": "User story adheres to INVEST criteria", "status": True},
                {"item": "Acceptance criteria written in Given/When/Then", "status": True},
                {"item": "Story points estimated by dev team", "status": True},
                {"item": "No blocking stakeholder ambiguities", "status": False}
            ]
        })
        
    elif "agenda" in system_prompt and "meeting preparation" in system_prompt:
        return json.dumps({
            "meetingTopic": "Mock System Sync",
            "attendeeList": ["John (PM)", "Sarah (Dev Lead)", "Mike (QA Lead)"],
            "duration": "45 min",
            "agenda": [
                {"time": "0-10 min", "item": "Intro & Scope Review", "desc": "Discuss overall requirements and goals"},
                {"time": "10-35 min", "item": "Technical Deep Dive", "desc": "Review API endpoints and security"},
                {"time": "35-45 min", "item": "Wrap-up & Action Items", "desc": "Assign owners and deadlines"}
            ],
            "questions": {
                "functional": ["Does the UI support dark/light mode toggle?"],
                "technical": ["Is FastAPI running correctly on port 8000?"],
                "business": ["Can we demo this to the client today?"]
            },
            "risks": [{"type": "Integration Risk", "desc": "Third party webhooks could hit rate limits during peak hours."}],
            "checklist": ["Prepare slides for architecture overview", "Verify staging environment health"]
        })
        
    elif "JIRA ticket creation" in system_prompt:
        return json.dumps({
            "title": "Implement Real-time Order Tracking Dashboard",
            "description": "Build a live map and status tracking UI for users to monitor deliveries in real time.",
            "userStory": "As a user, I want to track my order status in real time, so that I know when it arrives.",
            "acceptanceCriteria": [
                {"id": 1, "given": "an active order ID", "when": "I visit the tracking URL", "then": "I see live map updates and delivery status"}
            ],
            "storyPoints": {"points": 5, "reasoning": "Requires WebSocket / Polling integration and Map component."},
            "labels": ["frontend", "tracking", "feature"],
            "dependencies": ["Order Status API endpoint"],
            "definitionOfDone": ["Code reviewed", "Unit tests passing", "UI verified on mobile & desktop"]
        })
        
    elif "gap analysis" in system_prompt:
        return json.dumps({
            "gaps": [
                {"type": "Capability Gap", "item": "Real-time Tracking", "severity": "High", "desc": "Legacy system uses batch status updates every 24 hours."}
            ],
            "conflicts": [
                {"asIs": "Batch CSV Sync", "toBe": "WebSocket Event Stream", "desc": "Requires infrastructure upgrade for event streaming."}
            ],
            "recommendations": [
                {"action": "Deploy Redis Pub/Sub for live status broadcast", "priority": "High", "effort": "Medium"}
            ],
            "impact": {
                "business": ["Increases customer satisfaction by 40%"],
                "technical": ["Requires WebSocket connection pool management"]
            },
            "roadmapPhasing": [
                {"phase": "Quick Win (Phase 1)", "action": "Add 5-minute polling interval API", "effort": "Low", "impact": "High"},
                {"phase": "Core Build (Phase 2)", "action": "Implement WebSockets & live map UI", "effort": "Medium", "impact": "High"},
                {"phase": "Future Scale (Phase 3)", "action": "Driver app GPS telemetry integration", "effort": "High", "impact": "Medium"}
            ],
            "asIsCount": 1,
            "toBeCount": 1
        })
        
    elif "meeting note analysis" in system_prompt:
        return json.dumps({
            "summary": "This is a mock summary of the meeting notes. The application is running in mock mode without an API key.",
            "decisions": ["Decided to use mock mode for the demo."],
            "actionItems": [
                {"task": "Get an Anthropic API key", "owner": "User", "deadline": "Before production"}
            ],
            "openQuestions": ["How much will the API cost?"],
            "risks": ["Mock data might confuse actual users if left in production."]
        })

    elif "meeting minute synthesis" in system_prompt:
        return json.dumps({
            "title": "Executive Meeting Minutes — System Alignment",
            "date": "2026-08-25",
            "attendees": ["Alex (Lead BA)", "David (Product Director)", "Elena (Tech Lead)"],
            "executiveSummary": "The team aligned on the Q3 roadmap deliverables. Key decisions were made regarding authentication architecture and JIRA integration timeline.",
            "discussionPoints": [
                {"topic": "Authentication Architecture", "summary": "Evaluated JWT vs OAuth2 standard", "consensus": "Proceeding with JWT & OAuth2 hybrid model"},
                {"topic": "Timeline & Resources", "summary": "Reviewed sprint allocation", "consensus": "Sprint 1 starts next Monday with 3 full-stack engineers"}
            ],
            "decisions": [
                {"id": "DEC-001", "decision": "Adopt PBKDF2 / JWT authentication scheme", "rationale": "Ensures backwards compatibility and high security", "owner": "Elena (Tech Lead)"}
            ],
            "actionItems": [
                {"id": "ACT-001", "task": "Draft OpenAPI 3.0 specification", "owner": "Alex (Lead BA)", "dueDate": "2026-08-28", "priority": "High"}
            ],
            "openQuestions": ["Will third-party partners need dedicated sandbox environments?"],
            "nextSteps": ["Finalize user stories and import tickets into JIRA by Friday."]
        })

    elif "Process Architect" in system_prompt:
        return json.dumps({
            "processName": "Customer Order & Fulfillment Flow",
            "overview": "End-to-end workflow from customer order placement to warehouse dispatch and tracking notification.",
            "swimlanes": [
                {"role": "Customer", "steps": ["Place Order", "Receive SMS Tracking Link"]},
                {"role": "Order Service", "steps": ["Validate Inventory", "Publish OrderCreated Event"]},
                {"role": "Warehouse", "steps": ["Pick & Pack Items", "Generate Shipping Label"]}
            ],
            "steps": [
                {"id": "STEP-01", "name": "Place Order", "actor": "Customer", "action": "Submit checkout form", "type": "Start", "nextSteps": ["STEP-02"]},
                {"id": "STEP-02", "name": "Inventory Check", "actor": "Order Service", "action": "Query DB for stock", "type": "Decision", "nextSteps": ["STEP-03"]},
                {"id": "STEP-03", "name": "Warehouse Dispatch", "actor": "Warehouse", "action": "Pack and attach label", "type": "Action", "nextSteps": ["STEP-04"]},
                {"id": "STEP-04", "name": "Order Delivered", "actor": "Customer", "action": "Order fulfilled", "type": "End", "nextSteps": []}
            ],
            "decisionPoints": [
                {"id": "DEC-01", "question": "Is item in stock?", "actor": "Order Service", "branches": [{"condition": "Yes", "target": "STEP-03"}, {"condition": "No", "target": "Backorder Alert"}]}
            ],
            "bottlenecks": [
                {"stage": "Manual Shipping Label Creation", "cause": "Warehouse staff manually enters tracking numbers", "recommendation": "Automate label generation via carrier API"}
            ],
            "handoffs": [
                {"from": "Order Service", "to": "Warehouse", "artifact": "Dispatch Queue Payload", "risk": "Network drop could delay warehouse queue notification"}
            ],
            "mermaidDiagram": "graph TD\n  A[Customer Places Order] --> B{In Stock?}\n  B -->|Yes| C[Pick & Pack]\n  B -->|No| D[Notify Out of Stock]\n  C --> E[Dispatch & SMS Alert]"
        })

    elif "Financial Architect" in system_prompt:
        return json.dumps({
            "projectTitle": "Automated Order Tracking Platform",
            "problemStatement": "Customers generate 1,200 support tickets monthly inquiring about order status due to lack of real-time visibility.",
            "proposedSolution": "Build a self-service real-time tracking portal with automated SMS alerts.",
            "financialSummary": {
                "estimatedCost": "$45,000",
                "annualSavings": "$115,000 / year",
                "paybackPeriod": "4.7 months",
                "estimatedRoi": "155% (Year 1)"
            },
            "costBreakdown": [
                {"category": "Engineering Development", "amount": "$35,000", "notes": "Frontend & backend dev for 5 weeks"},
                {"category": "Twilio SMS API Licensing", "amount": "$10,000", "notes": "Estimated 50k SMS messages"}
            ],
            "benefitBreakdown": [
                {"benefit": "Support ticket volume reduction (70% reduction)", "value": "$90,000/yr", "type": "Direct Cost Reduction"},
                {"benefit": "Customer churn reduction", "value": "$25,000/yr", "type": "Revenue Retention"}
            ],
            "strategicAlignment": [
                "Directly supports Q3 Customer Experience OKR",
                "Scales support operations without adding headcount"
            ],
            "keyRisks": [
                {"risk": "SMS delivery failure in international regions", "impact": "Medium", "mitigation": "Fallback to email notifications"}
            ],
            "recommendation": "Strongly recommended for funding. Immediate ROI within 5 months."
        })

    elif "RAID" in system_prompt:
        return json.dumps({
            "projectContext": "Core Platform Modernization",
            "risks": [
                {
                    "id": "RISK-01",
                    "category": "Technical",
                    "description": "Legacy database schema lacks indexing on timestamp columns.",
                    "likelihood": "High",
                    "impact": "High",
                    "score": 9,
                    "mitigationStrategy": "Add database migrations for composite indices before launch.",
                    "owner": "Database Admin"
                }
            ],
            "assumptions": [
                {
                    "id": "ASM-01",
                    "statement": "Third party logistics API maintains 99.9% uptime SLA.",
                    "validationMethod": "Review carrier SLA contract & configure uptime monitoring",
                    "status": "Validated"
                }
            ],
            "issues": [
                {
                    "id": "ISS-01",
                    "problem": "Staging environment SSL certificate expired.",
                    "impact": "Blocks integration testing for QA team",
                    "resolutionOwner": "DevOps Lead"
                }
            ],
            "dependencies": [
                {
                    "id": "DEP-01",
                    "description": "Payment Gateway v2 API production credentials",
                    "dependentParty": "FinTech Vendor",
                    "dueDate": "2026-09-01"
                }
            ]
        })

    elif "Domain Modeling" in system_prompt:
        return json.dumps({
            "domainName": "E-Commerce & Order Management",
            "glossary": [
                {
                    "term": "Waybill",
                    "category": "Domain Concept",
                    "definition": "A document issued by a carrier giving details and instructions relating to the shipment of a consignment of goods.",
                    "synonyms": ["Consignment Note", "Shipping Manifest"],
                    "example": "The warehouse generated a waybill for carrier pickup."
                },
                {
                    "term": "DoR",
                    "category": "Acronym",
                    "definition": "Definition of Ready — standard checklist determining if a story is ready for sprint planning.",
                    "synonyms": ["Ready Criteria"],
                    "example": "This story cannot be pulled into the sprint until it meets DoR."
                }
            ],
            "dataEntities": [
                {
                    "entityName": "OrderTrackingEvent",
                    "description": "Log entry tracking real-time delivery status updates",
                    "attributes": [
                        {"name": "eventId", "type": "UUID", "required": True, "description": "Unique event identifier"},
                        {"name": "status", "type": "String", "required": True, "description": "In Transit | Out for Delivery | Delivered"},
                        {"name": "timestamp", "type": "DateTime", "required": True, "description": "UTC timestamp of event"}
                    ]
                }
            ]
        })

    elif "Quality Assurance" in system_prompt:
        return json.dumps({
            "featureTitle": "Order Tracking & Notifications",
            "summary": "Full QA test suite covering functional, edge case, and negative scenarios.",
            "testCases": [
                {
                    "id": "TC-001",
                    "title": "Verify Live Map Updates on Active Order",
                    "type": "Happy Path",
                    "requirementId": "US-001",
                    "preconditions": "User is logged in and has an active order in 'Out for Delivery' status.",
                    "steps": [
                        "1. Navigate to /orders/track/12345",
                        "2. Observe map canvas and status indicator badge",
                        "3. Wait 30 seconds for telemetry update"
                    ],
                    "expectedResult": "Map marker updates position smooth animation without page refresh.",
                    "priority": "High"
                },
                {
                    "id": "TC-002",
                    "title": "Handle Network Timeout During Live Telemetry Fetch",
                    "type": "Negative",
                    "requirementId": "US-001",
                    "preconditions": "Network connections throttled or offline",
                    "steps": [
                        "1. Open tracking page",
                        "2. Disconnect network adapter"
                    ],
                    "expectedResult": "Toast alert displays 'Connection lost. Retrying...', map retains last known position.",
                    "priority": "Medium"
                }
            ],
            "testDataRequirements": [
                "Active customer user account with 1 active order",
                "Simulated GPS telemetry generator script"
            ]
        })

    return json.dumps({"error": "Unknown agent prompt in mock mode."})

def _get_client() -> Anthropic:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to your .env file."
        )
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def call_llm(system_prompt: str, user_message: str) -> str:
    """Send a message to Claude and return the raw text response."""
    if _is_mock_mode():
        return _get_mock_response(system_prompt, user_message)
        
    client = _get_client()
    response = client.messages.create(
        model=LLM_MODEL,
        max_tokens=LLM_MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


def call_llm_json(system_prompt: str, user_message: str) -> dict:
    """Call Claude and parse the response as JSON.

    The system prompt should instruct the model to respond ONLY with
    valid JSON. We extract the first JSON object/array from the response
    to be resilient against markdown fences or preamble text.
    """
    raw = call_llm(system_prompt, user_message)

    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Extract JSON from markdown fences or surrounding text
    patterns = [
        r"```json\s*([\s\S]*?)```",
        r"```\s*([\s\S]*?)```",
        r"(\{[\s\S]*\})",
        r"(\[[\s\S]*\])",
    ]
    for pat in patterns:
        m = re.search(pat, raw)
        if m:
            try:
                return json.loads(m.group(1).strip())
            except json.JSONDecodeError:
                continue

    raise ValueError(f"Failed to parse LLM response as JSON. Raw response:\n{raw[:500]}")
