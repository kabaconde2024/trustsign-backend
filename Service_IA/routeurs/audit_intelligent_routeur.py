# service_ia/routeurs/audit_intelligent_routeur.py
"""
Routeur pour l'audit intelligent
"""
from fastapi import APIRouter, Query, Depends
from typing import Optional, List
from datetime import datetime, timedelta
import logging
import requests
import os

from modeles.modeles_audit import (
    ReponseAnalyse, ResultatAnomalie, RequeteAnalyse,
    NiveauRisque, TypeAnomalie
)

logger = logging.getLogger(__name__)

routeur = APIRouter(prefix="/api/ia/audit", tags=["Audit Intelligent"])

# Configuration
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")
SPRING_BOOT_API_KEY = os.getenv("SPRING_BOOT_API_KEY", "trustsign-secret-key-2024")
VERIFY_SSL = os.getenv("SPRING_BOOT_VERIFY_SSL", "false").lower() == "true"

HEADERS = {"X-API-Key": SPRING_BOOT_API_KEY}


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
        return []
    except Exception as e:
        logger.error(f"Erreur connexion: {e}")
        return []


@routeur.get("/anomalies", response_model=ReponseAnalyse)
async def detecter_anomalies(
    jours: int = Query(7, description="Nombre de jours"),
    seuil: float = Query(0.6, description="Seuil de détection")
):
    """Détection d'anomalies par IA"""
    from services.detecteur_anomalies import DetecteurAnomalies
    from services.calculateur_risque import CalculateurRisque
    from services.detecteur_attaques import DetecteurAttaques
    from services.recommandation_ia import ServiceRecommandationIA
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return ReponseAnalyse(
            succes=False,
            message="Aucune donnée disponible",
            total_journaux=0,
            nombre_anomalies=0,
            niveau_risque_global=NiveauRisque.INCONNU.value
        )
    
    # Initialisation
    detecteur = DetecteurAnomalies()
    calculateur = CalculateurRisque()
    detecteur_attaques = DetecteurAttaques()
    recommandations_ia = ServiceRecommandationIA()
    
    # Détection
    anomalies = []
    if len(logs) >= 20:
        detecteur.entrainer(logs)
        anomalies = detecteur.detecter(logs, seuil=seuil)
    
    attaques = detecteur_attaques.detecter_toutes_attaques(logs)
    pics = detecteur.detecter_pics_activite(logs)
    
    # Statistiques
    total = len(logs)
    succes = sum(1 for l in logs if l.get('statut') == 'SUCCESS')
    taux_succes = round((succes / total) * 100, 2) if total > 0 else 0
    
    # Niveau de risque global
    if anomalies or attaques:
        niveau_global = NiveauRisque.ELEVE.value
    elif taux_succes < 70:
        niveau_global = NiveauRisque.MOYEN.value
    else:
        niveau_global = NiveauRisque.FAIBLE.value
    
    # Recommandations
    statistiques = {
        'total_evenements': total,
        'taux_succes': taux_succes,
        'utilisateurs_actifs': len(set(l.get('emailUtilisateur') for l in logs if l.get('emailUtilisateur')))
    }
    recommandations = recommandations_ia.generer_recommandations(anomalies, attaques, statistiques, logs)
    
    return ReponseAnalyse(
        succes=True,
        total_journaux=total,
        nombre_anomalies=len(anomalies),
        niveau_risque_global=niveau_global,
        anomalies=anomalies,
        pics_activite=pics,
        recommandations=[r.get('action', '') for r in recommandations],
        analyse_effectuee=datetime.now()
    )


@routeur.get("/statistiques")
async def get_statistiques(
    jours: int = Query(7, description="Nombre de jours")
):
    """Statistiques globales d'audit"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"success": False, "message": "Aucune donnée"}
    
    total = len(logs)
    succes = sum(1 for l in logs if l.get('statut') == 'SUCCESS')
    utilisateurs = set(l.get('emailUtilisateur') for l in logs if l.get('emailUtilisateur'))
    par_type = {}
    
    for log in logs:
        event_type = log.get('typeEvenement')
        if event_type:
            par_type[event_type] = par_type.get(event_type, 0) + 1
    
    return {
        "success": True,
        "total_evenements": total,
        "taux_succes": round((succes / total) * 100, 2) if total > 0 else 0,
        "utilisateurs_actifs": len(utilisateurs),
        "echecs": total - succes,
        "par_type": par_type,
        "periode_jours": jours
    }


@routeur.get("/scores-utilisateurs")
async def get_scores_utilisateurs(
    jours: int = Query(7, description="Nombre de jours")
):
    """Scores de risque par utilisateur"""
    from services.calculateur_risque import CalculateurRisque
    from services.detecteur_anomalies import DetecteurAnomalies
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"success": False, "message": "Aucune donnée"}
    
    # Détection des anomalies
    detecteur = DetecteurAnomalies()
    anomalies = []
    if len(logs) >= 20:
        detecteur.entrainer(logs)
        anomalies = detecteur.detecter(logs)
    
    # Calcul des scores
    calculateur = CalculateurRisque()
    scores = []
    emails = set(l.get('emailUtilisateur') for l in logs if l.get('emailUtilisateur'))
    
    for email in emails:
        logs_user = [l for l in logs if l.get('emailUtilisateur') == email]
        score = calculateur.calculer_score_utilisateur(logs_user, anomalies)
        scores.append(score)
    
    scores.sort(key=lambda x: x['score_risque'], reverse=True)
    
    return {
        "success": True,
        "scores": scores[:20],
        "total_utilisateurs": len(scores),
        "periode_jours": jours
    }


@routeur.get("/rapport")
async def generer_rapport(
    jours: int = Query(30, description="Nombre de jours")
):
    """Génère un rapport d'audit complet"""
    from services.generateur_rapport_audit import GenerateurRapportAudit
    from services.detecteur_anomalies import DetecteurAnomalies
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"success": False, "message": "Aucune donnée"}
    
    # Détection des anomalies
    detecteur = DetecteurAnomalies()
    anomalies = []
    if len(logs) >= 20:
        detecteur.entrainer(logs)
        anomalies = detecteur.detecter(logs)
    
    # Génération du rapport
    generateur = GenerateurRapportAudit()
    rapport = generateur.generer(logs, start_date, end_date, anomalies)
    
    return {"success": True, "rapport": rapport}


@routeur.get("/health")
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
    except:
        spring_status = "disconnected"
    
    return {
        "status": "healthy",
        "service": "Audit Intelligent",
        "spring_boot": spring_status
    }