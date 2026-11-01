import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import AnalysisHistory
from ..services.performance_analyzer import PerformanceAnalyzerService
from ..schemas.schemas import (
    SingleAnalysisRequest,
    SingleAnalysisResponse,
    InstructionSetAnalysisRequest,
    InstructionSetAnalysisResponse
)

router = APIRouter(prefix="/api/analyzer", tags=["Performance Analyzer"])

@router.post("/single", response_model=SingleAnalysisResponse)
def analyze_single(req: SingleAnalysisRequest, db: Session = Depends(get_db)):
    try:
        result = PerformanceAnalyzerService.calculate_single(
            instruction_count=req.instruction_count,
            cycles=req.cycles,
            frequency=req.frequency,
            unit=req.unit
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Save to database history
    try:
        record = AnalysisHistory(
            mode="single",
            instruction_count=result["instruction_count"],
            cycles=result["cycles"],
            frequency_ghz=result["frequency_ghz"],
            cpi=result["cpi"],
            ipc=result["ipc"],
            execution_time_ms=result["execution_time_ms"],
            mips=result["mips"],
            details_json=json.dumps(result)
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.post("/instruction-set", response_model=InstructionSetAnalysisResponse)
def analyze_instruction_set(req: InstructionSetAnalysisRequest, db: Session = Depends(get_db)):
    try:
        result = PerformanceAnalyzerService.calculate_instruction_set(
            alu_count=req.alu_count,
            alu_cpi=req.alu_cpi,
            mem_count=req.mem_count,
            mem_cpi=req.mem_cpi,
            branch_count=req.branch_count,
            branch_cpi=req.branch_cpi,
            other_count=req.other_count,
            other_cpi=req.other_cpi,
            frequency=req.frequency,
            unit=req.unit
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Save to database history
    try:
        record = AnalysisHistory(
            mode="instruction_set",
            instruction_count=result["total_instructions"],
            cycles=result["total_cycles"],
            frequency_ghz=result["frequency_ghz"],
            cpi=result["weighted_cpi"],
            ipc=result["ipc"],
            execution_time_ms=result["execution_time_ms"],
            mips=result["mips"],
            details_json=json.dumps(result)
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.get("/latest")
def get_latest_analysis(db: Session = Depends(get_db)):
    record = db.query(AnalysisHistory).order_by(AnalysisHistory.id.desc()).first()
    if record:
        try:
            return json.loads(record.details_json)
        except Exception:
            pass
    # Fallback default baseline
    return PerformanceAnalyzerService.calculate_single(10000, 24700, 3.0, "1e9")
