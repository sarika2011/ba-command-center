from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ai_agent.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="analyst", index=True)

    outputs = relationship("AgentOutput", back_populates="owner")

class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(Integer, primary_key=True, index=True)
    agent_key = Column(String, index=True)
    filename = Column(String, index=True)
    raw_input = Column(Text)
    json_result = Column(Text) # Stored as JSON string
    markdown_result = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="outputs")
