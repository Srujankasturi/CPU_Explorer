import unittest
import urllib.request
import urllib.parse
import re

BASE_URL = "http://127.0.0.1:8000"

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
            encoded_page = urllib.parse.quote(page)
            url = f"{BASE_URL}/{encoded_page}"
            with self.subTest(page=page):
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    self.assertEqual(resp.status, 200)
                    html = resp.read().decode('utf-8', errors='ignore')
                    self.assertIn("<!DOCTYPE html>", html)

    def test_all_scripts_and_css_resolve(self):
        for page in PAGES:
            encoded_page = urllib.parse.quote(page)
            url = f"{BASE_URL}/{encoded_page}"
            with urllib.request.urlopen(url, timeout=5) as resp:
                html = resp.read().decode('utf-8', errors='ignore')

            # Find all local scripts: <script src="js/...">
            scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
            for src in scripts:
                if not src.startswith("http") and not src.startswith("//"):
                    asset_url = f"{BASE_URL}/{urllib.parse.quote(src.lstrip('/'))}"
                    with self.subTest(page=page, script=src):
                        with urllib.request.urlopen(asset_url, timeout=5) as s_resp:
                            self.assertEqual(s_resp.status, 200)

            # Find all local stylesheets: <link ... href="css/...">
            styles = re.findall(r'<link[^>]+href=["\']([^"\']+)["\']', html)
            for href in styles:
                if (href.endswith(".css") or "css/" in href) and not href.startswith("http") and not href.startswith("//"):
                    asset_url = f"{BASE_URL}/{urllib.parse.quote(href.lstrip('/'))}"
                    with self.subTest(page=page, style=href):
                        with urllib.request.urlopen(asset_url, timeout=5) as st_resp:
                            self.assertEqual(st_resp.status, 200)

    def test_no_current_device_link_in_navigation(self):
        for page in PAGES:
            encoded_page = urllib.parse.quote(page)
            url = f"{BASE_URL}/{encoded_page}"
            with urllib.request.urlopen(url, timeout=5) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
            with self.subTest(page=page):
                self.assertNotIn('href="CurrentDevice.html"', html)

if __name__ == "__main__":
    unittest.main()
