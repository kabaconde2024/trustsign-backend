# service_ia/services/generateur_resume.py
"""
Génération de résumé de documents - Avec classification automatique
"""
import re
from datetime import datetime
from typing import Dict, List
from collections import Counter


class GenerateurResume:
    
    def __init__(self):
        # Mots à ignorer
        self.ignores = {
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou',
            'mais', 'donc', 'car', 'ce', 'cet', 'cette', 'ces', 'je', 'tu',
            'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se',
            'lui', 'leur', 'en', 'est', 'sont', 'dans', 'pour', 'par', 'avec'
        }
        
        # Catégories avec mots-clés associés
        self.categories = {
            '📄 CONTRAT': ['contrat', 'clause', 'parties', 'accord', 'signature', 'engagement', 'obligation', 'durée'],
            '💰 FACTURE': ['facture', 'invoice', 'ttc', 'montant', 'total', 'payer', 'règlement', 'échéance'],
            '📊 RAPPORT': ['rapport', 'analyse', 'étude', 'conclusion', 'recommandation', 'résultat', 'synthèse'],
            '👤 CV': ['cv', 'curriculum', 'expérience', 'compétences', 'diplôme', 'formation', 'parcours'],
            '📜 ATTESTATION': ['attestation', 'certificat', 'certifie', 'soussigné', 'atteste'],
            '📝 DEVIS': ['devis', 'estimation', 'prix', 'coût', 'prestation', 'tarif'],
            '✉️ COURRIER': ['courrier', 'lettre', 'objet', 'cher', 'cordialement', 'salutation'],
            '📄 AUTRE': []
        }
    
    def _classer(self, texte: str, nom: str) -> str:
        """Détecte la catégorie du document"""
        t_lower = texte.lower()
        n_lower = nom.lower()
        
        scores = {}
        for cat, mots in self.categories.items():
            score = 0
            for mot in mots:
                if mot in t_lower:
                    score += 2
                if mot in n_lower:
                    score += 1
            scores[cat] = score
        
        # Retourner la catégorie avec le meilleur score
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else '📄 AUTRE'
    
    def generer_resume(self, texte: str, nom: str = "") -> Dict:
        if not texte or len(texte) < 100:
            return {'resume': f"Document: {nom}\n\nContenu trop court.", 'temps_generation': datetime.now().isoformat()}
        
        texte = texte[:6000]
        texte = re.sub(r'[^\w\s\.\,\!\?]', ' ', texte)
        texte = re.sub(r'\s+', ' ', texte).strip()
        
        # Classification
        categorie = self._classer(texte, nom)
        
        # Extraire mots-clés
        mots = [m for m in re.findall(r'\b[a-z]{4,}\b', texte.lower()) if m not in self.ignores]
        mots_cles = [m for m, _ in Counter(mots).most_common(6)] if mots else []
        
        # Extraire phrases importantes
        phrases = [p.strip() for p in re.split(r'[.!?]\s+', texte) if 40 < len(p.strip()) < 500]
        
        # Noter les phrases
        scored = []
        for i, p in enumerate(phrases[:20]):
            score = 0
            if any(m in p.lower() for m in mots_cles[:5]): score += 3
            if re.search(r'\d+', p): score += 2
            if i < 3: score += 2
            scored.append((score, p))
        
        scored.sort(reverse=True)
        meilleures = [p for _, p in scored[:3]]
        
        # Construire résumé
        resume = f"{categorie}\n"
        resume += f"Fichier: {nom}\n"
        resume += f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n"
        resume += "─" * 35 + "\n\n"
        
        if mots_cles:
            resume += f"🏷️ Mots-clés: {', '.join(mots_cles)}\n\n"
        
        if meilleures:
            resume += "📌 Extrait:\n"
            for i, p in enumerate(meilleures, 1):
                p = p[:200] + "..." if len(p) > 200 else p
                resume += f"{i}. {p}\n\n"
        
        # Conseil selon catégorie
        conseils = {
            '📄 CONTRAT': "⚠️ Vérifier signatures, dates et clauses",
            '💰 FACTURE': "💰 Vérifier montant total et date d'échéance",
            '📊 RAPPORT': "📊 Lire attentivement les conclusions",
            '👤 CV': "👤 Vérifier expérience et compétences",
            '📜 ATTESTATION': "📜 Vérifier date et signataire",
            '📝 DEVIS': "📝 Vérifier prix et délais"
        }
        if categorie in conseils:
            resume += f"🔍 {conseils[categorie]}\n\n"
        
        resume += "─" * 35 + f"\n📊 {len(phrases)} phrases"
        
        return {'resume': resume, 'categorie': categorie, 'temps_generation': datetime.now().isoformat()}


generateur_resume = GenerateurResume()

def generer_resume_document(texte: str, nom_fichier: str = "") -> Dict:
    return generateur_resume.generer_resume(texte, nom_fichier)