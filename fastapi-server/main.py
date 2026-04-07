import os
import cv2
import json
import httpx
import numpy as np
from datetime import datetime, timezone
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# ── In-memory alert store (last 200 alerts) ────────────────────────────────
alert_store: list = []

def push_alert(alert_type: str, message: str, extra: dict = {}):
    """Helper: create a typed alert and prepend to store."""
    entry = {
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "type": alert_type,
        "message": message,
        "time": datetime.now(timezone.utc).isoformat(),
        **extra,
    }
    alert_store.insert(0, entry)
    if len(alert_store) > 200:
        alert_store.pop()
    return entry

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_GATEWAY_URL = os.getenv("API_GATEWAY_URL")
NODE_SERVER_URL = os.getenv("NODE_SERVER_URL", "http://localhost:3002")

# ── Load Model ──────────────────────────────────────────────────────────────
print("Loading InsightFace model...")
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
# det_size=1280: must match ingestion setup (changes break embeddings)
# det_thresh=0.35: more permissive than default 0.5 — catches slightly angled/darker faces
face_app.prepare(ctx_id=0, det_size=(1280, 1280), det_thresh=0.35)
print("InsightFace ready.")

MAX_IMG_DIM = 3000  # Only resize truly pathological inputs (> 3000px)

# Similarity tiers — used by Lambda and the frontend
THRESHOLD_QUERY   = 0.15  # Sent to Lambda: marks above_threshold on each match
THRESHOLD_FOUND   = 0.25  # We call it a "match" if best score >= this
THRESHOLD_DISPLAY = 0.10  # Only hide results below this (pure noise)


