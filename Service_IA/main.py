# service_ia/main.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional
import os
import logging
import requests
import urllib3

# Désactiver les warnings SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configuration des logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Création de l'application
app = FastAPI(
    title="TrustSign - Service IA",
    description="Audit intelligent et Chatbot pour signature électronique",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Configuration Spring Boot
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")
SPRING_BOOT_API_KEY = os.getenv("SPRING_BOOT_API_KEY", "trustsign-secret-key-2024")
VERIFY_SSL = os.getenv("SPRING_BOOT_VERIFY_SSL", "false").lower() == "true"

HEADERS = {
    "X-API-Key": SPRING_BOOT_API_KEY,
    "Content-Type": "application/json"
}

# ⭐ IMPORT DES SERVICES
from services.detecteur_anomalies import DetecteurAnomalies

# ⭐ IMPORT DES ROUTEURS
from routeurs.audit_intelligent_routeur import routeur as audit_router
from routeurs.chatbot_routeur import router as chatbot_router
from routeurs.ia_avancee_routeur import routeur as ia_avancee_router  # ⭐ AJOUTER CETTE LIGNE

# ⭐ INCLUSION DES ROUTEURS
app.include_router(audit_router)
app.include_router(chatbot_router)
app.include_router(ia_avancee_router)  # ⭐ AJOUTER CETTE LIGNE

# Initialisation
detecteur_ia = DetecteurAnomalies()
modele_entraine = False

def get_logs_from_spring(start_date=None, end_date=None, limit=5000):
    """Récupère les logs depuis Spring Boot"""
    try:
        params = {"limit": limit}
        if start_date:
            params["startDate"] = start_date.isoformat() if hasattr(start_date, 'isoformat') else start_date
        if end_date:
            params["endDate"] = end_date.isoformat() if hasattr(end_date, 'isoformat') else end_date
        
        response = requests.get(
            f"{SPRING_BOOT_URL}/api/ia/logs/public",
            params=params,
            headers=HEADERS,
            timeout=30,
            verify=VERIFY_SSL
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("logs", [])
        else:
            logger.error(f"Erreur Spring Boot: {response.status_code}")
            return []
    except Exception as e:
        logger.error(f"Erreur connexion: {e}")
        return []

@app.on_event("startup")
async def initialiser_modele():
    """Entraîne le modèle IA au démarrage"""
    global modele_entraine, detecteur_ia
    logs = get_logs_from_spring(limit=1000)
    if len(logs) >= 50:
        modele_entraine = detecteur_ia.entrainer(logs)
        print(f"✅ Modèle IA entraîné sur {len(logs)} logs")
    else:
        print(f"⚠️ Pas assez de logs (besoin 50, reçu {len(logs)})")

@app.get("/")
async def root():
    return {
        "service": "TrustSign - Service IA",
        "status": "online",
        "version": "1.0.0",
        "endpoints": {
            "audit": "/api/ia/audit",
            "chatbot": "/api/chatbot",
            "ia_avancee": "/api/ia/avancee"
        }
    }

@app.get("/health")
async def health_check():
    spring_status = "unknown"
    try:
        response = requests.get(
            f"{SPRING_BOOT_URL}/api/ia/health",
            headers=HEADERS,
            timeout=5,
            verify=VERIFY_SSL
        )
        spring_status = "connected" if response.status_code == 200 else "error"
    except Exception as e:
        spring_status = "disconnected"
    
    return {
        "status": "healthy",
        "service": "TrustSign IA",
        "spring_boot": {"url": SPRING_BOOT_URL, "status": spring_status},
        "modele_ia": {"entraine": modele_entraine},
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Service IA démarré sur http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)