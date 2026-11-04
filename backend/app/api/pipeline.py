import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import PipelineRun
from ..services.pipeline_simulator import PipelineSimulatorService
from ..schemas.schemas import PipelineSimulateRequest, PipelineSimulateResponse

router = APIRouter(prefix="/api/pipeline", tags=["Pipeline Simulator"])

@router.post("/simulate", response_model=PipelineSimulateResponse)
def simulate_pipeline(req: PipelineSimulateRequest, db: Session = Depends(get_db)):
    result = PipelineSimulatorService.simulate(
        instruction_count=req.instruction_count or 6,
        forwarding=req.forwarding_enabled if req.forwarding_enabled is not None else True,
        custom_instructions=req.custom_instructions,
        execution_mode=req.execution_mode or "in_order",
        issue_width=req.issue_width or 2,
        rob_size=req.rob_size or 16
    )

    try:
        record = PipelineRun(
            program_name=result["program_name"],
            forwarding_enabled=result["forwarding_enabled"],
            total_cycles=result["total_cycles"],
            ideal_cycles=result["ideal_cycles"],
            stall_cycles=result["stall_cycles"],
            cpi=result["cpi"],
            ipc=result["ipc"],
            efficiency_pct=result["efficiency_pct"],
            grid_json=json.dumps(result["grid"])
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.get("/default-program")
def get_default_program():
    from ..services.pipeline_simulator import DEFAULT_PROGRAM
    return {"program": DEFAULT_PROGRAM}

