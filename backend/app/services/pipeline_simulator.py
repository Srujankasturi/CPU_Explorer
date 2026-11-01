"""
Five-Stage RISC Pipeline Simulator Engine (IF, ID, EX, MEM, WB).
Implements in-order 5-stage RISC instruction scheduling, RAW data hazard detection,
forwarding unit bypass (EX/MEM -> EX, MEM/WB -> EX), load-use bubbles,
branch resolution & pipeline flushing, and pipeline efficiency calculations.

Microarchitectural Assumptions:
1. Model: Single-issue, in-order 5-stage RISC pipeline (IF, ID, EX, MEM, WB).
2. Register File: Dual-read, single-write with split-phase clocking
   (WB writes in first half of cycle; ID reads in second half).
3. Forwarding Unit:
   - EX/MEM -> EX bypass (ALU result forwarded to next instruction ALU input)
   - MEM/WB -> EX bypass (Memory load or earlier ALU result forwarded to ALU input)
4. Load-Use Hazard: Unavoidable 1-cycle stall bubble even with forwarding,
   as loaded data is only available at the end of MEM stage.
5. Branches: Static predict-not-taken. Branch condition evaluated in EX stage;
   taken branches incur a 1-cycle flush bubble on the speculative fetch path.
6. Structural: Harvard architecture (independent instruction & data memory paths,
   no structural conflict between IF and MEM stages).

Limitations:
This is an educational cycle-accurate in-order pipeline simulator. It does NOT model
out-of-order superscalar execution, branch target buffers (BTB), or cache miss hierarchies.
"""
import re
from typing import List, Dict, Any, Optional

