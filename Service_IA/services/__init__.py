# service_ia/services/__init__.py
from .detecteur_anomalies import DetecteurAnomalies
from .calculateur_risque import CalculateurRisque
from .generateur_rapport_audit import GenerateurRapportAudit
from .alerte_service import ServiceAlerte
# from .detecteur_faux_documents import DetecteurFauxDocuments, DetecteurFauxDocumentsSimple  # ⚠️ SUPPRIMER CETTE LIGNE

__all__ = [
    'DetecteurAnomalies',
    'CalculateurRisque', 
    'GenerateurRapportAudit',
    'ServiceAlerte',
    # 'DetecteurFauxDocuments',  # Supprimer
    # 'DetecteurFauxDocumentsSimple'  # Supprimer
]