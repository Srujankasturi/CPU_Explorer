import unittest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

class TestCPUExplorerAPI(unittest.TestCase):

    def test_health(self):
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")

    def test_device_specs(self):
        res = client.get("/api/device/specifications")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("physical_cores", data)
        self.assertIn("logical_cores", data)
        self.assertGreater(data["physical_cores"], 0)

    def test_device_live(self):
        res = client.get("/api/device/live")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("cpu_percent", data)
        self.assertIn("per_core_percent", data)
        self.assertIn("memory_percent", data)

    def test_analyzer_single(self):
        payload = {
            "instruction_count": 10000,
            "cycles": 24700,
            "frequency": 3.0,
            "unit": "1e9"
        }
        res = client.post("/api/analyzer/single", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["cpi"], 2.47)
        self.assertEqual(data["ipc"], 0.40)
        self.assertIn("execution_time_ms", data)
        self.assertIn("mips", data)

    def test_analyzer_instruction_set(self):
        payload = {
            "alu_count": 4200, "alu_cpi": 1.0,
            "mem_count": 2800, "mem_cpi": 4.0,
            "branch_count": 1200, "branch_cpi": 3.0,
            "other_count": 1800, "other_cpi": 2.0,
            "frequency": 3.0, "unit": "1e9"
        }
        res = client.post("/api/analyzer/instruction-set", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_instructions"], 10000)
        self.assertIn("weighted_cpi", data)
        self.assertIn("execution_time_ms", data)

    def test_pipeline_simulate(self):
        payload = {"instruction_count": 6, "forwarding_enabled": True}
        res = client.post("/api/pipeline/simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("grid", data)
        self.assertEqual(len(data["grid"]), 6)
        self.assertGreaterEqual(data["total_cycles"], 10)
        self.assertIn("cpi", data)

    def test_bottleneck_analyze(self):
        payload = {"cpi": 2.47, "llc_miss_rate": 28.4}
        res = client.post("/api/bottleneck/analyze", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("bottleneck_score", data)
        self.assertIn("items", data)

    def test_comparison_analyze(self):
        payload = {
            "cpu_a": {"name": "CPU A", "frequency_ghz": 3.0, "cpi": 2.0, "instruction_count": 10000},
            "cpu_b": {"name": "CPU B", "frequency_ghz": 4.0, "cpi": 1.5, "instruction_count": 10000}
        }
        res = client.post("/api/comparison/analyze", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["speedup_factor"], 1.0)

    def test_what_if_analyze(self):
        payload = {
            "frequency_ghz": 3.5,
            "base_cpi": 2.0,
            "cache_miss_rate": 8.0,
            "branch_mispredict_rate": 5.0,
            "stall_cycles": 1.0
        }
        res = client.post("/api/what-if/analyze", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("effective_cpi", data)
        self.assertIn("speedup_pct", data)

    def test_visualizations_data(self):
        res = client.get("/api/visualizations/data")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("heatmap", data)
        self.assertIn("sankey", data)
        self.assertIn("waterfall", data)

    def test_reports_crud(self):
        # 1. Generate
        payload = {
            "title": "Automated Test Report",
            "report_type": "Performance Analysis",
            "data": {"cpi": 2.1, "ipc": 0.48, "test": True}
        }
        res = client.post("/api/reports/generate", json=payload)
        self.assertEqual(res.status_code, 200)
        report = res.json()
        report_id = report["id"]

        # 2. List
        res = client.get("/api/reports")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any(r["id"] == report_id for r in res.json()))

        # 3. Get single
        res = client.get(f"/api/reports/{report_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["title"], "Automated Test Report")

        # 4. Export JSON
        res = client.get(f"/api/reports/{report_id}/export/json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/json", res.headers["content-type"])

        # 5. Export CSV
        res = client.get(f"/api/reports/{report_id}/export/csv")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/csv", res.headers["content-type"])

        # 6. Delete
        res = client.delete(f"/api/reports/{report_id}")
        self.assertEqual(res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
