"""
Interactive What-If Scenario Calculation Engine.
Models the microarchitectural impact of changes to frequency, base CPI,
cache miss rates, branch mispredictions, and pipeline stalls.
"""

def format_time(seconds: float) -> str:
    if seconds < 1e-6:
        return f"{seconds * 1e9:.2f} ns"
    elif seconds < 1e-3:
        return f"{seconds * 1e6:.2f} µs"
    elif seconds < 1.0:
        return f"{seconds * 1e3:.2f} ms"
    else:
        return f"{seconds:.2f} s"


class WhatIfService:

    BASELINE_FREQ = 3.0
    BASELINE_BASE_CPI = 2.47
    BASELINE_CACHE_MISS = 10.0
    BASELINE_BRANCH_MIS = 8.0
    BASELINE_STALLS = 2.0
    BASELINE_IC = 10000.0

    @classmethod
    def calculate(cls,
                  frequency_ghz: float = 3.0,
                  base_cpi: float = 2.47,
                  cache_miss_rate: float = 10.0,
                  branch_mispredict_rate: float = 8.0,
                  stall_cycles: float = 2.0,
                  instruction_count: float = 10000.0) -> dict:
        
        # Penalties:
        # Cache penalty addition to CPI: miss_rate * miss_latency_weight
        cache_penalty_cpi = (cache_miss_rate / 100.0) * 12.0
        # Branch penalty addition to CPI: branch_mis * flush_penalty_weight
        branch_penalty_cpi = (branch_mispredict_rate / 100.0) * 8.0
        # Pipeline structural / dependency stall cycles per instruction
        stall_penalty_cpi = stall_cycles * 0.08

        effective_cpi = base_cpi + cache_penalty_cpi + branch_penalty_cpi + stall_penalty_cpi
        ipc = 1.0 / effective_cpi if effective_cpi > 0 else 0

        # T_exec = (IC * CPI_effective) / (frequency_ghz * 1e9) in seconds
        freq_hz = frequency_ghz * 1e9
        execution_time_sec = (instruction_count * effective_cpi) / freq_hz
        execution_time_ms = execution_time_sec * 1000.0

        # Baseline execution time
        baseline_cache_penalty = (cls.BASELINE_CACHE_MISS / 100.0) * 12.0
        baseline_branch_penalty = (cls.BASELINE_BRANCH_MIS / 100.0) * 8.0
        baseline_stall_penalty = cls.BASELINE_STALLS * 0.08
        baseline_effective_cpi = cls.BASELINE_BASE_CPI + baseline_cache_penalty + baseline_branch_penalty + baseline_stall_penalty
        baseline_exec_time_sec = (instruction_count * baseline_effective_cpi) / (cls.BASELINE_FREQ * 1e9)
        baseline_exec_time_ms = baseline_exec_time_sec * 1000.0

        # Positive means faster execution (lower latency)
        if execution_time_ms > 0:
            speedup_pct = ((baseline_exec_time_ms - execution_time_ms) / baseline_exec_time_ms) * 100.0
        else:
            speedup_pct = 0.0

        cpi_components = {
            "Base Execution": round(base_cpi, 2),
            "Cache Miss Penalty": round(cache_penalty_cpi, 2),
            "Branch Penalty": round(branch_penalty_cpi, 2),
            "Pipeline Stalls": round(stall_penalty_cpi, 2)
        }

        # Sensitivity sweep data (frequency vs execution time)
        sweep_freqs = [1.0, 2.0, 3.0, 4.0, 5.0]
        sweep_times = [round(((instruction_count * effective_cpi) / (f * 1e9)) * 1000.0, 2) for f in sweep_freqs]

        return {
            "effective_cpi": round(effective_cpi, 2),
            "ipc": round(ipc, 2),
            "execution_time_ms": round(execution_time_ms, 3),
            "execution_time_formatted": format_time(execution_time_sec),
            "speedup_pct": round(speedup_pct, 1),
            "baseline_time_ms": round(baseline_exec_time_ms, 3),
            "cpi_components": cpi_components,
            "sensitivity_analysis": {
                "frequencies": sweep_freqs,
                "execution_times": sweep_times
            }
        }
