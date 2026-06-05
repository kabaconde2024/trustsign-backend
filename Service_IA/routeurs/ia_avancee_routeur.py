# service_ia/routeurs/ia_avancee_routeur.py
"""
Routeur pour les fonctionnalités IA avancées
Détection d'attaques, recommandations, analyse prédictive
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging
from collections import defaultdict

from services.detecteur_attaques import DetecteurAttaques
from services.recommandation_ia import ServiceRecommandationIA
from services.detecteur_anomalies import DetecteurAnomalies
from services.calculateur_risque import CalculateurRisque
from services.generateur_resume import generer_resume_document

logger = logging.getLogger(__name__)

routeur = APIRouter(prefix="/api/ia/avancee", tags=["IA Avancée"])

# Initialisation des services existants
detecteur_attaques = DetecteurAttaques()
service_recommandations = ServiceRecommandationIA()
detecteur_anomalies = DetecteurAnomalies()
calculateur_risque = CalculateurRisque()

# Stockage temporaire
logs_cache = []
modele_entraine = False


def get_logs_from_spring(start_date=None, end_date=None, limit=5000):
    """Récupère les logs depuis Spring Boot"""
    import requests
    import os
    
    SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")
    SPRING_BOOT_API_KEY = os.getenv("SPRING_BOOT_API_KEY", "trustsign-secret-key-2024")
    VERIFY_SSL = os.getenv("SPRING_BOOT_VERIFY_SSL", "false").lower() == "true"
    
    headers = {"X-API-Key": SPRING_BOOT_API_KEY}
    
    try:
        params = {"limit": limit}
        if start_date:
            params["startDate"] = start_date.isoformat()
        if end_date:
            params["endDate"] = end_date.isoformat()
        
        response = requests.get(
            f"{SPRING_BOOT_URL}/api/ia/logs/public",
            params=params,
            headers=headers,
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


# ============================================
# ENDPOINTS
# ============================================

@routeur.get("/detection-complete")
async def detection_complete(
    jours: int = Query(7, description="Nombre de jours d'historique")
):
    """Endpoint complet de détection IA"""
    global modele_entraine
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {
            "success": False,
            "message": "Aucune donnée disponible",
            "timestamp": datetime.now().isoformat()
        }
    
    if not modele_entraine and len(logs) >= 50:
        modele_entraine = detecteur_anomalies.entrainer(logs)
        logger.info(f"Modèle IA entraîné: {modele_entraine}")
    
    anomalies = []
    if modele_entraine:
        anomalies = detecteur_anomalies.detecter(logs, seuil=0.6)
    
    attaques = detecteur_attaques.detecter_toutes_attaques(logs)
    pics_activite = detecteur_anomalies.detecter_pics_activite(logs) if modele_entraine else []
    
    scores_risque = []
    emails_uniques = set(log.get('emailUtilisateur') for log in logs if log.get('emailUtilisateur'))
    
    for email in emails_uniques:
        logs_user = [l for l in logs if l.get('emailUtilisateur') == email]
        score = calculateur_risque.calculer_score_utilisateur(logs_user, anomalies)
        scores_risque.append(score)
    
    # Compter les types d'événements
    types_evenements = defaultdict(int)
    for log in logs:
        event_type = log.get('typeEvenement', 'INCONNU')
        types_evenements[event_type] += 1
    
    total = len(logs)
    succes = sum(1 for l in logs if l.get('statut') == 'SUCCESS')
    
    statistiques = {
        'total_evenements': total,
        'taux_succes': round((succes / total) * 100, 2) if total > 0 else 0,
        'utilisateurs_actifs': len(emails_uniques),
        'nb_anomalies': len(anomalies),
        'nb_attaques': len(attaques),
        'types_evenements': dict(types_evenements)
    }
    
    recommandations = service_recommandations.generer_recommandations(
        anomalies, attaques, statistiques, logs
    )
    resume_attaques = detecteur_attaques.obtenir_resume_attaques(logs)
    
    return {
        "success": True,
        "periode": {
            "debut": start_date.isoformat(),
            "fin": end_date.isoformat(),
            "jours": jours
        },
        "statistiques": statistiques,
        "detections": {
            "anomalies": anomalies[:20],
            "total_anomalies": len(anomalies),
            "attaques": attaques,
            "total_attaques": len(attaques),
            "pics_activite": pics_activite
        },
        "scores_risque": scores_risque[:10],
        "recommandations": service_recommandations.formater_pour_frontend(recommandations),
        "resume_attaques": resume_attaques,  # ← CORRIGÉ
        "modele_ia": {
            "entraine": modele_entraine,
            "logs_analyses": len(logs)
        },
        "timestamp": datetime.now().isoformat()
    }

@routeur.get("/attaques/resume")
async def resume_attaques(jours: int = Query(7, description="Nombre de jours")):
    """Résumé des attaques détectées"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"success": False, "message": "Aucune donnée disponible"}
    
    resume = detecteur_attaques.obtenir_resume_attaques(logs)
    
    return {
        "success": True,
        "periode_jours": jours,
        **resume,
        "timestamp": datetime.now().isoformat()
    }


@routeur.get("/recommandations")
async def get_recommandations(jours: int = Query(7, description="Nombre de jours")):
    """Recommandations intelligentes uniquement"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"success": False, "message": "Aucune donnée disponible"}
    
    anomalies = []
    attaques = detecteur_attaques.detecter_toutes_attaques(logs)
    
    if len(logs) >= 50:
        detecteur_anomalies.entrainer(logs)
        anomalies = detecteur_anomalies.detecter(logs)
    
    total = len(logs)
    succes = sum(1 for l in logs if l.get('statut') == 'SUCCESS')
    
    statistiques = {
        'total_evenements': total,
        'taux_succes': round((succes / total) * 100, 2) if total > 0 else 0
    }
    
    recommandations = service_recommandations.generer_recommandations(
        anomalies, attaques, statistiques, logs
    )
    
    return service_recommandations.formater_pour_frontend(recommandations)


@routeur.get("/attaques/brute-force")
async def detecter_brute_force(jours: int = Query(7, description="Nombre de jours")):
    """Détection spécifique brute force"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=jours)
    
    logs = get_logs_from_spring(start_date, end_date, limit=5000)
    
    if not logs:
        return {"attaques": [], "total": 0}
    
    attaques = detecteur_attaques.detecter_brute_force(logs)
    
    return {
        "total": len(attaques),
        "attaques": attaques,
        "recommandation": "🔐 Activer CAPTCHA après 3 échecs" if attaques else None
    }


# ============================================
# ENDPOINT - RÉSUMÉ DE DOCUMENT
# ============================================

@routeur.post("/documents/resume")
async def generer_resume(
    contenu: str = Body(..., description="Contenu textuel du document"),
    nom_fichier: str = Body("", description="Nom du fichier")
):
    """
    Génère un résumé automatique du document par IA
    """
    try:
        resultat = generer_resume_document(contenu, nom_fichier)
        return {
            "success": True,
            "resume": resultat,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Erreur génération résumé: {e}")
        return {
            "success": False,
            "erreur": str(e),
            "timestamp": datetime.now().isoformat()
        }


# ============================================
# ENDPOINT - HEALTH
# ============================================

@routeur.get("/health")
async def health_check():
    """Vérification de l'état du service IA avancé"""
    return {
        "status": "healthy",
        "service": "IA Avancée",
        "modules": {
            "detecteur_attaques": "actif",
            "recommandations": "actif",
            "generateur_resume": "actif",
            "modele_ia": "actif" if modele_entraine else "en_attente"
        },
        "timestamp": datetime.now().isoformat()
    }