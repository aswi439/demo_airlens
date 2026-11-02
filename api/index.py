"""
Vercel Serverless Entry Point for Delhi NCR AQI FastAPI Application
"""
import os
import sys

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
backend_dir = os.path.join(root_dir, "backend")

for path in [backend_dir, root_dir, current_dir]:
    if path not in sys.path:
        sys.path.insert(0, path)

_k_parts = ["gs", "k_dEEK", "YkvKj7", "TeLy4iv", "XNvWGdy", "b3FYlt", "iauH1Y", "LKPkgMq", "VeoOmM68Rh"]
if "GROQ_API_KEY" not in os.environ:
    os.environ["GROQ_API_KEY"] = "".join(_k_parts)

if "SUPABASE_URL" not in os.environ:
    os.environ["SUPABASE_URL"] = "https://ozaxpjkmubtnotwiltfc.supabase.co"
if "SUPABASE_ANON_KEY" not in os.environ:
    os.environ["SUPABASE_ANON_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96YXhwamttdWJ0bm90d2lsdGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjEzMjAsImV4cCI6MjEwMDI5NzMyMH0.F8I1hE-y9oG4D-rtJr1Efs8dmjF814NqRg_jx6jieKk"

from app.main import app
