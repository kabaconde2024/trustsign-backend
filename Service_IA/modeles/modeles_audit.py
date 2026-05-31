# service_ia/modeles/modeles_audit.py
"""
Modèles Pydantic pour l'audit intelligent - VERSION CORRIGÉE AVEC TOUS LES MODÈLES
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import uuid
import re

# ============================================
# ÉNUMÉRATIONS (CORRIGÉES - SANS DOUBLONS)
# ============================================

class TypeEvenement(str, Enum):
    """Types d'événements possibles dans les logs d'audit"""
    SIGNATURE_DOCUMENT = "SIGNATURE_DOCUMENT"
    ENVOI_INVITATION = "ENVOI_INVITATION"
    GENERATION_CERTIFICAT = "GENERATION_CERTIFICAT"
    CONNEXION = "CONNEXION"
    INSCRIPTION = "INSCRIPTION"
    DEMANDE_CERTIFICAT = "DEMANDE_CERTIFICAT"
    APPROBATION_CERTIFICAT = "APPROBATION_CERTIFICAT"
    RENOUVELLEMENT_CERTIFICAT = "RENOUVELLEMENT_CERTIFICAT"
    ACTIVATION_COMPTE = "ACTIVATION_COMPTE"
    VALIDATION_OTP = "VALIDATION_OTP"
    SIGNATURE_AUTO = "AUTO_SIGNATURE"


class NiveauRisque(str, Enum):
    """Niveaux de risque possibles"""
    CRITIQUE = "CRITIQUE"
    ELEVE = "ELEVE"
    MOYEN = "MOYEN"
    FAIBLE = "FAIBLE"
    INCONNU = "INCONNU"


class TypeAnomalie(str, Enum):
    """Types d'anomalies détectables"""
    TENTATIVE_CONNEXION_ECHOUEE = "TENTATIVE_CONNEXION_ECHOUEE"
    SIGNATURE_ECHOUEE = "SIGNATURE_ECHOUEE"
    HORAIRE_INHABITUEL = "HORAIRE_INHABITUEL"
    CONNEXION_DEPUIS_IP_EXTERNE = "CONNEXION_DEPUIS_IP_EXTERNE"
    COMPORTEMENT_TRES_ANORMAL = "COMPORTEMENT_TRES_ANORMAL"
    COMPORTEMENT_ANORMAL = "COMPORTEMENT_ANORMAL"
    ACTIVITE_SUSPECTE = "ACTIVITE_SUSPECTE"
    PIC_ACTIVITE = "PIC_ACTIVITE"
    ATTAQUE_POTENTIELLE = "ATTAQUE_POTENTIELLE"


class StatutEvenement(str, Enum):
    """Statuts possibles pour un événement"""
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"


# ============================================
# MODÈLES DE REQUÊTES/RÉPONSES (AJOUTÉS)
# ============================================

class ReponseAnalyse(BaseModel):
    """Réponse d'analyse d'audit"""
    succes: bool = Field(True, description="Succès de l'opération")
    message: Optional[str] = Field(None, description="Message d'information")
    
    total_journaux: int = Field(0, description="Nombre de journaux analysés")
    nombre_anomalies: int = Field(0, description="Nombre d'anomalies détectées")
    niveau_risque_global: str = Field("INCONNU", description="Niveau de risque global")
    
    anomalies: List[Dict] = Field(default_factory=list, description="Anomalies détectées")
    pics_activite: List[Dict] = Field(default_factory=list, description="Pics d'activité")
    recommandations: List[str] = Field(default_factory=list, description="Recommandations")
    
    analyse_effectuee: datetime = Field(default_factory=datetime.now, description="Date de l'analyse")
    
    class Config:
        json_schema_extra = {
            "example": {
                "succes": True,
                "total_journaux": 150,
                "nombre_anomalies": 3,
                "niveau_risque_global": "MOYEN"
            }
        }


class RequeteAnalyse(BaseModel):
    """Requête d'analyse d'audit"""
    date_debut: Optional[datetime] = Field(None, description="Date de début")
    date_fin: Optional[datetime] = Field(None, description="Date de fin")
    email_utilisateur: Optional[str] = Field(None, description="Filtrer par utilisateur")
    seuil_anomalie: Optional[float] = Field(None, ge=0, le=1, description="Seuil personnalisé")
    
    @field_validator('date_debut', 'date_fin')
    @classmethod
    def valider_dates(cls, v: Optional[datetime], info) -> Optional[datetime]:
        if v and info.field_name == 'date_fin' and info.data.get('date_debut'):
            if v < info.data['date_debut']:
                raise ValueError('date_fin doit être postérieure à date_debut')
        return v


