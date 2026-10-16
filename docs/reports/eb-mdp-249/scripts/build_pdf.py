"""Render EB_Q2_Q3_2026_FINAL_REPORT.md to a styled HTML file and a PDF.

Usage: python3 scripts/build_pdf.py   (run from docs/reports/eb-mdp-249)
Requires: markdown, a headless Chrome/Chromium binary on PATH or at CHROME.
"""
import os
import shutil
import subprocess
import sys
import time

import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "EB_Q2_Q3_2026_FINAL_REPORT.md")
HTML = os.path.join(ROOT, "build", "EB_Q2_Q3_2026_FINAL_REPORT.html")
PDF = os.path.join(ROOT, "EB_Q2_Q3_2026_FINAL_REPORT.pdf")

CSS = """
@page { size: Letter; margin: 16mm 14mm 18mm 14mm; }
body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
       font-size: 10.5pt; line-height: 1.45; color: #1b1f24; }
h1 { font-size: 22pt; color: #0b1e3f; border-bottom: 3px solid #5556eb; padding-bottom: 6px; }
h2 { font-size: 15pt; color: #0b1e3f; border-bottom: 1px solid #d0d7de; padding-bottom: 3px;
     margin-top: 26px; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #2b3a67; page-break-after: avoid; }
h4 { font-size: 11pt; color: #2b3a67; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt;
        page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #eef0fb; color: #0b1e3f; text-align: left; }
th, td { border: 1px solid #d0d7de; padding: 4px 6px; vertical-align: top; }
tr:nth-child(even) td { background: #fafbfc; }
img { max-width: 100%; display: block; margin: 10px auto; page-break-inside: avoid; }
blockquote { border-left: 4px solid #5556eb; background: #f5f6ff; margin: 10px 0;
             padding: 6px 12px; color: #333; }
code { background: #f2f4f7; padding: 1px 4px; border-radius: 3px; font-size: 9pt;
       word-break: break-all; }
pre code { display: block; padding: 8px; white-space: pre-wrap; }
a { color: #3b3fd8; text-decoration: none; word-break: break-all; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 20px 0; }
"""


def find_chrome():
    for c in [os.environ.get("CHROME"), "google-chrome", "chromium", "chromium-browser"]:
        if c and shutil.which(c):
            return shutil.which(c)
    sys.exit("No headless Chrome found; set CHROME=/path/to/chrome")


def main():
    with open(SRC, encoding="utf-8") as f:
        body = markdown.markdown(
            f.read(), extensions=["tables", "fenced_code", "sane_lists", "toc", "attr_list"]
        )
    body = body.replace('src="charts/', f'src="file://{ROOT}/charts/')
    os.makedirs(os.path.dirname(HTML), exist_ok=True)
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(f"<!doctype html><html><head><meta charset='utf-8'>"
                f"<title>Executive Branch Final Report Q2 2026 - Q3 2026</title>"
                f"<style>{CSS}</style></head><body>{body}</body></html>")
    if os.path.exists(PDF):
        os.remove(PDF)
    # Some headless Chrome builds write the PDF but never exit, so stop once the file settles.
    proc = subprocess.Popen(
        [find_chrome(), "--headless=new", "--no-sandbox", "--disable-gpu",
         "--disable-dev-shm-usage", "--no-first-run", "--allow-file-access-from-files",
         "--no-pdf-header-footer", f"--print-to-pdf={PDF}", f"file://{HTML}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    last, stable = -1, 0
    for _ in range(240):
        if proc.poll() is not None:
            break
        size = os.path.getsize(PDF) if os.path.exists(PDF) else -1
        stable = stable + 1 if size > 0 and size == last else 0
        if stable >= 4:
            break
        last = size
        time.sleep(0.5)
    if proc.poll() is None:
        proc.kill()
        proc.wait()
    if not os.path.exists(PDF):
        sys.exit("Chrome did not produce a PDF")
    print(f"wrote {PDF}")


if __name__ == "__main__":
    main()
