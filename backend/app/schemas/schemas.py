from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

# Single CPU Analysis
class SingleAnalysisRequest(BaseModel):
    instruction_count: float = Field(..., gt=0, description="Total Instructions (IC)")
    cycles: float = Field(..., gt=0, description="Total Clock Cycles")
    frequency: float = Field(..., gt=0, description="Clock frequency value")
    unit: str = Field(default="1e9", description="1e9 for GHz, 1e6 for MHz")

class SingleAnalysisResponse(BaseModel):
    instruction_count: float
    cycles: float
    frequency_ghz: float
    cycle_time_ns: float
    cpi: float
    ipc: float
    execution_time_ms: float
    execution_time_formatted: str
    mips: float
    trend_cpi: float
    trend_ipc: float
    trend_exectime: float
    trend_mips: float
    stage_breakdown: Dict[str, Any]
    instruction_distribution: Dict[str, Any]


# Instruction Set Analysis
class InstructionSetItem(BaseModel):
    category: str
    count: float = Field(..., ge=0)
    cpi: float = Field(..., gt=0)

class InstructionSetAnalysisRequest(BaseModel):
    alu_count: float = Field(default=4200, ge=0)
    alu_cpi: float = Field(default=1.0, gt=0)
    mem_count: float = Field(default=2800, ge=0)
    mem_cpi: float = Field(default=4.0, gt=0)
    branch_count: float = Field(default=1200, ge=0)
    branch_cpi: float = Field(default=3.0, gt=0)
    other_count: float = Field(default=1800, ge=0)
    other_cpi: float = Field(default=2.0, gt=0)
    frequency: float = Field(default=3.0, gt=0)
    unit: str = Field(default="1e9")

class InstructionSetAnalysisResponse(BaseModel):
    total_instructions: float
    total_cycles: float
    weighted_cpi: float
    cpi: Optional[float] = None
    ipc: float
    frequency_ghz: float
    cycle_time_ns: Optional[float] = None
    execution_time_ms: float
    execution_time_formatted: str
    mips: float
    trend_cpi: Optional[float] = None
    trend_ipc: Optional[float] = None
    trend_exectime: Optional[float] = None
    trend_mips: Optional[float] = None
    category_percentages: Dict[str, float]
    stage_breakdown: Dict[str, Any]
    instruction_distribution: Optional[Dict[str, Any]] = None


# Pipeline Simulation
class PipelineSimulateRequest(BaseModel):
    program_name: Optional[str] = "Default RISC Program"
    instruction_count: Optional[int] = Field(default=6, ge=1, le=12)
    forwarding_enabled: Optional[bool] = True
    custom_instructions: Optional[List[str]] = None

class PipelineCell(BaseModel):
    instruction_id: str
    instruction_text: str
    instruction_type: str
    cycle: int
    stage: str # "IF", "ID", "EX", "MEM", "WB", "STALL", "FLUSH", ""
    is_hazard: bool = False
    hazard_info: Optional[str] = None

class PipelineSimulateResponse(BaseModel):
    program_name: str
    forwarding_enabled: bool
    num_instructions: int
    total_cycles: int
    ideal_cycles: int
    stall_cycles: int
    cpi: float
    ipc: float
    efficiency_pct: float
    grid: List[List[str]]
    instructions: List[Dict[str, str]]
    cycle_headers: List[str]
    hazards_detected: List[Dict[str, Any]]


# Bottleneck Analysis
class BottleneckAnalyzeRequest(BaseModel):
    cpi: Optional[float] = 2.47
    llc_miss_rate: Optional[float] = 28.4
    branch_mispredict_rate: Optional[float] = 8.0
    pipeline_stall_pct: Optional[float] = 18.0
    dram_latency_ns: Optional[float] = 68.0

class BottleneckItem(BaseModel):
    name: str
    subsystem: str
    description: str
    penalty_cycles: int
    impact_cycles: Optional[int] = None
    impact_pct: float
    severity: str # "Low", "Medium", "High", "Critical"
    cause: str
    suggestion: str

