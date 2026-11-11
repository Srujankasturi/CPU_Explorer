"""
Dual-CPU Comparison Engine.
Computes execution differential, speedup factor, multi-dimensional architectural metrics,
and radar scoring between Baseline and Target CPUs with input validation.
"""
from typing import Dict, Any

class CPUComparisonService:

    @staticmethod
    def compare(cpu_a: dict, cpu_b: dict) -> dict:
        name_a = str(cpu_a.get("name") or "CPU - A (Base)").strip()
        try:
            freq_a = float(cpu_a.get("frequency_ghz", 2.5))
            cpi_a = float(cpu_a.get("cpi", 3.20))
            ic_a = float(cpu_a.get("instruction_count", 10000.0))
        except (ValueError, TypeError):
            freq_a, cpi_a, ic_a = 2.5, 3.20, 10000.0

        name_b = str(cpu_b.get("name") or "CPU - B (Target)").strip()
        try:
            freq_b = float(cpu_b.get("frequency_ghz", 3.0))
            cpi_b = float(cpu_b.get("cpi", 2.47))
            ic_b = float(cpu_b.get("instruction_count", 10000.0))
        except (ValueError, TypeError):
            freq_b, cpi_b, ic_b = 3.0, 2.47, 10000.0

        # Input validation
        if freq_a <= 0:
            raise ValueError("CPU A frequency must be strictly positive (> 0 GHz)")
        if freq_b <= 0:
            raise ValueError("CPU B frequency must be strictly positive (> 0 GHz)")
        if cpi_a <= 0:
            raise ValueError("CPU A CPI must be strictly positive (> 0)")
        if cpi_b <= 0:
            raise ValueError("CPU B CPI must be strictly positive (> 0)")
        if ic_a <= 0:
            raise ValueError("CPU A instruction count must be strictly positive (> 0)")
        if ic_b <= 0:
            raise ValueError("CPU B instruction count must be strictly positive (> 0)")

        # T_exec = (IC * CPI) / (freq_ghz * 1e9) in seconds -> ms
        t_exec_a_sec = (ic_a * cpi_a) / (freq_a * 1e9)
        t_exec_b_sec = (ic_b * cpi_b) / (freq_b * 1e9)
        t_exec_a_ms = t_exec_a_sec * 1000.0
        t_exec_b_ms = t_exec_b_sec * 1000.0

        ipc_a = 1.0 / cpi_a if cpi_a > 0 else 0.0
        ipc_b = 1.0 / cpi_b if cpi_b > 0 else 0.0

        mips_a = ic_a / (t_exec_a_sec * 1e6) if t_exec_a_sec > 0 else 0.0
        mips_b = ic_b / (t_exec_b_sec * 1e6) if t_exec_b_sec > 0 else 0.0

        # Speedup S = T_exec_A / T_exec_B
        speedup_factor = (t_exec_a_ms / t_exec_b_ms) if t_exec_b_ms > 0 else 1.0
        pct_gain = (speedup_factor - 1.0) * 100.0

        winner = name_b if speedup_factor >= 1.0 else name_a

        # Metric breakdown comparisons
        comparison_metrics = [
            {
                "metric": "Clock Frequency",
                "unit": "GHz",
                "val_a": round(freq_a, 2),
                "val_b": round(freq_b, 2),
                "delta": round(((freq_b - freq_a) / freq_a) * 100, 1),
                "winner": "b" if freq_b > freq_a else "a"
            },
            {
                "metric": "Average CPI",
                "unit": "cyc/inst",
                "val_a": round(cpi_a, 2),
                "val_b": round(cpi_b, 2),
                "delta": round(((cpi_b - cpi_a) / cpi_a) * 100, 1),
                "winner": "a" if cpi_a < cpi_b else "b"
            },
            {
                "metric": "IPC Throughput",
                "unit": "inst/cyc",
                "val_a": round(ipc_a, 4),
                "val_b": round(ipc_b, 4),
                "delta": round(((ipc_b - ipc_a) / ipc_a) * 100, 1),
                "winner": "b" if ipc_b > ipc_a else "a"
            },
            {
                "metric": "Execution Latency",
                "unit": "ms",
                "val_a": round(t_exec_a_ms, 3),
                "val_b": round(t_exec_b_ms, 3),
                "delta": round(((t_exec_b_ms - t_exec_a_ms) / t_exec_a_ms) * 100, 1),
                "winner": "b" if t_exec_b_ms < t_exec_a_ms else "a"
            },
            {
                "metric": "MIPS Rating",
                "unit": "MIPS",
                "val_a": round(mips_a, 1),
                "val_b": round(mips_b, 1),
                "delta": round(((mips_b - mips_a) / mips_a) * 100, 1),
                "winner": "b" if mips_b > mips_a else "a"
            }
        ]

        # Normalized radar parameters (0-100 scale without artificial saturation)
        max_mips_ref = max(6000.0, max(mips_a, mips_b) * 1.25)
        max_gips_ref = max(16.0, max(ipc_a * freq_a, ipc_b * freq_b) * 1.25)
        min_exec_ms = min(t_exec_a_ms, t_exec_b_ms)

        latency_score_a = 95.0 if t_exec_a_ms <= t_exec_b_ms else round(max(5.0, 95.0 * (min_exec_ms / max(0.0001, t_exec_a_ms))), 1)
        latency_score_b = 95.0 if t_exec_b_ms <= t_exec_a_ms else round(max(5.0, 95.0 * (min_exec_ms / max(0.0001, t_exec_b_ms))), 1)

        radar_categories = ["Clock Speed", "IPC Efficiency", "Compute Density", "Throughput", "Latency Efficiency"]
        radar_a = [
            round(min(100.0, max(5.0, (freq_a / 6.0) * 100)), 1),
            round(min(100.0, max(5.0, (ipc_a / 4.0) * 100)), 1),
            round(min(100.0, max(5.0, (mips_a / max_mips_ref) * 100)), 1),
            round(min(100.0, max(5.0, ((ipc_a * freq_a) / max_gips_ref) * 100)), 1),
            latency_score_a
        ]
        radar_b = [
            round(min(100.0, max(5.0, (freq_b / 6.0) * 100)), 1),
            round(min(100.0, max(5.0, (ipc_b / 4.0) * 100)), 1),
            round(min(100.0, max(5.0, (mips_b / max_mips_ref) * 100)), 1),
            round(min(100.0, max(5.0, ((ipc_b * freq_b) / max_gips_ref) * 100)), 1),
            latency_score_b
        ]

        return {
            "cpu_a": {
                "name": name_a,
                "frequency_ghz": freq_a,
                "cpi": cpi_a,
                "ipc": round(ipc_a, 4),
                "instruction_count": ic_a,
                "total_cycles": round(ic_a * cpi_a),
                "execution_time_ms": round(t_exec_a_ms, 3),
                "mips": round(mips_a, 1)
            },
            "cpu_b": {
                "name": name_b,
                "frequency_ghz": freq_b,
                "cpi": cpi_b,
                "ipc": round(ipc_b, 4),
                "instruction_count": ic_b,
                "total_cycles": round(ic_b * cpi_b),
                "execution_time_ms": round(t_exec_b_ms, 3),
                "mips": round(mips_b, 1)
            },
            "cpu_a_exec_time_ms": round(t_exec_a_ms, 3),
            "cpu_b_exec_time_ms": round(t_exec_b_ms, 3),
            "cpu_a_mips": round(mips_a, 1),
            "cpu_b_mips": round(mips_b, 1),
            "cpu_a_ipc": round(ipc_a, 4),
            "cpu_b_ipc": round(ipc_b, 4),
            "speedup_factor": round(speedup_factor, 3),
            "percentage_gain": round(pct_gain, 1),
            "speedup_pct": round(pct_gain, 1),
            "winner": winner,
            "comparison_metrics": comparison_metrics,
            "radar_data": {
                "categories": radar_categories,
                "cpu_a": radar_a,
                "cpu_b": radar_b
            }
        }
