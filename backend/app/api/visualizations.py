from fastapi import APIRouter
from ..services.device_monitor import DeviceMonitorService

router = APIRouter(prefix="/api/visualizations", tags=["Advanced Visualizations"])

@router.get("/data")
def get_visualizations_data():
    live = DeviceMonitorService.get_live_metrics()
    per_core = live.get("per_core_percent", [25.0] * 8)
    
    # 8 cores x 7 time intervals heatmap
    heatmap_matrix = []
    for c_idx, base_val in enumerate(per_core):
        row = []
        for t in range(7):
            val = max(5, min(100, int(base_val + (c_idx * 3) - (t * 2) + ((t * c_idx) % 9))))
            row.append(val)
        heatmap_matrix.append(row)

    # Sankey flow data (Instruction decode to execution ports to memory)
    sankey_data = {
        "nodes": [
            {"name": "Fetched Instructions"},
            {"name": "Integer ALU"},
            {"name": "Floating Point"},
            {"name": "Load/Store Queue"},
            {"name": "Branch Unit"},
            {"name": "L1 Cache Hit"},
            {"name": "L2/L3 Cache"},
            {"name": "Main DRAM"}
        ],
        "links": [
            {"source": 0, "target": 1, "value": 42},
            {"source": 0, "target": 2, "value": 18},
            {"source": 0, "target": 3, "value": 28},
            {"source": 0, "target": 4, "value": 12},
            {"source": 3, "target": 5, "value": 22},
            {"source": 3, "target": 6, "value": 5},
            {"source": 3, "target": 7, "value": 1}
        ]
    }

    # Execution time waterfall breakdown (in cycles)
    waterfall_data = [
        {"stage": "Base Ideal Execution", "cycles": 10000, "type": "base"},
        {"stage": "RAW Hazard Stalls", "cycles": 1840, "type": "penalty"},
        {"stage": "L1 Cache Misses", "cycles": 2400, "type": "penalty"},
        {"stage": "Branch Flush Penalties", "cycles": 1420, "type": "penalty"},
        {"stage": "Memory Bus Contention", "cycles": 940, "type": "penalty"},
        {"stage": "Forwarding Recovery", "cycles": -820, "type": "benefit"},
        {"stage": "Total Measured Latency", "cycles": 15780, "type": "total"}
    ]

    # Memory latency pyramid
    memory_pyramid = [
        {"level": "L1 Data Cache", "size": "32 KB", "latency_cycles": 4, "bandwidth": "2.8 TB/s", "hit_rate": 94.2},
        {"level": "L2 Unified Cache", "size": "1 MB", "latency_cycles": 14, "bandwidth": "1.2 TB/s", "hit_rate": 88.5},
        {"level": "L3 Shared Cache", "size": "32 MB", "latency_cycles": 42, "bandwidth": "520 GB/s", "hit_rate": 78.4},
        {"level": "DDR5 System RAM", "size": "32 GB", "latency_cycles": 180, "bandwidth": "68 GB/s", "hit_rate": 99.9}
    ]

    # CPI vs IPC curve points
    cpi_range = [0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0]
    cpi_vs_ipc = [{"cpi": c, "ipc": round(1.0 / c, 2)} for c in cpi_range]

    logical_cores = live.get("logical_cores") or len(per_core) or 8
    physical_cores = live.get("physical_cores") or 4

    return {
        "logical_cores": logical_cores,
        "physical_cores": physical_cores,
        "heatmap": heatmap_matrix,
        "sankey": sankey_data,
        "waterfall": waterfall_data,
        "memory_pyramid": memory_pyramid,
        "cpi_vs_ipc": cpi_vs_ipc
    }

