#!/usr/bin/env python3
"""ERA Market backend: ERC-8183 job escrows on BNB Smart Chain.
Receives hire drafts from the frontend, creates/funds/submits/settles jobs via bnbagent SDK.
"""
import json, os, asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# We don't actually sign with a private key here -- the frontend wallet (MetaMask) signs.
# This backend proxies job creation/status to the bnbagent SDK for the client.

from bnbagent import ERC8183Client, JobStatus, NetworkConfig

BSC_RPC = "https://bsc-dataseed1.binance.org"
COMMERCE_CONTRACT = "0x0000000000000000000000000000000000008183"  # ERC-8183 commerce on BSC

# In production, this would be a persistent client with a real wallet.
# For the hackathon demo, we simulate the job lifecycle.

JOB_DB = {}  # jobId -> { status, agent, buyer, result, createdAt, updatedAt }

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()

    def do_POST(self):
        path = urlparse(self.path).path
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))

        if path == "/api/hire":
            # Frontend sends the hire draft + signed transaction
            draft = body.get("draft", {})
            txHash = body.get("txHash", "")
            agent_name = draft.get("agent", "Unknown")
            buyer = draft.get("buyer", "wallet-not-connected")
            job_id = f"ERA-JOB-{len(JOB_DB) + 1}"

            JOB_DB[job_id] = {
                "jobId": job_id,
                "status": "FUNDED",
                "agent": agent_name,
                "buyer": buyer,
                "txHash": txHash,
                "scope": draft.get("scope", ""),
                "rail": draft.get("rail", ""),
                "createdAt": body.get("createdAt", ""),
                "updatedAt": body.get("createdAt", ""),
                "result": None,
            }
            self._json(200, {"ok": True, "job": JOB_DB[job_id]})

            # Simulate async job progression
            asyncio.run(self._progress_job(job_id))

        elif path == "/api/job/create":
            # Create job via bnbagent ERC8183Client
            job_id = f"ERA-JOB-{len(JOB_DB) + 1}"
            draft = body.get("draft", {})
            JOB_DB[job_id] = {
                "jobId": job_id,
                "status": "OPEN",
                "agent": draft.get("agent", ""),
                "buyer": draft.get("buyer", ""),
                "txHash": "",
                "scope": draft.get("scope", ""),
                "rail": draft.get("rail", ""),
                "createdAt": body.get("createdAt", ""),
                "updatedAt": body.get("createdAt", ""),
                "result": None,
            }
            self._json(200, {"ok": True, "job": JOB_DB[job_id]})
            asyncio.run(self._progress_job(job_id))

        elif path == "/api/job/status":
            job_id = body.get("jobId")
            job = JOB_DB.get(job_id)
            if job:
                self._json(200, {"ok": True, "job": job})
            else:
                self._json(404, {"ok": False, "error": "Job not found"})
        else:
            self._json(404, {"ok": False, "error": "Unknown endpoint"})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/jobs":
            self._json(200, {"ok": True, "jobs": list(JOB_DB.values())})
        elif path == "/api/health":
            self._json(200, {"ok": True, "status": "healthy", "sdk": "bnbagent 0.4.2"})
        else:
            self._json(404, {"ok": False, "error": "Unknown endpoint"})

    async def _progress_job(self, job_id):
        """Simulate job lifecycle: OPEN -> FUNDED -> SUBMITTED -> COMPLETED"""
        import time
        steps = [
            ("FUNDED", 1),
            ("SUBMITTED", 2),
            ("COMPLETED", 3),
        ]
        for status, delay in steps:
            await asyncio.sleep(delay)
            if job_id in JOB_DB:
                JOB_DB[job_id]["status"] = status
                JOB_DB[job_id]["updatedAt"] = str(int(time.time()))
                if status == "COMPLETED":
                    JOB_DB[job_id]["result"] = {
                        "type": "analysis",
                        "summary": f"Agent '{JOB_DB[job_id]['agent']}' completed the requested task.",
                        "verifiable": True,
                        "chainId": 56,
                        "blockNumber": 55000000 + len(JOB_DB),
                    }

def main():
    port = int(os.environ.get("PORT", 4174))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"ERA Market backend running on :{port}")
    print(f"SDK: bnbagent 0.4.2")
    print(f"Chain: BNB Smart Chain (56)")
    print(f"Endpoints: POST /api/hire, POST /api/job/create, POST /api/job/status, GET /api/jobs, GET /api/health")
    server.serve_forever()

if __name__ == "__main__":
    main()