class RequeteRapport(BaseModel):
    """Requête de génération de rapport"""
    date_debut: datetime = Field(..., description="Date de début")
    date_fin: datetime = Field(..., description="Date de fin")
    format: str = Field("json", pattern="^(json|pdf)$", description="Format du rapport")
    inclure_anomalies: bool = Field(True, description="Inclure les anomalies")
    inclure_recommandations: bool = Field(True, description="Inclure les recommandations")


class ReponseRapport(BaseModel):
    """Réponse de génération de rapport"""
    succes: bool = Field(True, description="Succès de l'opération")
    message: Optional[str] = Field(None, description="Message d'information")
    rapport: Optional[Dict] = Field(None, description="Rapport généré")
    url_telechargement: Optional[str] = Field(None, description="URL de téléchargement (si PDF)")


class ConfigurationAlertes(BaseModel):
    """Configuration des alertes"""
    actif: bool = Field(True, description="Activer les alertes")
    canaux: List[str] = Field(["console"], description="Canaux d'alerte actifs")
    seuils: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    email: Optional[Dict[str, Any]] = Field(None, description="Configuration email")
    slack: Optional[Dict[str, Any]] = Field(None, description="Configuration Slack")


class ConfigurationAnalyse(BaseModel):
    """Configuration de l'analyse IA"""
    contamination: float = Field(0.05, ge=0.01, le=0.2)
    n_estimateurs: int = Field(100, ge=10, le=500)
    seuil_anomalie: float = Field(0.6, ge=0.3, le=0.9)
    poids_facteurs: Dict[str, float] = Field(default_factory=dict)
    fenetre_analyse_minutes: int = Field(5, ge=1, le=60)
    periode_analyse_jours: int = Field(30, ge=1, le=365)
    taille_lot: int = Field(500, ge=10, le=5000)
    intervalle_auto: int = Field(300, ge=60, le=3600)


# ============================================
# MODÈLES PRINCIPAUX
# ============================================

