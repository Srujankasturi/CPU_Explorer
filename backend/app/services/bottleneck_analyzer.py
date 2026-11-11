"""
Rule-Based Microarchitectural Bottleneck Analyzer Service.
Classifies execution stalls using standard Top-Down Microarchitecture Analysis (TMAM):
1. Memory Hierarchy Bound (L1/L2/L3/DRAM latency)
2. Pipeline Hazards & Dependencies (RAW, Load-Use stalls)
3. Bad Speculation & Branch Misprediction (Pipeline flush penalty)
4. Structural & Execution Unit Port Contention (ALU/FMA saturation)
"""
from typing import Dict, Any, List

class BottleneckAnalyzerService:

    @staticmethod
    def analyze(cpi: float = 2.47,
                llc_miss_rate: float = 28.4,
                branch_mispredict_rate: float = 8.0,
                pipeline_stall_pct: float = 18.0,
                dram_latency_ns: float = 68.0,
                instruction_count: float = 10000.0,
                frequency_ghz: float = 3.0) -> dict:
        
        # Validation
        if cpi <= 0:
            cpi = 1.0
        if instruction_count <= 0:
            instruction_count = 10000.0
        if frequency_ghz <= 0:
            frequency_ghz = 3.0

        # Total clock cycles = IC * CPI
        total_cycles = instruction_count * cpi
        ideal_cycles = instruction_count * 1.0
        overhead_cycles = max(0.0, total_cycles - ideal_cycles)

        # 1. DRAM latency in clock cycles: latency_ns * freq_ghz
        dram_latency_cycles = max(1.0, dram_latency_ns * frequency_ghz)

        # 2. Memory subsystem penalty:
        # Assumes ~28% memory instructions in canonical workload
        mem_inst_count = instruction_count * 0.28
        memory_penalty_cycles = int(mem_inst_count * (llc_miss_rate / 100.0) * (dram_latency_cycles * 0.08))

        # 3. Branch misprediction penalty:
        # Assumes ~12% branch instructions, 16-stage pipeline flush penalty
        branch_inst_count = instruction_count * 0.12
        branch_flush_penalty = 16.0
        branch_penalty_cycles = int(branch_inst_count * (branch_mispredict_rate / 100.0) * branch_flush_penalty)

        # 4. Pipeline dependency and hazard penalty:
        pipeline_penalty_cycles = int(total_cycles * (pipeline_stall_pct / 100.0) * 0.4)

        # 5. Structural / execution port contention:
        # Port saturation on arithmetic and vector units
        structural_penalty_cycles = max(15, int(instruction_count * 0.42 * 0.06 * (cpi / 1.5)))

        total_penalty = memory_penalty_cycles + pipeline_penalty_cycles + branch_penalty_cycles + structural_penalty_cycles
        if total_penalty <= 0:
            total_penalty = 1

        mem_contrib = (memory_penalty_cycles / total_penalty) * 100.0
        pipe_contrib = (pipeline_penalty_cycles / total_penalty) * 100.0
        branch_contrib = (branch_penalty_cycles / total_penalty) * 100.0
        struct_contrib = (structural_penalty_cycles / total_penalty) * 100.0

        # Bottleneck score: relative overhead above ideal single-cycle execution
        # Formally: (CPI - 1.0) / CPI * 100% weighted with memory & branch contention
        cpi_overhead_pct = ((cpi - 1.0) / cpi) * 100.0 if cpi > 1.0 else 0.0
        composite_score = (cpi_overhead_pct * 0.60) + (llc_miss_rate * 0.25) + (branch_mispredict_rate * 0.15)
        score = min(100.0, max(5.0, round(composite_score, 1)))

        if score < 25.0:
            severity = "Low"
            risk_level = "Nominal Execution"
        elif score < 50.0:
            severity = "Medium"
            risk_level = "Moderate Contention"
        elif score < 75.0:
            severity = "High"
            risk_level = "High Risk"
        else:
            severity = "Critical"
            risk_level = "Severe Bottleneck"

        items = [
            {
                "name": "Memory Subsystem Bottleneck",
                "subsystem": "L3 Cache / DRAM",
                "description": f"High cache miss rate ({llc_miss_rate:.1f}% LLC misses) stalling execution units.",
                "penalty_cycles": memory_penalty_cycles,
                "impact_cycles": memory_penalty_cycles,
                "impact_pct": round(mem_contrib, 1),
                "severity": "High" if llc_miss_rate > 20.0 else "Medium",
                "cause": "Inefficient spatial/temporal cache locality and stride-heavy data access patterns.",
                "suggestion": "Implement cache blocking/tiling, struct-of-arrays (SoA) memory layout, and compiler prefetch intrinsics (_mm_prefetch)."
            },
            {
                "name": "Pipeline Stalls & Starvation",
                "subsystem": "Reservation Stations / ROB",
                "description": f"{pipeline_stall_pct:.1f}% of clock cycles starved due to RAW register dependencies.",
                "penalty_cycles": pipeline_penalty_cycles,
                "impact_cycles": pipeline_penalty_cycles,
                "impact_pct": round(pipe_contrib, 1),
                "severity": "High" if pipeline_stall_pct >= 25.0 else ("Medium" if pipeline_stall_pct >= 15.0 else "Low"),
                "cause": "Long dependency chains in inner loop compute blocks and load-use delays.",
                "suggestion": "Unroll loops to interleave independent instructions; utilize register renaming and software pipelining."
            },
            {
                "name": "Branch Misprediction Penalties",
                "subsystem": "Branch Target Buffer (BTB)",
                "description": f"Branch mispredict rate at {branch_mispredict_rate:.1f}% causing frequent 16-cycle pipeline flushes.",
                "penalty_cycles": branch_penalty_cycles,
                "impact_cycles": branch_penalty_cycles,
                "impact_pct": round(branch_contrib, 1),
                "severity": "High" if branch_mispredict_rate >= 10.0 else ("Medium" if branch_mispredict_rate >= 5.0 else "Low"),
                "cause": "High-entropy branch instructions with unpredictable input data distribution.",
                "suggestion": "Convert branches to conditional moves (CMOV), predicated execution, or lookup table dispatching."
            },
            {
                "name": "Structural ALU Port Contention",
                "subsystem": "Execution Ports 0/1/5",
                "description": "Port saturation on floating-point/vector units during dense calculation.",
                "penalty_cycles": structural_penalty_cycles,
                "impact_cycles": structural_penalty_cycles,
                "impact_pct": round(struct_contrib, 1),
                "severity": "Low" if structural_penalty_cycles < 80 else "Medium",
                "cause": "Imbalanced instruction mix overburdening primary integer and multiplier ports.",
                "suggestion": "Balance arithmetic workloads across independent execution units and exploit AVX-512 FMA vector pipelines."
            }
        ]

        # Determine primary culprit
        sorted_items = sorted(items, key=lambda x: x["impact_pct"], reverse=True)
        top = sorted_items[0]
        primary_culprit = f"Primary culprit: {top['name']} ({top['impact_pct']}% of stall cycles)."

        # Standard Intel Top-Down Microarchitecture (TMAM) Level-1 Classification:
        # Sum of the 4 buckets equals 100% of pipeline issue slots:
        # 1. Retiring: fraction of issue slots that executed useful retired instructions
        # 2. Bad Speculation: slots wasted due to branch misprediction recovery flushes
        # 3. Frontend Bound: slots starved because the fetch/decode stages could not deliver uops
        # 4. Backend Bound: slots stalled due to memory hierarchy (DRAM/L3) and execution port contention
        retiring_pct = round(max(15.0, min(75.0, (1.0 / cpi) * 100.0)), 1)
        overhead_slots = 100.0 - retiring_pct

        bad_spec_raw = overhead_slots * (branch_contrib / 100.0)
        frontend_raw = overhead_slots * 0.18
        backend_raw = overhead_slots * ((mem_contrib + struct_contrib + (pipe_contrib * 0.5)) / 100.0)

        # Normalize remaining slots to match exact 100%
        rem_sum = bad_spec_raw + frontend_raw + backend_raw
        if rem_sum <= 0:
            rem_sum = 1.0
        bad_spec_pct = round((bad_spec_raw / rem_sum) * overhead_slots, 1)
        frontend_pct = round((frontend_raw / rem_sum) * overhead_slots, 1)
        backend_pct = round(overhead_slots - bad_spec_pct - frontend_pct, 1)

        tma_levels = {
            "retiring": retiring_pct,
            "bad_speculation": bad_spec_pct,
            "frontend_bound": frontend_pct,
            "backend_bound": backend_pct,
            "total_loss": round(overhead_slots, 1)
        }

        distribution = {
            "Memory": round(mem_contrib, 1),
            "Pipeline": round(pipe_contrib, 1),
            "Branch": round(branch_contrib, 1),
            "Structural": round(struct_contrib, 1)
        }

        return {
            "bottleneck_score": score,
            "severity": severity,
            "risk_level": risk_level,
            "primary_culprit": primary_culprit,
            "summary_message": f"Hardware audit diagnosed {severity} severity microarchitectural contention. {primary_culprit}",
            "items": items,
            "distribution": distribution,
            "tma_levels": tma_levels,
            "formula_explanation": "Bottleneck Score = (CPI Overhead × 60%) + (LLC Miss Rate × 25%) + (Branch Mispredict Rate × 15%)",
            "subsystem_weights": {
                "cpi_overhead_weight": 0.60,
                "llc_miss_weight": 0.25,
                "branch_mispredict_weight": 0.15
            }
        }
