import unittest
from backend.app.services.performance_analyzer import PerformanceAnalyzerService

class TestCOAEngine(unittest.TestCase):

    def test_single_hand_calculated_ground_truth(self):
        """
        Hand-calculated Case 1:
        IC = 10,000
        Cycles = 24,700
        f = 3.0 GHz (3.0 * 10^9 Hz)
        
        Expected:
        CPI = 24,700 / 10,000 = 2.47
        IPC = 10,000 / 24,700 = 0.40
        tau = 1 / (3.0 * 10^9) = 0.333 ns
        T_exec = (10,000 * 2.47) / (3.0 * 10^9) = 8.2333 microseconds = 0.008233 ms
        MIPS = 3000 / 2.47 = 1214.6
        """
        res = PerformanceAnalyzerService.calculate_single(
            instruction_count=10000,
            cycles=24700,
            frequency=3.0,
            unit="1e9"
        )
        self.assertEqual(res["cpi"], 2.47)
        self.assertEqual(res["ipc"], 0.40)
        self.assertAlmostEqual(res["cycle_time_ns"], 0.333, places=2)
        self.assertAlmostEqual(res["mips"], 1214.6, places=1)
        self.assertIn("stage_breakdown", res)
        self.assertEqual(res["stage_breakdown"]["EX"]["pct"], 38.0)

    def test_single_invalid_zero_and_negative(self):
        # Zero instruction count
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(0, 1000, 3.0)

        # Negative instruction count
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(-500, 1000, 3.0)

        # Zero cycles
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(1000, 0, 3.0)

        # Negative cycles
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(1000, -100, 3.0)

        # Zero frequency
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(1000, 2000, 0)

        # Negative frequency
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_single(1000, 2000, -2.5)

    def test_instruction_set_weighted_cpi_ground_truth(self):
        """
        Hand-calculated Case 2:
        ALU: 4,200 inst @ 1.0 CPI = 4,200 cycles
        MEM: 2,800 inst @ 4.0 CPI = 11,200 cycles
        BR:  1,200 inst @ 3.0 CPI = 3,600 cycles
        OTH: 1,800 inst @ 2.0 CPI = 3,600 cycles
        Total Instructions = 10,000
        Total Cycles = 22,600
        Weighted CPI = 22,600 / 10,000 = 2.26
        IPC = 10,000 / 22,600 = 0.44
        MIPS @ 3.0 GHz = 3000 / 2.26 = 1327.4
        """
        res = PerformanceAnalyzerService.calculate_instruction_set(
            alu_count=4200, alu_cpi=1.0,
            mem_count=2800, mem_cpi=4.0,
            branch_count=1200, branch_cpi=3.0,
            other_count=1800, other_cpi=2.0,
            frequency=3.0, unit="1e9"
        )
        self.assertEqual(res["total_instructions"], 10000)
        self.assertEqual(res["total_cycles"], 22600)
        self.assertEqual(res["weighted_cpi"], 2.26)
        self.assertEqual(res["ipc"], 0.44)
        self.assertAlmostEqual(res["mips"], 1327.4, places=1)
        self.assertEqual(res["category_percentages"]["ALU"], 42.0)
        self.assertEqual(res["category_percentages"]["Memory"], 28.0)
        self.assertEqual(res["category_percentages"]["Branch"], 12.0)
        self.assertEqual(res["category_percentages"]["Other"], 18.0)

    def test_instruction_set_invalid_inputs(self):
        # Negative instruction count
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_instruction_set(
                alu_count=-10, alu_cpi=1.0,
                mem_count=2000, mem_cpi=2.0,
                branch_count=1000, branch_cpi=2.0,
                other_count=500, other_cpi=1.5,
                frequency=3.0
            )

        # Zero total instructions
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_instruction_set(
                alu_count=0, alu_cpi=1.0,
                mem_count=0, mem_cpi=2.0,
                branch_count=0, branch_cpi=2.0,
                other_count=0, other_cpi=1.5,
                frequency=3.0
            )

        # Zero/negative CPI for active category
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_instruction_set(
                alu_count=1000, alu_cpi=0,
                mem_count=2000, mem_cpi=2.0,
                branch_count=1000, branch_cpi=2.0,
                other_count=500, other_cpi=1.5,
                frequency=3.0
            )

        # Non-positive frequency
        with self.assertRaises(ValueError):
            PerformanceAnalyzerService.calculate_instruction_set(
                alu_count=1000, alu_cpi=1.0,
                mem_count=2000, mem_cpi=2.0,
                branch_count=1000, branch_cpi=2.0,
                other_count=500, other_cpi=1.5,
                frequency=0
            )

    def test_pipeline_forwarding_comparison(self):
        from backend.app.services.pipeline_simulator import PipelineSimulatorService
        
        # Test exact same 6 instructions with forwarding ON vs OFF
        sim_fwd = PipelineSimulatorService.simulate(instruction_count=6, forwarding=True)
        sim_no_fwd = PipelineSimulatorService.simulate(instruction_count=6, forwarding=False)

        # Forwarding enabled should have fewer cycles and higher IPC
        self.assertLess(sim_fwd["total_cycles"], sim_no_fwd["total_cycles"])
        self.assertGreater(sim_fwd["ipc"], sim_no_fwd["ipc"])
        self.assertLess(sim_fwd["cpi"], sim_no_fwd["cpi"])
        self.assertGreater(sim_fwd["efficiency_pct"], sim_no_fwd["efficiency_pct"])

        # Check Load-Use hazard in forwarding enabled
        load_use_hazards = [h for h in sim_fwd["hazards_detected"] if "Load-Use" in h["type"]]
        self.assertGreater(len(load_use_hazards), 0)

        # Check documentation notes exist
        self.assertIn("microarchitecture_notes", sim_fwd)
        self.assertIn("limitations", sim_fwd["microarchitecture_notes"])

    def test_cpu_comparison_validation(self):
        from backend.app.services.comparison_engine import CPUComparisonService
        
        # Valid comparison
        res = CPUComparisonService.compare(
            {"name": "Base", "frequency_ghz": 2.5, "cpi": 3.2, "instruction_count": 10000},
            {"name": "Opt", "frequency_ghz": 3.0, "cpi": 2.47, "instruction_count": 10000}
        )
        self.assertIn("speedup_factor", res)
        self.assertGreater(res["speedup_factor"], 1.0)
        self.assertEqual(res["winner"], "Opt")

        # Invalid non-positive frequency
        with self.assertRaises(ValueError):
            CPUComparisonService.compare(
                {"frequency_ghz": 0, "cpi": 2.0, "instruction_count": 10000},
                {"frequency_ghz": 3.0, "cpi": 2.0, "instruction_count": 10000}
            )

        # Invalid non-positive CPI
        with self.assertRaises(ValueError):
            CPUComparisonService.compare(
                {"frequency_ghz": 2.5, "cpi": -1.0, "instruction_count": 10000},
                {"frequency_ghz": 3.0, "cpi": 2.0, "instruction_count": 10000}
            )

    def test_what_if_service_edge_cases(self):
        from backend.app.services.what_if_engine import WhatIfService
        
        # Nominal case
        res_nom = WhatIfService.calculate(
            frequency_ghz=3.0, base_cpi=2.47, cache_miss_rate=10.0,
            branch_mispredict_rate=8.0, stall_cycles=2.0
        )
        self.assertGreater(res_nom["effective_cpi"], 2.47)
        self.assertGreater(res_nom["execution_time_ms"], 0)

        # Extreme frequency (5.0 GHz) -> lower execution time
        res_fast = WhatIfService.calculate(frequency_ghz=5.0, base_cpi=2.47)
        self.assertLess(res_fast["execution_time_ms"], res_nom["execution_time_ms"])

    def test_bottleneck_analyzer_rubric(self):
        from backend.app.services.bottleneck_analyzer import BottleneckAnalyzerService

        # High memory bottleneck
        res_high_mem = BottleneckAnalyzerService.analyze(
            cpi=3.5, llc_miss_rate=45.0, branch_mispredict_rate=5.0, pipeline_stall_pct=15.0
        )
        self.assertIn(res_high_mem["severity"], ["High", "Critical"])
        self.assertEqual(res_high_mem["items"][0]["name"], "Memory Subsystem Bottleneck")

        # Low bottleneck (ideal execution)
        res_low = BottleneckAnalyzerService.analyze(
            cpi=1.1, llc_miss_rate=1.0, branch_mispredict_rate=1.0, pipeline_stall_pct=2.0
        )
        self.assertIn(res_low["severity"], ["Low", "Medium"])
        self.assertLess(res_low["bottleneck_score"], 40.0)

if __name__ == "__main__":
    unittest.main()
