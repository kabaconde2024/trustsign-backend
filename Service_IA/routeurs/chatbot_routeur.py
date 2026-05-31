# service_ia/routeurs/chatbot_routeur.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import logging
import os
import requests
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

# ============================================
# CONFIGURATION MISTRAL (avec ta clé par défaut)
# ============================================
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "ZQfdOI3Q3Gwg2d7odgcg0Madaexee3qY")
MISTRAL_AVAILABLE = bool(MISTRAL_API_KEY)

if MISTRAL_AVAILABLE:
    logger.info(f"✅ Mistral API configurée (clé: {MISTRAL_API_KEY[:10]}...)")

# ============================================
# BASE DE CONNAISSANCES PROTECTED CONSULTING (RAG)
# ============================================
PROTECTED_CONSULTING_KB = {
    "presentation": {
        "keywords": ["protected consulting", "qui êtes-vous", "présentation", "entreprise", "trustsign"],
        "content": """
Protected Consulting est une entreprise spécialisée en sécurité numérique et signature électronique.
Notre solution TrustSign permet de :
- Signer des documents électroniques de manière légale et sécurisée
- Gérer les invitations à signer
- Archiver les documents signés conformément à la législation (10 ans)

Notre engagement : sécurité maximale avec stockage des clés dans un HSM (Hardware Security Module).
"""
    },
    "signature_simple": {
        "keywords": ["signature simple", "otp", "code otp", "sms", "code sms", "comment signer", "signer document"],
        "content": """
[SIGNATURE SIMPLE - TrustSign par Protected Consulting]

La signature simple utilise un code de vérification envoyé par SMS.

PROCÉDURE COMPLÈTE :
1. Recevez une invitation par email
2. Cliquez sur le lien sécurisé (valable 7 jours)
3. Visualisez le document
4. Saisissez le code OTP reçu par SMS
5. Confirmez votre signature

⏱ DÉLAIS :
- Code OTP valable : 5 minutes
- Lien d'invitation valable : 7 jours

CODE NON REÇU ?
1. Vérifiez votre numéro de téléphone dans votre profil
2. Assurez-vous d'avoir du réseau
3. Redemandez un nouveau code (max 3 tentatives)
4. Contactez le support : support@protected-consulting.com
"""
    },
    "signature_avancee": {
        "keywords": ["signature avancée", "pki", "certificat", "hsm", "certificat numérique", "signature qualifiée"],
        "content": """
[SIGNATURE AVANCÉE PKI/HSM - TrustSign par Protected Consulting]

La signature avancée utilise un certificat numérique stocké dans un HSM (Hardware Security Module).

CARACTÉRISTIQUES :
- Clé privée stockée dans un HSM (ne quitte JAMAIS le matériel)
- Certificat signé par notre Autorité de Certification
- Non-répudiation : impossible de nier avoir signé

PROCÉDURE :
1. Obtenez un certificat numérique (demande dans votre profil)
2. Attendez la validation par l'administrateur (24-48h)
3. Recevez l'invitation à signer
4. Cliquez sur "Signer avec certificat"
5. Validez la signature

VALEUR JURIDIQUE : Équivalente à la signature manuscrite, conforme eIDAS
VALIDITÉ : Certificat valable 1 an
"""
    },
    "auto_signature": {
        "keywords": [
            "auto signature", "auto-signature", "signature automatique", 
            "signature manuscrite", "image signature", "signature image",
            "appliquer signature", "position signature", "cliquer signature",
            "signature perso", "ma signature", "créer signature"
        ],
        "content": """
[AUTO-SIGNATURE - Signature manuscrite avec TrustSign]

L'auto-signature vous permet d'apposer votre signature manuscrite sur les documents PDF.

PROCÉDURE :
1. Créez votre signature dans "Mon profil" → "Ma signature"
2. Chargez votre PDF dans "Auto-signature"
3. Cliquez sur le PDF pour positionner la signature
4. Cliquez sur "Appliquer ma signature"

VÉRIFICATIONS : propriétaire du document, non déjà signé, intégrité du fichier
"""
    },
    "certificat_obtention": {
        "keywords": ["obtenir certificat", "demander certificat", "créer certificat", "activer certificat", "certificat"],
        "content": """
OBTENIR UN CERTIFICAT NUMÉRIQUE - TrustSign

ÉTAPES :
1. Connectez-vous à votre espace TrustSign
2. Allez dans "Mon profil" → "Certificat numérique"
3. Cliquez sur "Demander un certificat"
4. Attendez l'approbation de l'administrateur (24-48h)
5. Recevez une notification lorsque votre certificat est actif

SUPPORT : support@protected-consulting.com
"""
    },
    "invitation": {
        "keywords": ["invitation", "inviter", "envoyer invitation", "signer document", "inviter signataire"],
        "content": """
ENVOYER UNE INVITATION À SIGNER - TrustSign

PROCÉDURE :
1. Connectez-vous à votre espace TrustSign
2. Téléchargez le document à signer (PDF max 10 Mo)
3. Cliquez sur "Inviter à signer"
4. Renseignez l'email du signataire
5. Choisissez le type de signature
6. Envoyez l'invitation

DÉLAI : Lien valable 7 jours
SUIVI : Dans "Mes invitations"
"""
    },
    "mfa": {
        "keywords": ["double authentification", "mfa", "2fa", "google authenticator", "authentification forte"],
        "content": """
DOUBLE AUTHENTIFICATION (MFA) - TrustSign

ACTIVATION :
1. Allez dans "Paramètres" → "Sécurité"
2. Cliquez sur "Activer la double authentification"
3. Installez Google Authenticator
4. Scannez le QR code
5. Validez avec le code à 6 chiffres

IMPORTANT : Sauvegardez les codes de récupération
"""
    },
    "mot_de_passe": {
        "keywords": ["mot de passe oublié", "réinitialiser mot de passe", "perdu mot de passe", "changer mot de passe"],
        "content": """
MOT DE PASSE OUBLIÉ - TrustSign

PROCÉDURE :
1. Sur la page de connexion, cliquez sur "Mot de passe oublié"
2. Saisissez votre adresse email
3. Recevez un lien de réinitialisation (valable 1 heure)
4. Créez un nouveau mot de passe (12+ caractères, majuscule, minuscule, chiffre, spécial)
"""
    },
    "legalite": {
        "keywords": ["légal", "loi", "eidas", "valeur juridique", "tribunal", "preuve", "légalité"],
        "content": """
CADRE LÉGAL - TrustSign

RÈGLEMENT eIDAS (UE 910/2014) :
- Signature simple (OTP) : Preuve électronique admissible
- Signature avancée (PKI) : Équivalente à signature manuscrite

CONSERVATION : 10 ans, format PDF/A, horodatage TSA
"""
    },
    "probleme_technique": {
        "keywords": ["problème", "bug", "erreur", "marche pas", "ne fonctionne", "bloqué"],
        "content": """
PROBLÈMES COURANTS - TrustSign

1. CONNEXION IMPOSSIBLE : Vérifiez email/mdp, attendez 30 min
2. CODE OTP NON REÇU : Vérifiez numéro, redemandez (max 3 fois)
3. SIGNATURE IMPOSSIBLE : Vérifiez que le lien n'est pas expiré (7j)
4. PAGE NE CHARGE PAS : Videz cache, navigation privée

SUPPORT : support@protected-consulting.com
"""
    },
    "contact": {
        "keywords": ["contact", "support", "aide", "contacter", "email support", "téléphone"],
        "content": """
CONTACTER PROTECTED CONSULTING / TRUSTSIGN

SUPPORT : support@protected-consulting.com (réponse < 4h)
COMMERCIAL : commercial@protected-consulting.com
"""
    }
}

