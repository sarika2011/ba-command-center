"""Requirements Traceability Matrix (RTM) Engine — links requirements, JIRA tickets,
test cases, risks, decisions, and baselines into a single source of truth."""

from typing import List, Dict, Any
from datetime import datetime

class RTMEngine:
    def __init__(self):
        self.matrix: List[Dict[str, Any]] = []

    def get_rtm(self) -> List[Dict[str, Any]]:
        """Return the current Requirements Traceability Matrix."""
        if not self.matrix:
            # Seed with comprehensive default trace records if empty
            self.matrix = [
                {
                    "reqId": "REQ-001",
                    "userStory": "As a customer, I want real-time order tracking on a live map so I know when my delivery arrives.",
                    "priority": "Must Have (MoSCoW)",
                    "jiraTicket": "JIRA-101",
                    "testCases": ["TC-001", "TC-002"],
                    "risks": ["RISK-01"],
                    "decisions": ["DEC-001"],
                    "status": "Approved Baseline",
                    "lastUpdated": datetime.utcnow().strftime("%Y-%m-%d")
                },
                {
                    "reqId": "REQ-002",
                    "userStory": "As an admin, I want to configure SMS notification dispatch rules to reduce support load.",
                    "priority": "Should Have (MoSCoW)",
                    "jiraTicket": "JIRA-102",
                    "testCases": ["TC-003"],
                    "risks": ["RISK-02"],
                    "decisions": ["DEC-002"],
                    "status": "In Development",
                    "lastUpdated": datetime.utcnow().strftime("%Y-%m-%d")
                },
                {
                    "reqId": "REQ-003",
                    "userStory": "As a finance manager, I want automated ROI dashboard reports for executive board review.",
                    "priority": "Could Have (MoSCoW)",
                    "jiraTicket": "JIRA-103",
                    "testCases": ["TC-004"],
                    "risks": [],
                    "decisions": ["DEC-003"],
                    "status": "Draft",
                    "lastUpdated": datetime.utcnow().strftime("%Y-%m-%d")
                }
            ]
        return self.matrix

    def add_entry(self, entry: Dict[str, Any]):
        self.matrix.append(entry)

rtm_engine = RTMEngine()
