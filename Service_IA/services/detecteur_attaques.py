# service_ia/services/detecteur_attaques.py
"""
Détection d'attaques - VERSION AMÉLIORÉE
"""
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class DetecteurAttaques:
    """Détecte différents types d'attaques"""
    
    def __init__(self):
        self.seuils = {
            'BRUTE_FORCE': {'tentatives': 5, 'fenetre_minutes': 5},
            'DDoS_FLOOD': {'requetes': 30, 'fenetre_secondes': 10},
            'SESSION_HIJACKING': {'ip_differentes': 3, 'fenetre_minutes': 10}
        }
        self._cache_detections = {}  # Éviter les doublons
    
    def detecter_toutes_attaques(self, logs: List[Dict]) -> List[Dict]:
        """Détecte tous les types d'attaques sans doublon"""
        attaques = []
        
        attaques.extend(self.detecter_brute_force(logs))
        attaques.extend(self.detecter_ddos_flood(logs))
        attaques.extend(self.detecter_session_hijacking(logs))
        
        # Déduplication par (type, cible)
        vues = set()
        uniques = []
        for a in attaques:
            key = (a.get('type'), a.get('cible'))
            if key not in vues:
                vues.add(key)
                uniques.append(a)
        
        return uniques
    
    def detecter_brute_force(self, logs: List[Dict]) -> List[Dict]:
        """Détecte les attaques par brute force avec fenêtre temporelle"""
        attaques = []
        
        # Grouper par IP et timestamp
        tentatives_par_ip = defaultdict(list)
        
        for log in logs:
            if log.get('typeEvenement') == 'CONNEXION' and log.get('statut') == 'FAILED':
                ip = log.get('adresseIP')
                horodatage = log.get('horodatage')
                if ip and horodatage:
                    try:
                        dt = datetime.fromisoformat(horodatage)
                        tentatives_par_ip[ip].append(dt)
                    except:
                        continue
        
        fenetre = timedelta(minutes=self.seuils['BRUTE_FORCE']['fenetre_minutes'])
        
        for ip, timestamps in tentatives_par_ip.items():
            if len(timestamps) < self.seuils['BRUTE_FORCE']['tentatives']:
                continue
            
            timestamps.sort()
            
            # Détection par fenêtre glissante
            for i in range(len(timestamps)):
                debut = timestamps[i]
                fin = debut + fenetre
                tentatives = sum(1 for t in timestamps if debut <= t <= fin)
                
                if tentatives >= self.seuils['BRUTE_FORCE']['tentatives']:
                    niveau = "CRITIQUE" if tentatives >= 10 else "ELEVE"
                    attaques.append({
                        'type': 'BRUTE_FORCE',
                        'type_cible': 'IP',
                        'cible': ip,
                        'tentatives': tentatives,
                        'niveau_risque': niveau,
                        'description': f"{tentatives} tentatives en {self.seuils['BRUTE_FORCE']['fenetre_minutes']} minutes",
                        'action_recommandee': "Bloquer l'IP immédiatement",
                        'fenetre_minutes': self.seuils['BRUTE_FORCE']['fenetre_minutes']
                    })
                    break
        
        return attaques
    
    def detecter_ddos_flood(self, logs: List[Dict]) -> List[Dict]:
        """Détecte les attaques DDoS / Flood"""
        attaques = []
        fenetre = timedelta(seconds=self.seuils['DDoS_FLOOD']['fenetre_secondes'])
        
        # Compter les requêtes par IP
        requetes_par_ip = defaultdict(list)
        for log in logs:
            ip = log.get('adresseIP')
            horodatage = log.get('horodatage')
            if ip and horodatage:
                try:
                    dt = datetime.fromisoformat(horodatage)
                    requetes_par_ip[ip].append(dt)
                except:
                    continue
        
        for ip, timestamps in requetes_par_ip.items():
            if len(timestamps) < self.seuils['DDoS_FLOOD']['requetes']:
                continue
            
            timestamps.sort()
            
            for i in range(len(timestamps)):
                debut = timestamps[i]
                fin = debut + fenetre
                compte = sum(1 for t in timestamps if debut <= t <= fin)
                
                if compte >= self.seuils['DDoS_FLOOD']['requetes']:
                    attaques.append({
                        'type': 'DDoS_FLOOD',
                        'type_cible': 'IP',
                        'cible': ip,
                        'requetes': compte,
                        'niveau_risque': 'CRITIQUE',
                        'description': f"{compte} requêtes en {self.seuils['DDoS_FLOOD']['fenetre_secondes']} secondes",
                        'action_recommandee': "Bloquer l'IP immédiatement et activer rate limiting"
                    })
                    break
        
        return attaques
    
    def detecter_session_hijacking(self, logs: List[Dict]) -> List[Dict]:
        """Détecte les tentatives de vol de session"""
        attaques = []
        utilisateurs_ips = defaultdict(set)
        
        for log in logs:
            email = log.get('emailUtilisateur')
            ip = log.get('adresseIP')
            if email and ip and ip != 'unknown':
                utilisateurs_ips[email].add(ip)
        
        for email, ips in utilisateurs_ips.items():
            if len(ips) >= self.seuils['SESSION_HIJACKING']['ip_differentes']:
                attaques.append({
                    'type': 'SESSION_HIJACKING',
                    'type_cible': 'USER',
                    'cible': email,
                    'ips_detectees': list(ips),
                    'niveau_risque': 'ELEVE',
                    'description': f"Connexions depuis {len(ips)} IP différentes",
                    'action_recommandee': "Invalider toutes les sessions et forcer reconnexion"
                })
        
        return attaques
    
    def obtenir_resume_attaques(self, logs: List[Dict]) -> Dict:
        """Génère un résumé des attaques avec plus de détails"""
        attaques = self.detecter_toutes_attaques(logs)
        
        if not attaques:
            return {
                'total_attaques': 0,
                'niveau_risque_global': 'FAIBLE',
                'par_type': {},
                'recommandations': []
            }
        
        par_type = defaultdict(int)
        par_niveau = defaultdict(int)
        for a in attaques:
            par_type[a.get('type', 'INCONNU')] += 1
            par_niveau[a.get('niveau_risque', 'MOYEN')] += 1
        
        # Déterminer niveau global
        if par_niveau.get('CRITIQUE', 0) > 0:
            niveau_global = 'CRITIQUE'
        elif par_niveau.get('ELEVE', 0) > 0:
            niveau_global = 'ELEVE'
        elif par_niveau.get('MOYEN', 0) > 0:
            niveau_global = 'MOYEN'
        else:
            niveau_global = 'FAIBLE'
        
        return {
            'total_attaques': len(attaques),
            'niveau_risque_global': niveau_global,
            'par_type': dict(par_type),
            'par_niveau': dict(par_niveau),
            'attaques': attaques,
            'recommandations': [
                "🔐 Activer CAPTCHA après 3 échecs",
                "🛡️ Mettre en place un rate limiting",
                "🔑 Forcer la reconnexion sur changement d'IP",
                "📧 Activer notifications pour activités suspectes"
            ]
        }