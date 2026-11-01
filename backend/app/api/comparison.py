import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import CPUComparisonRecord
from ..services.comparison_engine import CPUComparisonService
from ..schemas.schemas import ComparisonAnalyzeRequest, ComparisonAnalyzeResponse

router = APIRouter(prefix="/api/comparison", tags=["CPU Comparison"])

@router.post("/analyze", response_model=ComparisonAnalyzeResponse)
def compare_cpus(req: ComparisonAnalyzeRequest, db: Session = Depends(get_db)):
    result = CPUComparisonService.compare(
        cpu_a=req.cpu_a.model_dump(),
        cpu_b=req.cpu_b.model_dump()
    )

    try:
        record = CPUComparisonRecord(
            cpu_a_name=req.cpu_a.name,
            cpu_b_name=req.cpu_b.name,
            speedup_factor=result["speedup_factor"],
            percentage_gain=result["percentage_gain"],
            details_json=json.dumps(result)
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.get("/presets")
def get_presets():
    return {
        "presets": [
            {
                "id": "ryzen_vs_intel",
                "label": "AMD Ryzen 9 7950X vs Intel Core i9-14900K",
                "cpu_a": {"name": "AMD Ryzen 9 7950X", "frequency_ghz": 4.5, "cpi": 1.85, "instruction_count": 10000},
                "cpu_b": {"name": "Intel Core i9-14900K", "frequency_ghz": 5.6, "cpi": 2.10, "instruction_count": 10000}
            },
            {
                "id": "arm_vs_graviton",
                "label": "ARM Neoverse V2 vs AWS Graviton 3",
                "cpu_a": {"name": "AWS Graviton 3", "frequency_ghz": 2.6, "cpi": 1.45, "instruction_count": 10000},
                "cpu_b": {"name": "ARM Neoverse V2", "frequency_ghz": 3.6, "cpi": 1.25, "instruction_count": 10000}
            },
            {
                "id": "m3_vs_ultra",
                "label": "Apple M3 Max vs Intel Core Ultra 9 185H",
                "cpu_a": {"name": "Intel Ultra 9 185H", "frequency_ghz": 5.1, "cpi": 2.20, "instruction_count": 10000},
                "cpu_b": {"name": "Apple M3 Max", "frequency_ghz": 4.05, "cpi": 1.35, "instruction_count": 10000}
            },
            {
                "id": "riscv_boom",
                "label": "RISC-V Rocket Core vs BOOM Out-of-Order",
                "cpu_a": {"name": "Rocket In-Order", "frequency_ghz": 1.5, "cpi": 2.65, "instruction_count": 10000},
                "cpu_b": {"name": "BOOM OoO Core", "frequency_ghz": 2.0, "cpi": 1.40, "instruction_count": 10000}
            }
        ]
    }

