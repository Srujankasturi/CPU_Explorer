"""
Advanced RISC Pipeline Simulator Engine.
Features:
1. Classic In-Order 5-Stage RISC Model (IF, ID, EX, MEM, WB) with Hazard Detection & Bypass Forwarding.
2. Superscalar Out-of-Order (OoO) Tomasulo Engine (1-wide, 2-wide, 4-wide) with:
   - Dynamic Register Renaming via Register Alias Table (RAT)
   - In-Order Retirement Reorder Buffer (ROB)
   - Distributed Reservation Stations (ALU, Mult, LSQ, Branch)
   - Common Data Bus (CDB) broadcast and wake-up
3. Large Workload Scalability & Trace Virtualization (500+ instructions).
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
        is_mult = op in ("MULT", "MUL", "DIV", "REM")
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
            branch_taken = False

        inst_type = "ALU Compute"
        if is_load:
            inst_type = "Memory Load"
        elif is_store:
            inst_type = "Memory Store"
        elif is_branch:
            inst_type = "Branch Control"
        elif is_mult:
            inst_type = "Integer Mult"
        elif op in ("AND", "ANDI"):
            inst_type = "Logical AND"
        elif op in ("OR", "ORI"):
            inst_type = "Bitwise ALU"
        elif op in ("XOR", "XORI"):
            inst_type = "Bitwise XOR"
        elif op == "ADDI":
            inst_type = "Immediate ALU"

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
    def generate_synthetic_workload(cls, count: int) -> List[dict]:
        """Generates realistic large unrolled workloads (up to 500+ instructions)."""
        program = []
        for i in range(count):
            cycle_phase = i % 5
            reg_a = (i % 14) + 1
            reg_b = ((i + 1) % 14) + 1
            reg_c = ((i + 2) % 14) + 1

            if cycle_phase == 0:
                txt = f"LW R{reg_a}, {i * 4}(R0)"
            elif cycle_phase == 1:
                txt = f"ADD R{reg_b}, R{reg_a}, R{reg_c}"
            elif cycle_phase == 2:
                txt = f"MULT R{reg_c}, R{reg_b}, R{reg_a}"
            elif cycle_phase == 3:
                txt = f"ADDI R{reg_a}, R{reg_c}, 1"
            else:
                txt = f"SW R{reg_a}, {i * 4}(R0)"

            program.append(cls.parse_instruction(txt, i))
        return program

    @classmethod
    def simulate_in_order(cls, program: List[dict], forwarding: bool) -> dict:
        num_inst = len(program)
        if num_inst == 0:
            return cls._empty_response(forwarding)

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
                num_prev_stalls = len(prev_sched.get("stalls", []))
                earliest_if = prev_sched["IF"] + 1 + num_prev_stalls
                sched["IF"] = earliest_if
                sched["ID"] = sched["IF"] + 1

                stall_cycles_needed = 0
                hazard_reason = None
                hazard_type = "Data Hazard (RAW)"

                for prev_idx in range(max(0, i - 3), i):
                    prev_inst = program[prev_idx]
                    prev_s = inst_schedule[prev_idx]
                    prev_dest = prev_inst.get("dest")

                    if prev_dest and prev_dest in inst.get("srcs", []):
                        if forwarding:
                            if prev_inst.get("is_load", False):
                                current_ex_candidate = sched["ID"] + 1 + stall_cycles_needed
                                if current_ex_candidate <= prev_s["MEM"]:
                                    stalls_for_this = (prev_s["MEM"] - current_ex_candidate) + 1
                                    if stalls_for_this > stall_cycles_needed:
                                        stall_cycles_needed = stalls_for_this
                                        hazard_type = "Load-Use Hazard"
                                        hazard_reason = f"Load-Use hazard on register {prev_dest} from {prev_inst['id']} ({prev_inst['text']}). Requires 1-cycle stall bubble."
                        else:
                            current_ex_candidate = sched["ID"] + 1 + stall_cycles_needed
                            required_ex_start = prev_s["WB"] + 1
                            if current_ex_candidate < required_ex_start:
                                stalls_for_this = required_ex_start - current_ex_candidate
                                if stalls_for_this > stall_cycles_needed:
                                    stall_cycles_needed = stalls_for_this
                                    hazard_type = "Data Hazard (No Forwarding)"
                                    hazard_reason = f"RAW hazard without forwarding on register {prev_dest} from {prev_inst['id']}. Waiting for WB stage."

                for s in range(stall_cycles_needed):
                    stalls.append(sched["ID"] + 1 + s)

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

        max_cycle = max(s["WB"] for s in inst_schedule)
        ideal_cycles = num_inst + 4
        total_stalls = max(0, max_cycle - ideal_cycles)

        # Build grid
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

        return {
            "program_name": "Standard In-Order RISC Pipeline",
            "forwarding_enabled": forwarding,
            "execution_mode": "in_order",
            "issue_width": 1,
            "rob_size": 0,
            "num_instructions": num_inst,
            "total_cycles": max_cycle,
            "ideal_cycles": ideal_cycles,
            "stall_cycles": total_stalls,
            "cpi": round(cpi, 2),
            "ipc": round(ipc, 2),
            "efficiency_pct": round(efficiency, 1),
            "grid": grid,
            "instructions": [{"id": inst["id"], "text": inst["text"], "type": inst["type"]} for inst in program],
            "cycle_headers": [str(c) for c in range(1, max_cycle + 1)],
            "hazards_detected": hazards_detected,
            "speedup_vs_inorder": 1.0,
            "microarchitecture_notes": {
                "forwarding_enabled": forwarding,
                "stages": ["IF", "ID", "EX", "MEM", "WB"],
                "hazard_mechanisms": "EX/MEM and MEM/WB bypass paths active" if forwarding else "RAW stall until WB stage completes",
                "limitations": "Load-use hazard requires 1 stall bubble even with forwarding. In-order pipeline models a linear instruction stream with static not-taken branch prediction; branch misprediction penalties are evaluated dynamically in the Top-Down Bottleneck Analyzer."
            },
            "virtualization_meta": {
                "enabled": num_inst > 25,
                "is_virtualized": num_inst > 25,
                "total_instructions": num_inst,
                "total_cycles": max_cycle,
                "window_size": min(num_inst, 25)
            }
        }

    @classmethod
    def simulate_out_of_order(cls, program: List[dict], issue_width: int = 2, rob_size: int = 16) -> dict:
        """
        Tomasulo Algorithm with Reorder Buffer (ROB) & Register Renaming:
        - Issue width: 1, 2, or 4 superscalar
        - Dynamically renames registers to eliminate WAR / WAW false dependencies
        - Dispatches to Reservation Stations; executes out-of-order upon operand availability
        - In-order retirement (commit) via circular Reorder Buffer
        """
        num_inst = len(program)
        if num_inst == 0:
            return cls._empty_response(True)

        rat = {f"R{i}": "ARF" for i in range(32)}
        inst_stages = [{} for _ in range(num_inst)]

        rs_pools = {
            "ALU": [None] * 4,
            "MULT": [None] * 2,
            "LOAD": [None] * 4,
            "STORE": [None] * 2,
            "BRANCH": [None] * 2
        }

        latencies = {
            "Memory Load": 2,
            "Memory Store": 1,
            "ALU Compute": 1,
            "Bitwise ALU": 1,
            "Logical AND": 1,
            "Bitwise XOR": 1,
            "Immediate ALU": 1,
            "Integer Mult": 2,
            "Branch Control": 1
        }

        def get_rs_type(itype):
            if "Load" in itype: return "LOAD"
            if "Store" in itype: return "STORE"
            if "Mult" in itype: return "MULT"
            if "Branch" in itype: return "BRANCH"
            return "ALU"

        rob = []
        rob_id_counter = 1
        next_fetch_idx = 0
        next_decode_idx = 0

        cycle = 1
        committed_count = 0
        rob_snapshots = []
        hazards_detected = []
        waw_war_eliminated = 0

        # Run cycle loop
        while committed_count < num_inst and cycle <= 4000:
            # Snapshot ROB state for UI playback (first 25 cycles)
            if cycle <= 25:
                current_rob_view = [
                    {
                        "entry": f"ROB#{e['rob_id']}",
                        "inst": program[e['inst_idx']]['id'],
                        "dest": e['dest'] or "-",
                        "state": "Ready" if e['ready'] else ("Executing" if e.get('executing') else "Issued")
                    }
                    for e in rob
                ]
            else:
                current_rob_view = []

            # 1. COMMIT STAGE (In-Order retirement from ROB Head)
            commits_this_cycle = 0
            while rob and commits_this_cycle < issue_width:
                head = rob[0]
                if head["ready"]:
                    rob.pop(0)
                    idx = head["inst_idx"]
                    inst_stages[idx]["CM"] = cycle
                    committed_count += 1
                    commits_this_cycle += 1

                    dest = head["dest"]
                    if dest and rat.get(dest) == f"ROB#{head['rob_id']}":
                        rat[dest] = "ARF"
                else:
                    break

            # 2. WRITEBACK STAGE (Broadcast on Common Data Bus - CDB)
            cdb_broadcasts = []
            for rstype, pool in rs_pools.items():
                for slot_idx, slot in enumerate(pool):
                    if slot and slot.get("executing") and slot.get("exec_end_cycle") == cycle:
                        cdb_broadcasts.append(slot["rob_tag"])
                        slot_inst_idx = slot["inst_idx"]
                        inst_stages[slot_inst_idx]["WB"] = cycle

                        for rentry in rob:
                            if rentry["rob_id"] == slot["rob_id"]:
                                rentry["ready"] = True
                                rentry["executing"] = False
                                break
                        pool[slot_idx] = None

            # CDB Snooping & Operand Forwarding
            for tag in cdb_broadcasts:
                for rstype, pool in rs_pools.items():
                    for slot in pool:
                        if slot:
                            if slot["Qj"] == tag:
                                slot["Qj"] = None
                            if slot["Qk"] == tag:
                                slot["Qk"] = None

            # 3. EXECUTE STAGE (Dispatch ready RS entries to Functional Units)
            for rstype, pool in rs_pools.items():
                for slot in pool:
                    if slot and not slot.get("executing"):
                        idx = slot["inst_idx"]
                        if slot["Qj"] is None and slot["Qk"] is None and inst_stages[idx].get("ID", 0) < cycle:
                            slot["executing"] = True
                            latency = latencies.get(program[idx]["type"], 1)
                            slot["exec_start_cycle"] = cycle
                            slot["exec_end_cycle"] = cycle + latency

                            ex_cycles = list(range(cycle, cycle + latency))
                            inst_stages[idx]["EX"] = ex_cycles

                            for rentry in rob:
                                if rentry["rob_id"] == slot["rob_id"]:
                                    rentry["executing"] = True
                                    break

            # Mark IS (Waiting in Reservation Station)
            for rstype, pool in rs_pools.items():
                for slot in pool:
                    if slot and not slot.get("executing"):
                        idx = slot["inst_idx"]
                        if inst_stages[idx].get("ID", 0) < cycle:
                            if "IS" not in inst_stages[idx]:
                                inst_stages[idx]["IS"] = []
                            inst_stages[idx]["IS"].append(cycle)

            # 4. DECODE & RENAME / DISPATCH
            decodes_this_cycle = 0
            while next_decode_idx < next_fetch_idx and decodes_this_cycle < issue_width:
                idx = next_decode_idx
                if inst_stages[idx].get("IF", 0) >= cycle:
                    break

                rstype = get_rs_type(program[idx]["type"])
                pool = rs_pools[rstype]
                free_slot = next((i for i, s in enumerate(pool) if s is None), None)

                if free_slot is not None and len(rob) < rob_size:
                    rob_id = rob_id_counter
                    rob_id_counter += 1
                    rob_tag = f"ROB#{rob_id}"

                    rob_lookup = {e["rob_id"]: e for e in rob}
                    srcs = program[idx].get("srcs", [])
                    qj = None
                    qk = None
                    if len(srcs) > 0:
                        mapping = rat.get(srcs[0], "ARF")
                        if mapping != "ARF":
                            try:
                                target_id = int(mapping.replace("ROB#", ""))
                                target_entry = rob_lookup.get(target_id)
                                if target_entry and not target_entry.get("ready"):
                                    qj = mapping
                                    hazards_detected.append({
                                        "cycle": cycle,
                                        "instruction": program[idx]["id"],
                                        "type": "Tomasulo RAW Dependency",
                                        "penalty": 0,
                                        "description": f"Operand {srcs[0]} renamed to {qj}. Waiting for CDB broadcast."
                                    })
                            except Exception:
                                pass
                    if len(srcs) > 1:
                        mapping = rat.get(srcs[1], "ARF")
                        if mapping != "ARF":
                            try:
                                target_id = int(mapping.replace("ROB#", ""))
                                target_entry = rob_lookup.get(target_id)
                                if target_entry and not target_entry.get("ready"):
                                    qk = mapping
                            except Exception:
                                pass

                    dest = program[idx].get("dest")
                    if dest:
                        old_mapping = rat.get(dest, "ARF")
                        if old_mapping != "ARF":
                            waw_war_eliminated += 1
                        rat[dest] = rob_tag

                    rob.append({
                        "rob_id": rob_id,
                        "inst_idx": idx,
                        "dest": dest,
                        "ready": False,
                        "executing": False
                    })

                    pool[free_slot] = {
                        "rob_id": rob_id,
                        "rob_tag": rob_tag,
                        "inst_idx": idx,
                        "op": program[idx]["text"],
                        "Qj": qj,
                        "Qk": qk,
                        "executing": False
                    }

                    inst_stages[idx]["ID"] = cycle
                    next_decode_idx += 1
                    decodes_this_cycle += 1
                else:
                    if "STALL" not in inst_stages[idx]:
                        inst_stages[idx]["STALL"] = []
                    inst_stages[idx]["STALL"].append(cycle)
                    hazards_detected.append({
                        "cycle": cycle,
                        "instruction": program[idx]["id"],
                        "type": "Structural Stall (ROB/RS Full)",
                        "penalty": 1,
                        "description": "No free Reservation Station or Reorder Buffer entry. Pipeline dispatch stalled."
                    })
                    break

            # 5. FETCH STAGE
            fetches_this_cycle = 0
            while next_fetch_idx < num_inst and fetches_this_cycle < issue_width:
                idx = next_fetch_idx
                inst_stages[idx]["IF"] = cycle
                next_fetch_idx += 1
                fetches_this_cycle += 1

            if cycle <= 25:
                rob_snapshots.append({
                    "cycle": cycle,
                    "entries": current_rob_view,
                    "cdb": list(cdb_broadcasts)
                })

            cycle += 1

        max_cycle = cycle - 1

        # Build grid
        grid = []
        for i, inst in enumerate(program):
            st = inst_stages[i]
            row = []
            for c in range(1, max_cycle + 1):
                if c == st.get("IF"):
                    row.append("IF")
                elif c == st.get("ID"):
                    row.append("ID")
                elif c in st.get("STALL", []):
                    row.append("STALL")
                elif c in st.get("IS", []):
                    row.append("IS")
                elif c in st.get("EX", []):
                    row.append("EX")
                elif c == st.get("WB"):
                    row.append("WB")
                elif c == st.get("CM"):
                    row.append("CM")
                else:
                    row.append("")
            grid.append(row)

        cpi = max_cycle / num_inst
        ipc = num_inst / max_cycle
        ideal_cycles = (num_inst // issue_width) + 4
        stall_cycles = max(0, max_cycle - ideal_cycles)
        efficiency = (ideal_cycles / max_cycle) * 100.0 if max_cycle > 0 else 100.0

        # Calculate In-Order baseline for direct speedup comparison
        inorder_res = cls.simulate_in_order(program, forwarding=True)
        inorder_cycles = inorder_res["total_cycles"]
        speedup = round(inorder_cycles / max_cycle, 2) if max_cycle > 0 else 1.0

        # Snapshot active reservation stations
        active_rs = []
        for rstype, pool in rs_pools.items():
            for i, slot in enumerate(pool):
                active_rs.append({
                    "name": f"{rstype}{i+1}",
                    "busy": slot is not None,
                    "inst": program[slot['inst_idx']]['id'] if slot else "-",
                    "Qj": slot['Qj'] if slot else "-",
                    "Qk": slot['Qk'] if slot else "-",
                    "state": "Executing" if (slot and slot.get('executing')) else ("Ready" if slot else "Free")
                })

        return {
            "program_name": f"Superscalar {issue_width}-Wide Out-of-Order (Tomasulo)",
            "forwarding_enabled": True,
            "execution_mode": "out_of_order",
            "issue_width": issue_width,
            "rob_size": rob_size,
            "num_instructions": num_inst,
            "total_cycles": max_cycle,
            "ideal_cycles": ideal_cycles,
            "stall_cycles": stall_cycles,
            "cpi": round(cpi, 2),
            "ipc": round(ipc, 2),
            "efficiency_pct": round(efficiency, 1),
            "grid": grid,
            "instructions": [{"id": inst["id"], "text": inst["text"], "type": inst["type"]} for inst in program],
            "cycle_headers": [str(c) for c in range(1, max_cycle + 1)],
            "hazards_detected": hazards_detected[:20],
            "speedup_vs_inorder": speedup,
            "rob_snapshots": rob_snapshots,
            "reservation_stations": active_rs,
            "rat_table": {k: v for k, v in rat.items() if int(k.replace("R", "")) <= 15},
            "waw_war_eliminated": waw_war_eliminated,
            "virtualization_meta": {
                "enabled": num_inst > 25,
                "is_virtualized": num_inst > 25,
                "total_instructions": num_inst,
                "total_cycles": max_cycle,
                "window_size": min(num_inst, 25)
            }
        }

    @classmethod
    def simulate(cls,
                 instruction_count: int = 6,
                 forwarding: bool = True,
                 custom_instructions: Optional[List[str]] = None,
                 execution_mode: str = "in_order",
                 issue_width: int = 2,
                 rob_size: int = 16) -> dict:
        
        # Load workload
        if custom_instructions and len(custom_instructions) > 0:
            program = [cls.parse_instruction(txt, i) for i, txt in enumerate(custom_instructions[:instruction_count])]
        elif instruction_count > len(DEFAULT_PROGRAM):
            program = cls.generate_synthetic_workload(instruction_count)
        else:
            program = DEFAULT_PROGRAM[:instruction_count]

        if execution_mode == "out_of_order":
            return cls.simulate_out_of_order(program, issue_width=issue_width, rob_size=rob_size)
        else:
            return cls.simulate_in_order(program, forwarding=forwarding)

    @classmethod
    def _empty_response(cls, forwarding: bool) -> dict:
        return {
            "program_name": "Empty Workload",
            "forwarding_enabled": forwarding,
            "execution_mode": "in_order",
            "issue_width": 1,
            "rob_size": 16,
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
            "speedup_vs_inorder": 1.0,
            "microarchitecture_notes": {
                "forwarding_enabled": forwarding,
                "stages": ["IF", "ID", "EX", "MEM", "WB"],
                "hazard_mechanisms": "EX/MEM and MEM/WB bypass paths active" if forwarding else "RAW stall until WB stage completes",
                "limitations": "Load-use hazard requires 1 stall bubble even with forwarding. In-order pipeline models a linear instruction stream with static not-taken branch prediction; branch misprediction penalties are evaluated dynamically in the Top-Down Bottleneck Analyzer."
            },
            "virtualization_meta": {"is_virtualized": False, "total_instructions": 0, "total_cycles": 0, "window_size": 0}
        }