# ============================================
# MODÈLES DE DONNÉES
# ============================================
class MessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    conversation_history: Optional[List[Dict]] = None

class MessageResponse(BaseModel):
    response: str
    intent: str
    confidence: float
    suggestions: List[str]
    model_used: str
    timestamp: str

# ============================================
# FONCTIONS RAG (recherche sémantique simple)
# ============================================

def calculate_similarity(a: str, b: str) -> float:
    """Calcule la similarité entre deux chaînes"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def find_best_context(user_message: str) -> tuple:
    """Trouve le contexte le plus pertinent dans la base de connaissances"""
    message_lower = user_message.lower().strip()
    
    best_key = None
    best_score = 0
    best_content = None
    
    for key, data in PROTECTED_CONSULTING_KB.items():
        # Score basé sur les mots-clés
        keyword_score = 0
        for keyword in data["keywords"]:
            if keyword in message_lower:
                keyword_score += 1
        
        # Score basé sur la similarité textuelle
        similarity_score = calculate_similarity(message_lower, " ".join(data["keywords"]))
        
        # Score total (70% keywords, 30% similarité)
        total_score = (keyword_score * 0.7) + (similarity_score * 0.3)
        
        if total_score > best_score:
            best_score = total_score
            best_key = key
            best_content = data["content"]
    
    if best_score >= 0.3:
        confidence = min(best_score / 5, 0.95)
        return best_content, best_key, confidence
    
    return None, None, 0.0

# ============================================
# FONCTION MISTRAL AVEC RAG
# ============================================
async def get_mistral_response_with_rag(message: str, context: str = None):
    """Appel à l'API Mistral avec contexte RAG"""
    if not MISTRAL_AVAILABLE:
        return None
    
    try:
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Construction du système prompt avec RAG
        if context:
            system_prompt = f"""Tu es l'assistant officiel de TRUSTSIGN par PROTECTED CONSULTING.

Utilise ces informations OFFICIELLES pour répondre :
{context}

RÈGLES :
- Réponds en français, professionnellement
- Donne des réponses PRATIQUES et ACTIONNABLES
- Propose des étapes claires

Si l'utilisateur pose une question hors sujet (géographie, actualités, etc.), réponds poliment que tu ne peux répondre qu'aux questions sur TrustSign."""
        else:
            system_prompt = """Tu es l'assistant officiel de TRUSTSIGN par PROTECTED CONSULTING.

Tu réponds UNIQUEMENT aux questions sur :
- La signature électronique (simple, avancée PKI/HSM, auto-signature)
- Les certificats numériques
- Les invitations à signer
- La double authentification (MFA)
- Les problèmes techniques de TrustSign

Si l'utilisateur pose une question HORS SUJET, réponds:
"Je suis désolé, je ne peux répondre qu'aux questions concernant TrustSign et la signature électronique. Pour toute autre question, veuillez contacter notre support à support@protected-consulting.com"

Réponds en français, professionnellement."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        response = requests.post(
            url,
            headers=headers,
            json={
                "model": "mistral-small-latest",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 500
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result["choices"][0]["message"]["content"]
        else:
            logger.error(f"Erreur Mistral: {response.status_code}")
            return None
        
    except Exception as e:
        logger.error(f"Erreur Mistral: {e}")
        return None

# ============================================
# ENDPOINTS
# ============================================

@router.post("/message", response_model=MessageResponse)
async def send_message(request: MessageRequest):
    logger.info(f"📨 Message: {request.message[:100]}...")
    
    # ÉTAPE 1: RAG - Recherche dans la base Protected Consulting
    context, intent, confidence = find_best_context(request.message)
    logger.info(f"🔍 RAG - intent: {intent}, confidence: {confidence:.3f}")
    
    # ÉTAPE 2: Tentative avec Mistral + RAG (même hors base)
    if MISTRAL_AVAILABLE:
        logger.info("🚀 Appel Mistral AI avec RAG...")
        mistral_response = await get_mistral_response_with_rag(request.message, context)
        
        if mistral_response:
            logger.info("✅ Réponse Mistral AI")
            return MessageResponse(
                response=mistral_response,
                intent=intent or "mistral_generated",
                confidence=0.92,
                suggestions=[
                    "Comment signer un document ?",
                    "Comment créer ma signature manuscrite ?",
                    "Comment obtenir un certificat ?",
                    "Je n'ai pas reçu mon code OTP",
                    "Contacter le support"
                ],
                model_used="mistral+rag",
                timestamp=datetime.now().isoformat()
            )
        else:
            logger.warning("⚠️ Mistral n'a pas répondu, fallback local")
    else:
        logger.warning("⚠️ Mistral non disponible (clé API manquante)")
    
    # ÉTAPE 3: Fallback avec RAG local
    if context:
        logger.info(f"📚 Fallback RAG local (intent: {intent})")
        return MessageResponse(
            response=context,
            intent=intent or "fallback_rag",
            confidence=confidence or 0.7,
            suggestions=[
                "Comment signer un document ?",
                "Comment créer ma signature manuscrite ?",
                "Comment obtenir un certificat ?",
                "Code OTP non reçu"
            ],
            model_used="fallback_rag",
            timestamp=datetime.now().isoformat()
        )
    
    # ÉTAPE 4: Fallback générique
    logger.info(f"❌ Fallback générique")
    return MessageResponse(
        response="""
