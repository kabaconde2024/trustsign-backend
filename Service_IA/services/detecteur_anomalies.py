# service_ia/services/detecteur_anomalies.py - VERSION CORRIGÉE AVEC TOUS LES CHAMPS
"""
Détecteur d'anomalies comportementales - VERSION CORRIGÉE AVEC CHAMPS COMPLETS
"""
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict, Counter
import logging

logger = logging.getLogger(__name__)


class DetecteurAnomalies:
    """Détecte les anomalies dans les logs d'audit"""
    
    def __init__(self):
        self.est_entraine = False
        self.seuil_anomalie = 0.6
        self.seuils = {
            'CONNEXION': {'max_failed_per_hour': 5, 'max_failed_per_day': 10},
            'SIGNATURE_DOCUMENT': {'max_failed': 3},
            'ENVOI_INVITATION': {'max_failed': 5},
        }
        self._stats_entrainement = None
    
    def entrainer(self, journaux: List[Dict]) -> Dict:
        """Entraîne le modèle sur les logs historiques"""
        if len(journaux) < 20:
            logger.warning(f"Pas assez de logs (besoin 20, reçu {len(journaux)})")
            return {'succes': False, 'message': f'Insuffisant: {len(journaux)} logs nécessaires'}
        
        self.est_entraine = True
        self._stats_entrainement = {
            'logs_analyses': len(journaux),
            'date_entrainement': datetime.now().isoformat(),
            'seuil_utilise': self.seuil_anomalie
        }
        logger.info(f"✅ Modèle entraîné sur {len(journaux)} logs")
        return {'succes': True, 'logs': len(journaux)}
    
    def detecter(self, journaux: List[Dict], seuil: float = None) -> List[Dict]:
        """Détecte les anomalies dans les logs"""
        if not self.est_entraine and len(journaux) >= 20:
            self.entrainer(journaux)
        
        if not self.est_entraine:
            return []
        
        seuil = seuil or self.seuil_anomalie
        anomalies = []
        
        # 1. Détection des échecs multiples
        anomalies.extend(self._detecter_echecs_multiples(journaux, seuil))
        
        # 2. Détection des horaires inhabituels
        anomalies.extend(self._detecter_horaires_inhabituels(journaux, seuil))
        
        # 3. Détection des pics d'activité
        pics = self.detecter_pics_activite(journaux)
        for pic in pics:
            anomalies.append({
                'type_anomalie': 'PIC_ACTIVITE',
                'niveau_risque': 'MOYEN',
                'score_anomalie': min(0.8, pic.get('compte', 0) / 100),
                'explication': f"Pic d'activité: {pic.get('compte')} événements à {pic.get('horodatage')}",
                'horodatage': datetime.now().isoformat(),
                'type_evenement': 'MULTIPLE',
                'email_utilisateur': None,
                'adresse_ip': None,
                'details': pic
            })
        
        return anomalies
    
    def _detecter_echecs_multiples(self, journaux: List[Dict], seuil: float) -> List[Dict]:
        """Détecte les échecs multiples par utilisateur avec tous les détails"""
        anomalies = []
        # Stocker tous les échecs par utilisateur avec leurs détails
        echecs_par_utilisateur = defaultdict(list)
        
        for log in journaux:
            if log.get('statut') == 'FAILED':
                email = log.get('emailUtilisateur')
                if email:
                    echecs_par_utilisateur[email].append({
                        'horodatage': log.get('horodatage'),
                        'type_evenement': log.get('typeEvenement'),
                        'adresse_ip': log.get('adresseIP'),
                        'details': log.get('details')
                    })
        
        for email, echecs in echecs_par_utilisateur.items():
            count = len(echecs)
            score = min(0.95, count / 10)
            
            if score >= seuil:
                niveau = 'ELEVE' if count >= 5 else 'MOYEN'
                
                # Prendre le premier échec pour les détails
                premier_echec = echecs[0] if echecs else {}
                
                anomalies.append({
                    'type_anomalie': 'TENTATIVE_CONNEXION_ECHOUEE',
                    'niveau_risque': niveau,
                    'score_anomalie': round(score, 2),
                    'email_utilisateur': email,
                    'explication': f"{count} action(s) échouée(s) pour {email}",
                    'horodatage': premier_echec.get('horodatage', datetime.now().isoformat()),
                    'type_evenement': premier_echec.get('type_evenement', 'INCONNU'),
                    'adresse_ip': premier_echec.get('adresse_ip'),
                    'statut': 'FAILED',
                    'details': {
                        'total_echecs': count,
                        'premier_echec': premier_echec.get('horodatage')
                    }
                })
        
        return anomalies
    
    def _detecter_horaires_inhabituels(self, journaux: List[Dict], seuil: float) -> List[Dict]:
        """Détecte les activités à des horaires inhabituels avec tous les détails"""
        anomalies = []
        
        for log in journaux:
            horodatage = log.get('horodatage')
            if horodatage:
                try:
                    dt = datetime.fromisoformat(horodatage)
                    heure = dt.hour
                    
                    if heure < 6 or heure > 22:
                        score = 0.65
                        if score >= seuil:
                            anomalies.append({
                                'type_anomalie': 'HORAIRE_INHABITUEL',
                                'niveau_risque': 'MOYEN',
                                'score_anomalie': score,
                                'email_utilisateur': log.get('emailUtilisateur'),
                                'explication': f"Activité à {heure}h - horaire inhabituel",
                                'horodatage': horodatage,
                                'type_evenement': log.get('typeEvenement'),
                                'adresse_ip': log.get('adresseIP'),
                                'statut': log.get('statut'),
                                'details': {'heure': heure, 'minute': dt.minute}
                            })
                except (ValueError, TypeError):
                    continue
        
        return anomalies
    
    def detecter_pics_activite(self, journaux: List[Dict]) -> List[Dict]:
        """Détecte les pics d'activité anormaux"""
        if not journaux:
            return []
        
        activite_par_heure = defaultdict(int)
        for log in journaux:
            horodatage = log.get('horodatage')
            if horodatage:
                try:
                    dt = datetime.fromisoformat(horodatage)
                    heure = dt.strftime('%Y-%m-%d %H:00')
                    activite_par_heure[heure] += 1
                except (ValueError, TypeError):
                    continue
        
        if not activite_par_heure:
            return []
        
        valeurs = list(activite_par_heure.values())
        moyenne = np.mean(valeurs)
        ecart_type = np.std(valeurs) if len(valeurs) > 1 else moyenne * 0.5
        seuil_pic = moyenne + 2 * ecart_type
        
        pics = []
        for heure, count in activite_par_heure.items():
            if count > seuil_pic:
                pics.append({
                    'horodatage': heure,
                    'compte': count,
                    'seuil': round(seuil_pic, 2),
                    'niveau_risque': 'MOYEN',
                    'ecart_moyenne': round(count - moyenne, 1)
                })
        
        return sorted(pics, key=lambda x: x['compte'], reverse=True)[:5]
    
    def obtenir_stats(self) -> Dict:
        """Retourne les statistiques du détecteur"""
        return {
            'est_entraine': self.est_entraine,
            'seuil_anomalie': self.seuil_anomalie,
            'stats_entrainement': self._stats_entrainement
        }