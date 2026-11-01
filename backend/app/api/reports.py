import json
import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database.database import get_db
from ..models.models import (
    SavedReport,
    AnalysisHistory,
    PipelineRun,
    BottleneckAudit,
    CPUComparisonRecord,
    WhatIfScenario
)
from ..schemas.schemas import ReportCreateRequest, ReportResponse

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

@router.post("/generate", response_model=ReportResponse)
def generate_report(req: ReportCreateRequest, db: Session = Depends(get_db)):
    data = dict(req.data) if req.data else {}
    summary = req.summary or ""

    if req.report_type == "Performance Analysis":
        if "cpi" not in data or "ipc" not in data:
            latest = db.query(AnalysisHistory).order_by(AnalysisHistory.id.desc()).first()
            if latest:
                data.update({
                    "cpi": round(latest.cpi, 2),
                    "ipc": round(latest.ipc, 4),
                    "execution_time_ms": round(latest.execution_time_ms, 3),
                    "mips": round(latest.mips, 1),
                    "frequency_ghz": latest.frequency_ghz,
                    "instruction_count": latest.instruction_count,
                    "cycles": latest.cycles
                })
        if "cpi" in data and "ipc" in data:
            exec_time = data.get("execution_time_ms", "N/A")
            summary = f"CPI: {data['cpi']} | IPC: {data['ipc']} | Exec Time: {exec_time} ms"
        elif not summary:
            summary = "Performance Analysis benchmark snapshot"

    elif req.report_type == "Pipeline Simulation":
        if "total_cycles" not in data:
            latest = db.query(PipelineRun).order_by(PipelineRun.id.desc()).first()
            if latest:
                data.update({
                    "total_cycles": latest.total_cycles,
                    "ideal_cycles": latest.ideal_cycles,
                    "stall_cycles": latest.stall_cycles,
                    "efficiency_pct": round(latest.efficiency_pct, 1),
                    "forwarding_enabled": latest.forwarding_enabled,
                    "cpi": round(latest.cpi, 2),
                    "ipc": round(latest.ipc, 4)
                })
        if "total_cycles" in data:
            fwd = "On" if data.get("forwarding_enabled", True) else "Off"
            summary = f"Total Cycles: {data['total_cycles']} | Eff: {data.get('efficiency_pct', 'N/A')}% | Forwarding: {fwd}"
        elif not summary:
            summary = "5-Stage Pipeline simulation audit"

    elif req.report_type == "Bottleneck Audit":
        if "bottleneck_score" not in data:
            latest = db.query(BottleneckAudit).order_by(BottleneckAudit.id.desc()).first()
            if latest:
                data.update({
                    "bottleneck_score": round(latest.bottleneck_score, 1),
                    "severity": latest.severity,
                    "primary_bottleneck": latest.primary_bottleneck
                })
        if "bottleneck_score" in data:
            summary = f"Bottleneck Score: {data['bottleneck_score']}% ({data.get('severity', 'Nominal')}) | Primary: {data.get('primary_bottleneck', 'None')}"
        elif not summary:
            summary = "Microarchitectural bottleneck audit"

    elif req.report_type == "CPU Comparison":
        if "speedup_factor" not in data:
            latest = db.query(CPUComparisonRecord).order_by(CPUComparisonRecord.id.desc()).first()
            if latest:
                data.update({
                    "cpu_a_name": latest.cpu_a_name,
                    "cpu_b_name": latest.cpu_b_name,
                    "speedup_factor": round(latest.speedup_factor, 2),
                    "winner": latest.winner
                })
        if "speedup_factor" in data:
            summary = f"Speedup: {data['speedup_factor']}x | Winner: {data.get('winner', 'Target CPU')}"
        elif not summary:
            summary = "Dual-CPU architectural differential comparison"

    else:
        if not summary:
            summary = f"Comprehensive diagnostic run for {req.title}"

    report = SavedReport(
        title=req.title,
        report_type=req.report_type,
        status="Complete",
        author=req.author or "Dr. Alex Vance",
        metrics_summary=summary,
        full_content_json=json.dumps(data)
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportResponse(
        id=report.id,
        created_at=report.created_at,
        title=report.title,
        report_type=report.report_type,
        status=report.status,
        author=report.author,
        metrics_summary=report.metrics_summary,
        summary=report.metrics_summary,
        full_content=data
    )

@router.get("", response_model=list[ReportResponse])
def list_reports(db: Session = Depends(get_db)):
    reports = db.query(SavedReport).order_by(SavedReport.id.desc()).all()
    results = []
    for r in reports:
        try:
            content = json.loads(r.full_content_json)
        except Exception:
            content = {}
        results.append(ReportResponse(
            id=r.id,
            created_at=r.created_at,
            title=r.title,
            report_type=r.report_type,
            status=r.status,
            author=r.author,
            metrics_summary=r.metrics_summary,
            summary=r.metrics_summary,
            full_content=content
        ))
    return results

@router.get("/{id}", response_model=ReportResponse)
def get_report(id: int, db: Session = Depends(get_db)):
    report = db.query(SavedReport).filter(SavedReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        content = json.loads(report.full_content_json)
    except Exception:
        content = {}
    return ReportResponse(
        id=report.id,
        created_at=report.created_at,
        title=report.title,
        report_type=report.report_type,
        status=report.status,
        author=report.author,
        metrics_summary=report.metrics_summary,
        summary=report.metrics_summary,
        full_content=content
    )

@router.delete("/{id}")
def delete_report(id: int, db: Session = Depends(get_db)):
    report = db.query(SavedReport).filter(SavedReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully", "id": id}

@router.get("/{id}/export/json")
def export_report_json(id: int, db: Session = Depends(get_db)):
    report = db.query(SavedReport).filter(SavedReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        content = json.loads(report.full_content_json)
    except Exception:
        content = {}

    payload = {
        "report_id": report.id,
        "title": report.title,
        "report_type": report.report_type,
        "status": report.status,
        "author": report.author,
        "created_at": report.created_at.isoformat(),
        "metrics_summary": report.metrics_summary,
        "content": content
    }
    json_bytes = json.dumps(payload, indent=2).encode('utf-8')
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=report_{id}.json"}
    )

@router.get("/{id}/export/csv")
def export_report_csv(id: int, db: Session = Depends(get_db)):
    report = db.query(SavedReport).filter(SavedReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        content = json.loads(report.full_content_json)
    except Exception:
        content = {}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Field", "Value"])
    writer.writerow(["Report ID", report.id])
    writer.writerow(["Title", report.title])
    writer.writerow(["Type", report.report_type])
    writer.writerow(["Status", report.status])
    writer.writerow(["Author", report.author])
    writer.writerow(["Generated At", report.created_at.strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow(["Metrics Summary", report.metrics_summary])
    writer.writerow([])
    writer.writerow(["Content Key", "Content Value"])
    for k, v in content.items():
        writer.writerow([k, str(v)])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{id}.csv"}
    )