❌ Je n'ai pas bien compris votre question.

📋 Je peux vous aider sur :
- Signature simple (code OTP)
- Signature avancée (PKI/HSM)
- Auto-signature (signature manuscrite)
- Certificats numériques
- Invitations à signer
- Double authentification (MFA)
- Problèmes techniques
- Aspects légaux (eIDAS)

💡 Exemples : "Comment signer un document ?", "Comment obtenir un certificat ?"

📧 support@protected-consulting.com
""",
        intent="inconnu",
        confidence=0.3,
        suggestions=[
            "Comment signer un document ?",
            "Comment créer ma signature manuscrite ?",
            "Comment obtenir un certificat ?",
            "Double authentification"
        ],
        model_used="fallback_generic",
        timestamp=datetime.now().isoformat()
    )

@router.get("/suggestions")
async def get_suggestions():
    return {"suggestions": [
        "Comment signer un document ?",
        "Comment créer ma signature manuscrite ?",
        "Comment obtenir un certificat numérique ?",
        "Je n'ai pas reçu mon code OTP",
        "Activer la double authentification",
        "Mon compte est bloqué",
        "Contacter le support"
    ]}

@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "chatbot_protected_consulting",
        "mistral_available": MISTRAL_AVAILABLE,
        "knowledge_base_size": len(PROTECTED_CONSULTING_KB),
        "timestamp": datetime.now().isoformat()
    }