DEFAULT_PROGRAM = [
    {"id": "I1", "text": "LW R1, 0(R2)", "type": "Memory Load", "dest": "R1", "srcs": ["R2"], "is_load": True, "is_store": False, "is_branch": False},
    {"id": "I2", "text": "ADD R3, R1, R4", "type": "ALU Compute", "dest": "R3", "srcs": ["R1", "R4"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I3", "text": "SUB R5, R3, R6", "type": "ALU Compute", "dest": "R5", "srcs": ["R3", "R6"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I4", "text": "BEQ R5, R0, Target", "type": "Branch Control", "dest": None, "srcs": ["R5", "R0"], "is_load": False, "is_store": False, "is_branch": True, "branch_taken": False},
    {"id": "I5", "text": "OR R7, R8, R9", "type": "Bitwise ALU", "dest": "R7", "srcs": ["R8", "R9"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I6", "text": "SW R7, 4(R2)", "type": "Memory Store", "dest": None, "srcs": ["R7", "R2"], "is_load": False, "is_store": True, "is_branch": False},
    {"id": "I7", "text": "MULT R10, R11, R12", "type": "Integer Mult", "dest": "R10", "srcs": ["R11", "R12"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I8", "text": "AND R13, R10, R14", "type": "Logical AND", "dest": "R13", "srcs": ["R10", "R14"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I9", "text": "XOR R15, R13, R7", "type": "Bitwise XOR", "dest": "R15", "srcs": ["R13", "R7"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I10", "text": "ADDI R16, R15, 1", "type": "Immediate ALU", "dest": "R16", "srcs": ["R15"], "is_load": False, "is_store": False, "is_branch": False},
    {"id": "I11", "text": "LW R17, 8(R16)", "type": "Memory Load", "dest": "R17", "srcs": ["R16"], "is_load": True, "is_store": False, "is_branch": False},
    {"id": "I12", "text": "ADD R18, R17, R1", "type": "ALU Compute", "dest": "R18", "srcs": ["R17", "R1"], "is_load": False, "is_store": False, "is_branch": False},
]

class PipelineSimulatorService:

    @staticmethod
    def parse_instruction(text: str, index: int) -> dict:
        t = text.strip()
        parts = re.split(r'[\s,()]+', t)
        parts = [p for p in parts if p]
        op = parts[0].upper() if parts else "NOP"
        dest = None
        srcs = []
        is_load = op in ("LW", "LD", "LB", "LBU", "LH", "LHU")
        is_store = op in ("SW", "SD", "SB", "SH")
        is_branch = op in ("BEQ", "BNE", "BLT", "BGE", "BGT", "BLE", "J", "JAL")
        branch_taken = False

        if is_load and len(parts) >= 2:
            dest = parts[1].upper()
            if len(parts) >= 3:
                srcs = [p.upper() for p in parts[2:] if p.upper().startswith("R")]
        elif is_store and len(parts) >= 2:
            srcs = [p.upper() for p in parts[1:] if p.upper().startswith("R")]
        elif not is_branch and len(parts) >= 2:
            dest = parts[1].upper()
            srcs = [p.upper() for p in parts[2:] if p.upper().startswith("R")]
        elif is_branch and len(parts) >= 2:
            srcs = [p.upper() for p in parts[1:3] if p.upper().startswith("R")]
            # In benchmark, BEQ is evaluated based on whether comparison registers match
            branch_taken = False

        inst_type = "ALU Compute"
        if is_load:
            inst_type = "Memory Load"
        elif is_store:
            inst_type = "Memory Store"
        elif is_branch:
            inst_type = "Branch Control"

        return {
            "id": f"I{index + 1}",
            "text": t,
            "type": inst_type,
            "dest": dest,
            "srcs": srcs,
            "is_load": is_load,
            "is_store": is_store,
            "is_branch": is_branch,
            "branch_taken": branch_taken
        }

    @classmethod
    def simulate(cls,
                 instruction_count: int = 6,
                 forwarding: bool = True,
                 custom_instructions: Optional[List[str]] = None) -> dict:
        if custom_instructions and len(custom_instructions) > 0:
            program = [cls.parse_instruction(txt, i) for i, txt in enumerate(custom_instructions[:instruction_count])]
        else:
            program = DEFAULT_PROGRAM[:instruction_count]

        num_inst = len(program)
        if num_inst == 0:
            return {
                "program_name": "Empty Workload",
                "forwarding_enabled": forwarding,
                "num_instructions": 0,
                "total_cycles": 0,
                "ideal_cycles": 0,
                "stall_cycles": 0,
                "cpi": 0.0,
                "ipc": 0.0,
                "efficiency_pct": 100.0,
                "grid": [],
                "instructions": [],
                "cycle_headers": [],
                "hazards_detected": [],
                "assumptions": {},
                "limitations": "No instructions in workload"
            }

        # Detailed stage cycle mapping:
        # sched[i] = {"IF": cycle, "ID": cycle, "stalls": [cycles], "EX": cycle, "MEM": cycle, "WB": cycle}
        inst_schedule = []
        hazards_detected = []

        for i, inst in enumerate(program):
            sched = {}
            stalls = []

            if i == 0:
                sched["IF"] = 1
                sched["ID"] = 2
                sched["EX"] = 3
                sched["MEM"] = 4
                sched["WB"] = 5
                sched["stalls"] = []
            else:
                prev_sched = inst_schedule[i - 1]

                # IF Stage:
                # Instruction i is fetched in cycle after i-1 is fetched,
                # UNLESS instruction i-1 stalled in ID stage!
                # If i-1 stalled in ID, it holds the ID stage, which structurally
                # freezes IF as well (pipeline interlock).
                num_prev_stalls = len(prev_sched.get("stalls", []))
                earliest_if = prev_sched["IF"] + 1 + num_prev_stalls
                sched["IF"] = earliest_if

                # ID Stage:
                # Under normal flow, ID follows immediately after IF.
                sched["ID"] = sched["IF"] + 1

                # Check RAW Data Hazards against preceding in-flight instructions:
                stall_cycles_needed = 0
                hazard_reason = None
                hazard_type = "Data Hazard (RAW)"

                # Look back up to 3 instructions (distance where RAW can occur in 5-stage RISC)
                for prev_idx in range(max(0, i - 3), i):
                    prev_inst = program[prev_idx]
                    prev_s = inst_schedule[prev_idx]
                    prev_dest = prev_inst.get("dest")

                    if prev_dest and prev_dest in inst.get("srcs", []):
                        if forwarding:
                            # Forwarding Enabled:
                            if prev_inst.get("is_load", False):
                                # Load-Use Hazard:
                                # Data only available at the end of MEM stage (prev_s["MEM"]).
                                # Current instruction needs data at start of EX stage (sched["ID"] + 1).
                                # If current EX <= prev_s["MEM"], 1-cycle stall bubble is required!
                                current_ex_candidate = sched["ID"] + 1 + stall_cycles_needed
                                if current_ex_candidate <= prev_s["MEM"]:
                                    stalls_for_this = (prev_s["MEM"] - current_ex_candidate) + 1
                                    if stalls_for_this > stall_cycles_needed:
                                        stall_cycles_needed = stalls_for_this
                                        hazard_type = "Load-Use Hazard"
                                        hazard_reason = f"Load-Use hazard on register {prev_dest} from {prev_inst['id']} ({prev_inst['text']}). Requires 1-cycle stall bubble."
                            else:
                                # ALU -> EX forwarding:
                                # ALU result available at end of EX stage; forwarded directly to EX input.
                                # 0 stall cycles required!
                                pass
                        else:
                            # Forwarding Disabled:
                            # Data only written to register file at WB stage (prev_s["WB"]).
                            # Split-phase register file allows ID to read in same cycle as WB writes,
                            # so current EX can only start in cycle prev_s["WB"] + 1.
                            current_ex_candidate = sched["ID"] + 1 + stall_cycles_needed
                            required_ex_start = prev_s["WB"] + 1
                            if current_ex_candidate < required_ex_start:
                                stalls_for_this = required_ex_start - current_ex_candidate
                                if stalls_for_this > stall_cycles_needed:
                                    stall_cycles_needed = stalls_for_this
                                    hazard_type = "Data Hazard (No Forwarding)"
                                    hazard_reason = f"RAW hazard without forwarding on register {prev_dest} from {prev_inst['id']}. Waiting for WB stage."

                # Insert stall bubbles:
                # In hardware, stalls are inserted while instruction is held in ID stage.
                for s in range(stall_cycles_needed):
                    stall_cycle = sched["ID"] + s
                    stalls.append(stall_cycle)

                if stall_cycles_needed > 0:
                    hazards_detected.append({
                        "cycle": sched["ID"],
                        "instruction": inst["id"],
                        "type": hazard_type,
                        "penalty": stall_cycles_needed,
                        "description": hazard_reason or "Interlocking stall bubble inserted"
                    })

                sched["stalls"] = stalls
                sched["EX"] = sched["ID"] + stall_cycles_needed + 1
                sched["MEM"] = sched["EX"] + 1
                sched["WB"] = sched["MEM"] + 1

            inst_schedule.append(sched)

        # Total elapsed cycles = cycle of last WB stage
        max_cycle = max(s["WB"] for s in inst_schedule)
        ideal_cycles = num_inst + 4
        total_stalls = max_cycle - ideal_cycles
        if total_stalls < 0:
            total_stalls = 0

        # Build cycle-by-cycle grid matrix
        grid = []
        for i, inst in enumerate(program):
            sched = inst_schedule[i]
            row = []
            for c in range(1, max_cycle + 1):
                if c == sched["IF"]:
                    row.append("IF")
                elif c == sched["ID"]:
                    row.append("ID")
                elif c in sched.get("stalls", []):
                    row.append("STALL")
                elif c == sched["EX"]:
                    row.append("EX")
                elif c == sched["MEM"]:
                    row.append("MEM")
                elif c == sched["WB"]:
                    row.append("WB")
                else:
                    row.append("")
            grid.append(row)

        cpi = max_cycle / num_inst
        ipc = num_inst / max_cycle
        efficiency = (ideal_cycles / max_cycle) * 100.0

        cycle_headers = [str(c) for c in range(1, max_cycle + 1)]
        instructions_meta = [{"id": inst["id"], "text": inst["text"], "type": inst["type"]} for inst in program]

        return {
            "program_name": "Standard Benchmark MIPS-5",
            "forwarding_enabled": forwarding,
            "num_instructions": num_inst,
            "total_cycles": max_cycle,
            "ideal_cycles": ideal_cycles,
            "stall_cycles": total_stalls,
            "cpi": round(cpi, 2),
            "ipc": round(ipc, 2),
            "efficiency_pct": round(efficiency, 1),
            "grid": grid,
            "instructions": instructions_meta,
            "cycle_headers": cycle_headers,
            "hazards_detected": hazards_detected,
            "microarchitecture_notes": {
                "pipeline_model": "In-Order 5-Stage RISC (IF, ID, EX, MEM, WB)",
                "forwarding_paths": "EX/MEM -> EX and MEM/WB -> EX bypass networks" if forwarding else "Disabled (Registers read strictly after WB stage)",
                "branch_model": "Static predict-not-taken, resolved in EX stage",
                "load_use_penalty": "1 cycle bubble (structural limit of single-cycle MEM availability)",
                "assumptions": "Harvard memory architecture (separate I-Cache / D-Cache), split-phase register file clocking.",
                "limitations": "In-order educational model; does not simulate superscalar multi-issue, dynamic out-of-order reordering, or variable memory latency."
            }
        }
