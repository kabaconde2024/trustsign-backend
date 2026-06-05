# service_ia/services/recommandation_ia.py
"""
Génération de recommandations intelligentes basées sur l'IA
"""
from typing import List, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ServiceRecommandationIA:
    """Génère des recommandations intelligentes"""
    
    def __init__(self):
        self.historique_recommandations = []
    
    def generer_recommandations(self, anomalies: List[Dict], attaques: List[Dict],
                                  statistiques: Dict, logs: List[Dict]) -> List[Dict]:
        """Génère des recommandations basées sur l'analyse"""
        recommandations = []
        
        # 1. Recommandations basées sur les attaques
        if attaques:
            recommandations.append({
                'type': 'SECURITE',
                'titre': '🚨 Attaques détectées',
                'description': f"{len(attaques)} attaque(s) identifiée(s)",
                'action': 'Vérifier les logs de sécurité et bloquer les IPs suspectes',
                'priorite': 'CRITIQUE'
            })
        
        # 2. Recommandations basées sur les anomalies critiques
        anomalies_critiques = [a for a in anomalies if a.get('niveau_risque') == 'CRITIQUE']
        if anomalies_critiques:
            recommandations.append({
                'type': 'SECURITE',
                'titre': '⚠️ Anomalies critiques détectées',
                'description': f"{len(anomalies_critiques)} anomalies critiques",
                'action': 'Investigation immédiate requise',
                'priorite': 'CRITIQUE'
            })
        
        # 3. Recommandations basées sur le taux de succès
        taux_succes = statistiques.get('taux_succes', 100)
        if taux_succes < 70:
            recommandations.append({
                'type': 'QUALITE',
                'titre': '📉 Taux de succès faible',
                'description': f"Taux de succès: {taux_succes}%",
                'action': 'Analyser les causes des échecs',
                'priorite': 'ELEVE'
            })
        elif taux_succes < 85:
            recommandations.append({
                'type': 'QUALITE',
                'titre': '⚠️ Taux d\'erreur modéré',
                'description': f"Taux de succès: {taux_succes}%",
                'action': 'Surveiller les tendances d\'échec',
                'priorite': 'MOYEN'
            })
        
        # 4. Recommandations générales
        if not anomalies and not attaques and taux_succes >= 85:
            recommandations.append({
                'type': 'INFO',
                'titre': '✅ Système stable',
                'description': 'Aucune anomalie majeure détectée',
                'action': 'Continuer la surveillance standard',
                'priorite': 'INFO'
            })
        
        # 5. Recommandations préventives
        if statistiques.get('total_evenements', 0) > 500:
            recommandations.append({
                'type': 'PERFORMANCE',
                'titre': '📊 Volume d\'activité élevé',
                'description': f"{statistiques['total_evenements']} événements analysés",
                'action': 'Optimiser les performances et surveiller la charge',
                'priorite': 'INFO'
            })
        
        return recommandations
    
    def formater_pour_frontend(self, recommandations: List[Dict]) -> Dict:
        """Formatte les recommandations pour l'affichage frontend"""
        return {
            'total': len(recommandations),
            'recommandations': recommandations,
            'generate_le': datetime.now().isoformat(),
            'resume': self._generer_resume(recommandations)
        }
    
    def _generer_resume(self, recommandations: List[Dict]) -> str:
        """Génère un résumé des recommandations"""
        if not recommandations:
            return "Aucune recommandation pour le moment."
        
        priorites = {}
        for r in recommandations:
            p = r.get('priorite', 'INFO')
            priorites[p] = priorites.get(p, 0) + 1
        
        resume = f"{len(recommandations)} recommandation(s): "
        if priorites.get('CRITIQUE'):
            resume += f"{priorites['CRITIQUE']} critique(s), "
        if priorites.get('ELEVE'):
            resume += f"{priorites['ELEVE']} élevée(s), "
        
        return resume.rstrip(', ')