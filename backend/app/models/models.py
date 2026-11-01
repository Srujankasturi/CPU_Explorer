from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from ..database.database import Base

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    mode = Column(String(50), default="single")
    instruction_count = Column(Float, nullable=False)
    cycles = Column(Float, nullable=False)
    frequency_ghz = Column(Float, nullable=False)
    cpi = Column(Float, nullable=False)
    ipc = Column(Float, nullable=False)
    execution_time_ms = Column(Float, nullable=False)
    mips = Column(Float, nullable=False)
    details_json = Column(Text, default="{}")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    program_name = Column(String(100), default="Default RISC Program")
    forwarding_enabled = Column(Boolean, default=True)
    total_cycles = Column(Integer, nullable=False)
    ideal_cycles = Column(Integer, nullable=False)
    stall_cycles = Column(Integer, nullable=False)
    cpi = Column(Float, nullable=False)
    ipc = Column(Float, nullable=False)
    efficiency_pct = Column(Float, nullable=False)
    grid_json = Column(Text, default="{}")


class BottleneckAudit(Base):
    __tablename__ = "bottleneck_audits"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    bottleneck_score = Column(Float, nullable=False)
    severity = Column(String(50), default="Medium")
    primary_bottleneck = Column(String(100), default="Memory Hierarchy")
    summary_json = Column(Text, default="{}")


class CPUComparisonRecord(Base):
    __tablename__ = "cpu_comparisons"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    cpu_a_name = Column(String(100), default="CPU A")
    cpu_b_name = Column(String(100), default="CPU B")
    speedup_factor = Column(Float, nullable=False)
    percentage_gain = Column(Float, nullable=False)
    details_json = Column(Text, default="{}")


class WhatIfScenario(Base):
    __tablename__ = "what_if_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    scenario_name = Column(String(100), default="Custom Scenario")
    frequency_ghz = Column(Float, nullable=False)
    base_cpi = Column(Float, nullable=False)
    cache_miss_rate = Column(Float, nullable=False)
    branch_mispredict_rate = Column(Float, nullable=False)
    stall_cycles = Column(Float, nullable=False)
    effective_cpi = Column(Float, nullable=False)
    execution_time_ms = Column(Float, nullable=False)
    speedup_pct = Column(Float, nullable=False)


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    title = Column(String(200), nullable=False)
    report_type = Column(String(100), default="Performance Analysis")
    status = Column(String(50), default="Complete")
    author = Column(String(100), default="Dr. Alex Vance")
    metrics_summary = Column(String(255), default="")
    full_content_json = Column(Text, default="{}")

