import unittest
import re
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

PAGES = [
    "Dahboard.html",
    "PerformanceAnalyzer.html",
    "PipelineSimulator.html",
    "BottleneckAnalyzer.html",
    "CPUComparison.html",
    "What-if Analysis.html",
    "AdvancedVisualizations.html",
    "Reports.html"
]

class TestPagesAndAssets(unittest.TestCase):

    def test_all_pages_http_200(self):
        for page in PAGES:
            with self.subTest(page=page):
                resp = client.get(f"/{page}")
                self.assertEqual(resp.status_code, 200)
                self.assertIn("<!DOCTYPE html>", resp.text)

    def test_all_scripts_and_css_resolve(self):
        for page in PAGES:
            resp = client.get(f"/{page}")
            html = resp.text

            # Find all local scripts: <script src="js/...">
            scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
            for src in scripts:
                if not src.startswith("http") and not src.startswith("//"):
                    asset_url = f"/{src.lstrip('/')}"
                    with self.subTest(page=page, script=src):
                        s_resp = client.get(asset_url)
                        self.assertEqual(s_resp.status_code, 200)

            # Find all local stylesheets: <link ... href="css/...">
            styles = re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', html)
            for href in styles:
                if (href.endswith(".css") or "css/" in href) and not href.startswith("http") and not href.startswith("//"):
                    asset_url = f"/{href.lstrip('/')}"
                    with self.subTest(page=page, style=href):
                        st_resp = client.get(asset_url)
                        self.assertEqual(st_resp.status_code, 200)

    def test_no_current_device_link_in_navigation(self):
        for page in PAGES:
            resp = client.get(f"/{page}")
            with self.subTest(page=page):
                self.assertNotIn('href="CurrentDevice.html"', resp.text)

if __name__ == "__main__":
    unittest.main()
