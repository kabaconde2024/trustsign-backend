# service_ia/services/calculateur_risque.py
"""
Calculateur de score de risque pour les utilisateurs
"""
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict
import logging

from modeles.modeles_audit import ScoreRisqueUtilisateur, NiveauRisque

logger = logging.getLogger(__name__)


class CalculateurRisque:
    """Calcule le score de risque d'un utilisateur"""
    
    def __init__(self):
        self.poids = {
            'echecs_connexion': 0.35,
            'echecs_signature': 0.30,
            'anomalies_detectees': 0.35
        }
    
    def calculer_score_utilisateur(self, journaux: List[Dict], 
                                    anomalies: List[Dict] = None) -> Dict:
        """Calcule le score de risque pour un utilisateur"""
        if not journaux:
            return self._score_vide()
        
        email = journaux[0].get('emailUtilisateur', 'Inconnu')
        
        # Compter les événements
        total = len(journaux)
        
        # Compter les échecs
        echecs_connexion = sum(1 for j in journaux 
                               if j.get('typeEvenement') == 'CONNEXION' 
                               and j.get('statut') == 'FAILED')
        
        echecs_signature = sum(1 for j in journaux 
                               if j.get('typeEvenement') == 'SIGNATURE_DOCUMENT' 
                               and j.get('statut') == 'FAILED')
        
        # Nombre d'anomalies
        nb_anomalies = 0
        if anomalies:
            nb_anomalies = sum(1 for a in anomalies if a.get('email_utilisateur') == email)
        
        # Calcul des scores
        score_echecs_connexion = min(1.0, echecs_connexion / 5)
        score_echecs_signature = min(1.0, echecs_signature / 3)
        score_anomalies = min(1.0, nb_anomalies / 3)
        
        # Score global pondéré
        score_global = (
            score_echecs_connexion * self.poids['echecs_connexion'] +
            score_echecs_signature * self.poids['echecs_signature'] +
            score_anomalies * self.poids['anomalies_detectees']
        )
        
        # Détermination du niveau
        if score_global >= 0.7:
            niveau = NiveauRisque.CRITIQUE.value
        elif score_global >= 0.5:
            niveau = NiveauRisque.ELEVE.value
        elif score_global >= 0.25:
            niveau = NiveauRisque.MOYEN.value
        else:
            niveau = NiveauRisque.FAIBLE.value
        
        return {
            'email_utilisateur': email,
            'score_risque': round(score_global, 2),
            'niveau_risque': niveau,
            'facteurs': {
                'echecs_connexion': round(score_echecs_connexion, 2),
                'echecs_signature': round(score_echecs_signature, 2),
                'anomalies_detectees': round(score_anomalies, 2)
            },
            'total_evenements': total,
            'dernier_evenement': journaux[0].get('horodatage') if journaux else None,
            'recommandations': self._generer_recommandations(score_global, niveau)
        }
    
    def _score_vide(self) -> Dict:
        return {
            'email_utilisateur': None,
            'score_risque': 0.0,
            'niveau_risque': NiveauRisque.INCONNU.value,
            'facteurs': {},
            'total_evenements': 0,
            'recommandations': ['Aucune activité détectée pour cet utilisateur']
        }
    
    def _generer_recommandations(self, score: float, niveau: str) -> List[str]:
        """Génère des recommandations basées sur le score"""
        recommandations = []
        
        if score >= 0.7:
            recommandations.append("🚨 RISQUE CRITIQUE - Bloquer immédiatement l'utilisateur")
            recommandations.append("🔒 Réinitialiser le mot de passe et révoquer les sessions")
        elif score >= 0.5:
            recommandations.append("⚠️ RISQUE ÉLEVÉ - Forcer la réinitialisation du mot de passe")
            recommandations.append("📧 Envoyer une alerte de sécurité à l'utilisateur")
        elif score >= 0.25:
            recommandations.append("📊 RISQUE MOYEN - Surveillance renforcée recommandée")
        else:
            recommandations.append("✅ Comportement normal - Surveillance standard")
        
        return recommandations