class BottleneckAnalyzeResponse(BaseModel):
    bottleneck_score: float
    severity: str
    risk_level: str
    primary_culprit: str
    summary_message: str
    items: List[BottleneckItem]
    distribution: Dict[str, float]
    subsystem_weights: Optional[Dict[str, float]] = None


# CPU Comparison
class CPUConfig(BaseModel):
    name: str = "Processor"
    frequency_ghz: float = 3.0
    cpi: float = 2.0
    instruction_count: float = 10000.0

class ComparisonAnalyzeRequest(BaseModel):
    cpu_a: CPUConfig
    cpu_b: CPUConfig

class ComparisonAnalyzeResponse(BaseModel):
    cpu_a: Dict[str, Any]
    cpu_b: Dict[str, Any]
    cpu_a_exec_time_ms: float
    cpu_b_exec_time_ms: float
    cpu_a_mips: float
    cpu_b_mips: float
    cpu_a_ipc: float
    cpu_b_ipc: float
    speedup_factor: float
    percentage_gain: float
    speedup_pct: float
    winner: str
    comparison_metrics: List[Dict[str, Any]]
    radar_data: Dict[str, Any]


# What-If Analysis
class WhatIfAnalyzeRequest(BaseModel):
    frequency_ghz: float = Field(default=3.0, ge=0.5, le=10.0)
    base_cpi: float = Field(default=2.47, ge=0.5, le=10.0)
    cache_miss_rate: float = Field(default=10.0, ge=0.0, le=100.0)
    branch_mispredict_rate: float = Field(default=8.0, ge=0.0, le=100.0)
    stall_cycles: float = Field(default=2.0, ge=0.0, le=20.0)
    instruction_count: float = Field(default=10000.0, gt=0)

class SaveScenarioRequest(BaseModel):
    scenario_name: str = "Custom Scenario"
    frequency_ghz: float = Field(default=3.0, ge=0.5, le=10.0)
    base_cpi: float = Field(default=2.47, ge=0.5, le=10.0)
    cache_miss_rate: float = Field(default=10.0, ge=0.0, le=100.0)
    branch_mispredict_rate: float = Field(default=8.0, ge=0.0, le=100.0)
    stall_cycles: float = Field(default=2.0, ge=0.0, le=20.0)
    instruction_count: float = Field(default=10000.0, gt=0)

class WhatIfAnalyzeResponse(BaseModel):
    effective_cpi: float
    ipc: float
    execution_time_ms: float
    execution_time_formatted: str
    speedup_pct: float
    baseline_time_ms: float
    cpi_components: Dict[str, float]
    sensitivity_analysis: Dict[str, Any]


# Reports
class ReportCreateRequest(BaseModel):
    title: str
    report_type: str = "Performance Analysis"
    author: Optional[str] = "Dr. Alex Vance"
    summary: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class ReportResponse(BaseModel):
    id: int
    created_at: datetime
    title: str
    report_type: str
    status: str
    author: str
    metrics_summary: str
    summary: Optional[str] = None
    full_content: Dict[str, Any]


# Device Telemetry
class ProcessInfo(BaseModel):
    name: str
    pid: int
    threads: int
    cpu_percent: float
    memory_mb: float
    status: str

class DeviceSpecsResponse(BaseModel):
    device_name: str
    processor_name: str
    physical_cores: int
    logical_cores: int
    max_frequency_mhz: float
    current_frequency_mhz: float
    total_ram_gb: float
    total_disk_gb: float
    os_name: str
    platform: str
    python_version: str

class DeviceLiveResponse(BaseModel):
    timestamp: str
    cpu_percent: float
    per_core_percent: List[float]
    memory_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disk_percent: float
    disk_read_mb_s: float
    disk_write_mb_s: float
    net_io_mbps: float
    estimated_temp_c: float
    top_processes: List[ProcessInfo]

