import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import BottleneckAudit, AnalysisHistory, PipelineRun
from ..services.bottleneck_analyzer import BottleneckAnalyzerService
from ..schemas.schemas import BottleneckAnalyzeRequest, BottleneckAnalyzeResponse

router = APIRouter(prefix="/api/bottleneck", tags=["Bottleneck Analyzer"])

@router.post("/analyze", response_model=BottleneckAnalyzeResponse)
def analyze_bottlenecks(req: BottleneckAnalyzeRequest, db: Session = Depends(get_db)):
    result = BottleneckAnalyzerService.analyze(
        cpi=req.cpi or 2.47,
        llc_miss_rate=req.llc_miss_rate or 28.4,
        branch_mispredict_rate=req.branch_mispredict_rate or 8.0,
        pipeline_stall_pct=req.pipeline_stall_pct or 18.0,
        dram_latency_ns=req.dram_latency_ns or 68.0,
        issue_width=req.issue_width
    )

    try:
        record = BottleneckAudit(
            bottleneck_score=result["bottleneck_score"],
            severity=result["severity"],
            primary_bottleneck=result["items"][0]["name"] if result["items"] else "Memory Hierarchy",
            summary_json=json.dumps(result)
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.get("/latest")
def get_latest_bottleneck(db: Session = Depends(get_db)):
    record = db.query(BottleneckAudit).order_by(BottleneckAudit.id.desc()).first()
    if record:
        try:
            return json.loads(record.summary_json)
        except Exception:
            pass
    return BottleneckAnalyzerService.analyze()

@router.get("/from-latest", response_model=BottleneckAnalyzeResponse)
def get_bottleneck_from_latest_runs(db: Session = Depends(get_db)):
    latest_perf = db.query(AnalysisHistory).order_by(AnalysisHistory.id.desc()).first()
    latest_pipe = db.query(PipelineRun).order_by(PipelineRun.id.desc()).first()

    cpi = latest_perf.cpi if latest_perf else 2.47
    freq = latest_perf.frequency_ghz if latest_perf else 3.0
    ic = latest_perf.instruction_count if latest_perf else 10000.0

    stall_pct = 18.0
    if latest_pipe and latest_pipe.total_cycles > 0:
        stall_pct = (latest_pipe.stall_cycles / latest_pipe.total_cycles) * 100.0

    result = BottleneckAnalyzerService.analyze(
        cpi=cpi,
        llc_miss_rate=28.4,
        branch_mispredict_rate=8.0,
        pipeline_stall_pct=round(stall_pct, 1),
        dram_latency_ns=68.0,
        instruction_count=ic,
        frequency_ghz=freq
    )
    return result
