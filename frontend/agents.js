/**
 * Agent Configuration & Metadata for all 12 Core Business Analyst AI Workers
 */
const AGENT_CONFIGS = {
  "auto": {
    name: "Auto-Detect Mode",
    subtitle: "Paste your input and I'll route it to the right BA agent automatically.",
    chip: "Smart Routing",
    endpoint: "/api/detect-intent",
    placeholder: "Paste raw notes, user feedback, meeting transcripts, or project briefs here..."
  },
  "requirements": {
    name: "Requirements Clarifier",
    subtitle: "Turn raw input into INVEST user stories, Gherkin ACs, non-functional requirements, and DoR checklist.",
    chip: "INVEST & Gherkin AC",
    endpoint: "/api/requirements",
    placeholder: "Paste feature notes, user requests, or raw requirements text here..."
  },
  "jira": {
    name: "JIRA Ticket Drafter",
    subtitle: "Draft production-ready JIRA issues with AC, story points, tags, and CSV export.",
    chip: "JIRA Ticket Export",
    endpoint: "/api/jira",
    placeholder: "Enter feature description or user story to convert into JIRA ticket format..."
  },
  "gap-analysis": {
    name: "Gap Analysis (As-Is vs To-Be)",
    subtitle: "Compare current vs desired state, compute severity scoring, and generate rollout roadmap phasing.",
    chip: "As-Is vs To-Be Matrix",
    endpoint: "/api/gap-analysis",
    isDualInput: true,
    placeholderAsIs: "AS-IS (Current State):\nPaste current system architecture, manual workflow, or existing capabilities here...",
    placeholderToBe: "TO-BE REQUIREMENTS (Desired State):\nPaste target requirements or desired architecture here..."
  },
  "test-cases": {
    name: "QA Test Case Generator",
    subtitle: "Generate happy path, edge cases, negative tests, and step-by-step test execution suites.",
    chip: "QA Test Suite",
    endpoint: "/api/test-cases",
    placeholder: "Paste user story or acceptance criteria to generate QA test cases..."
  },
  "meeting-prep": {
    name: "Meeting Prep & Facilitation",
    subtitle: "Timeboxed agenda, stakeholder questions, risks, and meeting preparation checklist.",
    chip: "Agenda & Facilitation",
    endpoint: "/api/meeting-prep",
    isMeetingInput: true,
    placeholder: "Enter background notes, goals, or context for the upcoming meeting..."
  },
  "minutes": {
    name: "Executive Meeting Minutes",
    subtitle: "Synthesize raw transcripts or audio notes into executive minutes, decision log, and next steps.",
    chip: "Minutes & Decision Log",
    endpoint: "/api/minutes",
    placeholder: "Paste raw meeting transcript or call audio dump here..."
  },
  "action-items": {
    name: "Action Items & Task Extractor",
    subtitle: "Extract tasks with assignees, priorities, due dates, and trackable checkboxes.",
    chip: "Action Item Tracker",
    endpoint: "/api/action-items",
    placeholder: "Paste meeting notes or discussion logs to extract actionable tasks..."
  },
  "process-model": {
    name: "Process & Workflow Modeler",
    subtitle: "Generate BPMN swimlane workflows, decision points, bottlenecks, handoffs, and Mermaid flowcharts.",
    chip: "BPMN & Mermaid Flow",
    endpoint: "/api/process-model",
    placeholder: "Describe the business process or operational workflow step-by-step..."
  },
  "business-case": {
    name: "Business Case & ROI Builder",
    subtitle: "Financial cost-benefit analysis, payback period calculation, and strategic executive alignment.",
    chip: "ROI & Financial Case",
    endpoint: "/api/business-case",
    placeholder: "Describe the proposed initiative, current problem, rough cost, and expected benefits..."
  },
  "risk-log": {
    name: "Risk & Assumption Log (RAID)",
    subtitle: "Extract technical/business risks, scoring matrix (1-9), mitigation strategies, and assumptions.",
    chip: "RAID Risk Matrix",
    endpoint: "/api/risk-log",
    placeholder: "Paste project brief or technical architecture to extract RAID log items..."
  },
  "glossary": {
    name: "Data Dictionary & Glossary",
    subtitle: "Extract domain terms, acronyms, and data entities into a living project dictionary.",
    chip: "Domain Glossary",
    endpoint: "/api/glossary",
    placeholder: "Paste technical documents or domain specs to generate a Data Dictionary..."
  }
};
