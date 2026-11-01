import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import WhatIfScenario
from ..services.what_if_engine import WhatIfService
from ..schemas.schemas import WhatIfAnalyzeRequest, WhatIfAnalyzeResponse, SaveScenarioRequest

router = APIRouter(prefix="/api/what-if", tags=["What-If Analysis"])

@router.post("/analyze", response_model=WhatIfAnalyzeResponse)
def analyze_what_if(req: WhatIfAnalyzeRequest):
    result = WhatIfService.calculate(
        frequency_ghz=req.frequency_ghz,
        base_cpi=req.base_cpi,
        cache_miss_rate=req.cache_miss_rate,
        branch_mispredict_rate=req.branch_mispredict_rate,
        stall_cycles=req.stall_cycles,
        instruction_count=req.instruction_count
    )
    return result

@router.post("/save-scenario")
def save_scenario(req: SaveScenarioRequest, db: Session = Depends(get_db)):
    result = WhatIfService.calculate(
        frequency_ghz=req.frequency_ghz,
        base_cpi=req.base_cpi,
        cache_miss_rate=req.cache_miss_rate,
        branch_mispredict_rate=req.branch_mispredict_rate,
        stall_cycles=req.stall_cycles,
        instruction_count=req.instruction_count
    )
    record = WhatIfScenario(
        scenario_name=req.scenario_name,
        frequency_ghz=req.frequency_ghz,
        base_cpi=req.base_cpi,
        cache_miss_rate=req.cache_miss_rate,
        branch_mispredict_rate=req.branch_mispredict_rate,
        stall_cycles=req.stall_cycles,
        effective_cpi=result["effective_cpi"],
        execution_time_ms=result["execution_time_ms"],
        speedup_pct=result["speedup_pct"]
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"message": "Scenario saved successfully", "id": record.id, "scenario_name": record.scenario_name}

@router.get("/scenarios")
def get_scenarios(db: Session = Depends(get_db)):
    scenarios = db.query(WhatIfScenario).order_by(WhatIfScenario.id.desc()).all()
    return {
        "scenarios": [
            {
                "id": s.id,
                "scenario_name": s.scenario_name,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "frequency_ghz": s.frequency_ghz,
                "base_cpi": s.base_cpi,
                "cache_miss_rate": s.cache_miss_rate,
                "branch_mispredict_rate": s.branch_mispredict_rate,
                "stall_cycles": s.stall_cycles,
                "effective_cpi": s.effective_cpi,
                "execution_time_ms": s.execution_time_ms,
                "speedup_pct": s.speedup_pct
            }
            for s in scenarios
        ]
    }