class JournalAudit(BaseModel):
    """Modèle pour les journaux d'audit - avec validation renforcée"""
    id: Optional[str] = Field(None, description="Identifiant unique du log")
    typeEvenement: str = Field(..., description="Type d'événement")
    horodatage: datetime = Field(default_factory=datetime.now, description="Date et heure")
    
    idUtilisateur: Optional[int] = Field(None, ge=1, description="ID de l'utilisateur")
    emailUtilisateur: Optional[str] = Field(None, description="Email de l'utilisateur")
    roleUtilisateur: Optional[str] = Field(None, description="Rôle de l'utilisateur")
    adresseIP: Optional[str] = Field(None, description="Adresse IP source")
    agentUtilisateur: Optional[str] = Field(None, max_length=500, description="User-Agent")
    
    idDocument: Optional[int] = Field(None, ge=1, description="ID du document")
    nomDocument: Optional[str] = Field(None, max_length=255, description="Nom du document")
    typeSignature: Optional[str] = Field(None, description="Type de signature")
    
    statut: str = Field(..., description="Statut (SUCCESS, FAILED, PENDING)")
    details: Optional[str] = Field(None, max_length=2000, description="Détails")
    jeton: Optional[str] = Field(None, max_length=255, description="Jeton d'invitation")
    
    @field_validator('emailUtilisateur')
    @classmethod
    def valider_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(pattern, v):
                raise ValueError(f'Email invalide: {v}')
        return v
    
    @field_validator('adresseIP')
    @classmethod
    def valider_ip(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != 'unknown':
            ipv4_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
            if re.match(ipv4_pattern, v):
                parts = v.split('.')
                for part in parts:
                    if int(part) > 255:
                        return 'invalid_ip'
                return v
            if ':' in v and len(v) <= 45:
                return v
            return 'unknown'
        return v
    
    @field_validator('statut')
    @classmethod
    def valider_statut(cls, v: str) -> str:
        if v not in ['SUCCESS', 'FAILED', 'PENDING']:
            return 'PENDING'
        return v
    
    @model_validator(mode='after')
    def valider_coherence(self) -> 'JournalAudit':
        if self.typeEvenement in ['SIGNATURE_DOCUMENT', 'AUTO_SIGNATURE']:
            if self.idDocument is None and self.nomDocument is None:
                raise ValueError('Une signature doit être associée à un document')
        return self
    
    class Config:
        json_schema_extra = {
            "example": {
                "typeEvenement": "SIGNATURE_DOCUMENT",
                "emailUtilisateur": "user@example.com",
                "statut": "SUCCESS"
            }
        }


class ResultatAnomalie(BaseModel):
    """Résultat de détection d'anomalie"""
    id_journal: Optional[str] = None
    horodatage: datetime = Field(default_factory=datetime.now)
    type_anomalie: str = Field(..., description="Type d'anomalie")
    niveau_risque: str = Field(default="MOYEN", description="Niveau de risque")
    score_anomalie: float = Field(..., ge=0, le=1)
    explication: str = Field(..., min_length=5, max_length=500)
    
    email_utilisateur: Optional[str] = None
    adresse_ip: Optional[str] = None
    type_evenement: Optional[str] = None
    statut: Optional[str] = None
    regles_metier_violees: List[str] = Field(default_factory=list)
    details: Optional[str] = None
    
    @field_validator('score_anomalie')
    @classmethod
    def valider_score(cls, v: float) -> float:
        return round(v, 3)
    
    @field_validator('niveau_risque')
    @classmethod
    def valider_niveau(cls, v: str) -> str:
        niveaux_valides = ['CRITIQUE', 'ELEVE', 'MOYEN', 'FAIBLE', 'INCONNU']
        return v if v in niveaux_valides else 'INCONNU'


class ScoreRisqueUtilisateur(BaseModel):
    """Score de risque utilisateur"""
    email_utilisateur: str
    score_risque: float = Field(..., ge=0, le=1)
    niveau_risque: str = "INCONNU"
    facteurs: Dict[str, float] = Field(default_factory=dict)
    
    total_evenements: int = 0
    premier_evenement: Optional[datetime] = None
    dernier_evenement: Optional[datetime] = None
    
    metriques: Dict[str, Any] = Field(default_factory=dict)
    recommandations: List[str] = Field(default_factory=list)
    
    tendance: Optional[str] = Field(None, description="Tendance du risque")
    historique_scores: List[float] = Field(default_factory=list)
    dernier_update: datetime = Field(default_factory=datetime.now)
    
    @field_validator('score_risque')
    @classmethod
    def arrondir_score(cls, v: float) -> float:
        return round(v, 3)
    
    def to_dict(self) -> Dict:
        return self.model_dump(exclude_none=True)


class RapportAudit(BaseModel):
    """Rapport d'audit complet"""
    id_rapport: str = Field(default_factory=lambda: f"AUDIT_{uuid.uuid4().hex[:8].upper()}")
    version: str = "1.0"
    service: str = "Assistant d'Audit Intelligent"
    
    periode_debut: datetime
    periode_fin: datetime
    genere_le: datetime = Field(default_factory=datetime.now)
    
    resume_executif: str = ""
    statistiques_globales: Dict[str, Any] = Field(default_factory=dict)
    analyse_temporelle: Dict[str, Any] = Field(default_factory=dict)
    
    top_utilisateurs: List[Dict] = Field(default_factory=list)
    analyse_evenements: Dict[str, Any] = Field(default_factory=dict)
    analyse_securite: Dict[str, Any] = Field(default_factory=dict)
    
    resume_anomalies: Optional[Dict[str, Any]] = None
    recommandations: List[str] = Field(default_factory=list)
    metriques_cles: Dict[str, Any] = Field(default_factory=dict)
    annexes: Dict[str, Any] = Field(default_factory=dict)
    
    @model_validator(mode='after')
    def valider_periode(self) -> 'RapportAudit':
        if self.periode_fin < self.periode_debut:
            raise ValueError('periode_fin doit être postérieure à periode_debut')
        if (self.periode_fin - self.periode_debut) > timedelta(days=365):
            raise ValueError('La période ne peut pas dépasser 365 jours')
        return self


# ============================================
# FONCTIONS UTILITAIRES
# ============================================

def convertir_journal_vers_dict(journal: Union[JournalAudit, Dict]) -> Dict[str, Any]:
    """Convertit un JournalAudit en dictionnaire"""
    if isinstance(journal, dict):
        return journal
    return journal.model_dump(exclude_none=True)


def valider_journal_audit(data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Valide un dictionnaire au format JournalAudit"""
    try:
        JournalAudit(**data)
        return True, None
    except Exception as e:
        return False, str(e)


def creer_journal_depuis_spring(data: Dict[str, Any]) -> Optional[JournalAudit]:
    """Crée un JournalAudit à partir des données Spring Boot"""
    try:
        if 'timestamp' in data and 'horodatage' not in data:
            data['horodatage'] = data['timestamp']
        
        if 'typeEvenement' not in data:
            data['typeEvenement'] = 'CONNEXION'
        if 'statut' not in data:
            data['statut'] = 'PENDING'
        
        return JournalAudit(**data)
    except Exception as e:
        print(f"Erreur conversion journal: {e}")
        return None