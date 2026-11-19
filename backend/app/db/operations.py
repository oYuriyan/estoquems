"""Durable operation ledger; contains no integration credentials or raw remote bodies."""

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from app.db.session import Base
import uuid
from datetime import datetime, timezone


def generate_uuid():
    return str(uuid.uuid4())


def timestamp():
    return datetime.now(timezone.utc)


class QuoteOperation(Base):
    __tablename__ = "quote_operations"
    id = Column(String, primary_key=True, default=generate_uuid)
    quote_id = Column(String, ForeignKey("quotes.id"), nullable=False, index=True)
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)
    parent_id = Column(String, ForeignKey("quote_operations.id"), nullable=True)
    action = Column(String(16), nullable=False)
    status = Column(String(24), nullable=False, default="PENDING", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    generation = Column(Integer, nullable=False, default=0)
    lease_until = Column(DateTime(timezone=True), nullable=True)
    message = Column(String, nullable=False, default="")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=timestamp,
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class OperationItem(Base):
    __tablename__ = "operation_items"
    __table_args__ = (UniqueConstraint("operation_id", "equipment_id"),)
    id = Column(String, primary_key=True, default=generate_uuid)
    operation_id = Column(
        String, ForeignKey("quote_operations.id"), nullable=False, index=True
    )
    equipment_id = Column(String, ForeignKey("equipments.id"), nullable=False)
    id_glpi = Column(String, nullable=False)
    serial = Column(String, nullable=False)
    original_status = Column(String, nullable=False)
    observed_state = Column(String(24), nullable=True)
    status = Column(String(24), nullable=False, default="pending")
    message = Column(String, nullable=False, default="Aguardando confirmação")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class OperationEvent(Base):
    __tablename__ = "operation_events"
    id = Column(String, primary_key=True, default=generate_uuid)
    operation_id = Column(
        String, ForeignKey("quote_operations.id"), nullable=False, index=True
    )
    actor_id = Column(String, ForeignKey("users.id"), nullable=True)
    kind = Column(String(40), nullable=False)
    status = Column(String(24), nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=timestamp,
        nullable=False,
    )