# ══════════════════════════════════════════════════════════════════════════════
#  POST /search  — face detection + Pinecone query
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/search")
async def search_face(file: UploadFile = File(...), top_k: int = Form(8)):
    try:
        contents = await file.read()

        print("File name:", file.filename)
        print("Content type:", file.content_type)
        print("File size:", len(contents))

        if len(contents) == 0:
            push_alert("PROCESSING_ERROR", "Empty file received — no image data to process")
            raise HTTPException(status_code=400, detail="Empty file received")

        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)

        if img is None:
            from PIL import Image
            import io
            try:
                pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
                img = np.array(pil_img)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            except Exception:
                push_alert("PROCESSING_ERROR", "Invalid or corrupt image file — could not decode")
                raise HTTPException(status_code=400, detail="Invalid image file")

        # Handle RGBA / grayscale images before further processing
        if len(img.shape) == 2:                    # Grayscale
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif img.shape[2] == 4:                    # BGRA (PNG with alpha)
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        # Resize very large images to avoid memory issues
        h, w = img.shape[:2]
        if max(h, w) > MAX_IMG_DIM:
            scale = MAX_IMG_DIM / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
            print(f"Resized image from {w}x{h} to {int(w*scale)}x{int(h*scale)}")

        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = face_app.get(img)
        print("Faces detected:", len(faces))

        if not faces:
            push_alert("PROCESSING_ERROR", "No face detected in the uploaded image")
            return {"found": False, "matches": [], "message": "No face detected"}

        face = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        )

        if face.embedding is None:
            push_alert("PROCESSING_ERROR", "Face found but embedding could not be generated")
            raise HTTPException(status_code=500, detail="Embedding not generated")

        embedding = face.embedding.tolist()
        print(f"Embedding dims: {len(embedding)}")

        # Validate embedding dimensions — Lambda requires exactly 512
        if len(embedding) != 512:
            push_alert(
                "SYSTEM_ERROR",
                f"Unexpected embedding size: {len(embedding)} (expected 512). Model may be misconfigured."
            )
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dimension mismatch: got {len(embedding)}, Lambda expects 512"
            )

        if not API_GATEWAY_URL:
            push_alert("SYSTEM_ERROR", "API_GATEWAY_URL environment variable is not set")
            raise HTTPException(status_code=500, detail="API_GATEWAY_URL not set")

        # ── Call Lambda / Pinecone ────────────────────────────────────────────
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                lambda_res = await client.post(
                    API_GATEWAY_URL,
                    json={
                        "embedding": embedding,
                        "threshold": THRESHOLD_QUERY,   # 0.15 — let Lambda pass through more results
                        "top_k": top_k                  # dynamic from frontend Settings
                    },
                    headers={"Content-Type": "application/json"}
                )
            print("Lambda status:", lambda_res.status_code)
            print("Lambda body:", lambda_res.text[:400])
        except httpx.TimeoutException:
            push_alert("CLOUD_ERROR", f"Timeout connecting to cloud API (Lambda/Pinecone) — request exceeded 30s")
            raise HTTPException(status_code=504, detail="Cloud API timeout")
        except httpx.ConnectError as e:
            push_alert("CLOUD_ERROR", f"Cannot reach cloud API (Lambda/Pinecone): {str(e)[:120]}")
            raise HTTPException(status_code=502, detail="Cannot connect to cloud API")

        if lambda_res.status_code == 403:
            body_preview = lambda_res.text[:300]
            push_alert(
                "CLOUD_ERROR",
                f"API Gateway returned 403 Forbidden — check Lambda authorizer or CORS config. Body: {body_preview}"
            )
            raise HTTPException(
                status_code=403,
                detail=f"API Gateway 403: Access denied. Verify API Gateway settings. Response: {body_preview}"
            )

        if lambda_res.status_code != 200:
            body_preview = lambda_res.text[:300]
            push_alert(
                "CLOUD_ERROR",
                f"Cloud API returned HTTP {lambda_res.status_code} — Pinecone or Lambda error. Body: {body_preview}"
            )
            raise HTTPException(
                status_code=502,
                detail=f"API Gateway Error {lambda_res.status_code}: {body_preview}"
            )

        try:
            result = lambda_res.json()
        except Exception:
            push_alert("CLOUD_ERROR", "Cloud API returned invalid JSON — cannot parse Pinecone response")
            raise HTTPException(status_code=500, detail="Invalid response from Lambda")

        # ── Check matches ─────────────────────────────────────────────────────
        matches = result.get("matches", [])

        # Filter out pure noise (< THRESHOLD_DISPLAY) but keep everything else
        matches = [m for m in matches if m.get("similarity_percent", 0) >= THRESHOLD_DISPLAY * 100]

        # Determine "found" by raw score, not Lambda's above_threshold flag
        best_score = max((m.get("score", 0) for m in matches), default=0)
        is_found   = best_score >= THRESHOLD_FOUND
        result["found"]      = is_found
        result["best_score"] = round(best_score, 4)
        result["matches"]    = matches  # return ALL filtered matches, not just above-threshold

        if matches:
            top     = matches[0]
            top_pct = top.get("similarity_percent", 0)
            # Push alert for any meaningful similarity (>= 25%)
            if top_pct >= THRESHOLD_FOUND * 100:
                push_alert(
                    "PERSON_FOUND",
                    f"Person detected at {top.get('metadata', {}).get('location', 'unknown location')} "
                    f"({top_pct}% similarity)",
                    {"matches": matches}
                )
            else:
                push_alert(
                    "PROCESSING_ERROR",
                    f"Face detected but best match only {top_pct}% — below confidence threshold"
                )

            # Notify Node/FCM only for confident matches
            if is_found:
                async with httpx.AsyncClient() as client:
                    try:
                        await client.post(
                            f"{NODE_SERVER_URL}/notify",
                            json={
                                "matches": matches,
                                "message": f"Person matched with {top_pct}% similarity"
                            }
                        )
                    except Exception as e:
                        print(f"Failed to notify node server: {e}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        push_alert("SYSTEM_ERROR", f"Unhandled server error during face search: {str(e)[:200]}")
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  GET /alerts  — return stored alerts
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/alerts")
async def get_alerts():
    return {"alerts": alert_store, "count": len(alert_store)}


# ══════════════════════════════════════════════════════════════════════════════
#  DELETE /alerts  — clear alert store
# ══════════════════════════════════════════════════════════════════════════════
@app.delete("/alerts")
async def clear_alerts():
    alert_store.clear()
    return {"status": "cleared"}


# ══════════════════════════════════════════════════════════════════════════════
#  GET /cloud-health  — ping Lambda / Pinecone to check cloud connectivity
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/cloud-health")
async def cloud_health():
    if not API_GATEWAY_URL:
        return {"status": "error", "detail": "API_GATEWAY_URL not configured"}

    # ── Strategy: use a GET request to the base API Gateway URL (not the
    # /search route) to test reachability without triggering Lambda validation.
    # API Gateway always replies (even with 403/404) if it's online.
    # We strip the /search suffix and probe the base URL.
    base_url = API_GATEWAY_URL.rsplit("/search", 1)[0]  # e.g. .../prod

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(base_url)

        # API Gateway returns some HTTP response → it's reachable
        # 403 = up but this route needs auth (expected for GET on a POST-only API)
        # 404 = up but wrong path (still reachable)
        # 200 = up
        if res.status_code < 500:
            return {"status": "ok", "http_code": res.status_code}
        else:
            push_alert(
                "CLOUD_ERROR",
                f"Cloud health check: API Gateway returned HTTP {res.status_code}"
            )
            return {"status": "error", "detail": f"HTTP {res.status_code}", "http_code": res.status_code}

    except httpx.TimeoutException:
        push_alert("CLOUD_ERROR", "Cloud health check: API Gateway did not respond within 8s")
        return {"status": "error", "detail": "timeout"}
    except httpx.ConnectError as e:
        push_alert("CLOUD_ERROR", f"Cloud health check: Cannot connect to API Gateway — {str(e)[:100]}")
        return {"status": "error", "detail": f"connection error: {str(e)[:100]}"}
    except Exception as e:
        push_alert("CLOUD_ERROR", f"Cloud health check failed: {str(e)[:150]}")
        return {"status": "error", "detail": str(e)[:150]}


# ══════════════════════════════════════════════════════════════════════════════
#  GET /health  — basic liveness check
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}