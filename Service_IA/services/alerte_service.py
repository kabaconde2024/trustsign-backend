# service_ia/services/alerte_service.py
"""
Service d'alertes pour les anomalies détectées
"""
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


class ServiceAlerte:
    """Gère l'envoi d'alertes pour les anomalies"""
    
    def __init__(self):
        self.alertes_envoyees = deque(maxlen=100)
        self.canaux_actifs = ['console']
    
    def envoyer_alerte(self, anomalie: Dict, niveau: str = None) -> bool:
        """Envoie une alerte pour une anomalie"""
        niveau = niveau or anomalie.get('niveau_risque', 'MOYEN')
        
        message = self._construire_message(anomalie, niveau)
        
        # Envoyer via les canaux actifs
        for canal in self.canaux_actifs:
            if canal == 'console':
                self._envoyer_console(message)
        
        # Enregistrer l'alerte
        self.alertes_envoyees.append({
            'timestamp': datetime.now().isoformat(),
            'anomalie': anomalie,
            'message': message
        })
        
        return True
    
    def envoyer_alerte_massive(self, anomalies: List[Dict]) -> Dict:
        """Envoie un résumé d'alertes"""
        if not anomalies:
            return {'total': 0, 'envoyees': 0}
        
        rapport = {
            'total': len(anomalies),
            'par_niveau': defaultdict(int),
            'timestamp': datetime.now().isoformat()
        }
        
        for a in anomalies:
            niveau = a.get('niveau_risque', 'MOYEN')
            rapport['par_niveau'][niveau] += 1
        
        message = f"🚨 {rapport['total']} anomalies détectées: {dict(rapport['par_niveau'])}"
        self._envoyer_console({'titre': 'Alerte massive', 'message': message})
        
        return rapport
    
    def _construire_message(self, anomalie: Dict, niveau: str) -> Dict:
        """Construit le message d'alerte"""
        emoji = {'CRITIQUE': '🚨', 'ELEVE': '⚠️', 'MOYEN': '⚡', 'FAIBLE': 'ℹ️'}
        
        return {
            'titre': f"{emoji.get(niveau, '📢')} Alerte {niveau} - {anomalie.get('type_anomalie', 'INCONNU')}",
            'niveau': niveau,
            'horodatage': datetime.now().isoformat(),
            'contenu': {
                'utilisateur': anomalie.get('email_utilisateur'),
                'explication': anomalie.get('explication'),
                'score': anomalie.get('score_anomalie')
            },
            'action': self._recommander_action(niveau)
        }
    
    def _envoyer_console(self, message: Dict) -> None:
        """Affiche l'alerte dans la console"""
        print("\n" + "=" * 60)
        print(f"🔔 {message.get('titre', 'Alerte')}")
        print(f"   Message: {message.get('message', message.get('contenu', {}).get('explication', ''))}")
        print("=" * 60 + "\n")
    
    def _recommander_action(self, niveau: str) -> str:
        """Recommande une action basée sur le niveau"""
        actions = {
            'CRITIQUE': "🔴 Bloquer immédiatement l'utilisateur",
            'ELEVE': "🟠 Vérifier immédiatement l'activité suspecte",
            'MOYEN': "🟡 Surveiller attentivement",
            'FAIBLE': "🟢 Noter pour information"
        }
        return actions.get(niveau, "🟢 Surveillance normale")
    
    def obtenir_statistiques(self) -> Dict:
        """Retourne les statistiques des alertes"""
        if not self.alertes_envoyees:
            return {'total': 0, 'message': 'Aucune alerte envoyée'}
        
        return {
            'total': len(self.alertes_envoyees),
            'derniere_alerte': self.alertes_envoyees[-1]['timestamp']
        }