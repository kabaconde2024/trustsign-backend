package pfe.back_end.controleurs.signature;

import org.bouncycastle.util.encoders.Hex;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.audit.ServiceAudit;
import pfe.back_end.services.document.ServiceGestionDocuments;
import pfe.back_end.services.signature.AutoSignature;
import pfe.back_end.services.signature.ServiceLimitationSignature;

import java.security.MessageDigest;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/signature")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "https://localhost:3000"
}, allowCredentials = "true")
public class AutoSignatureControleur {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private AutoSignature serviceAutoSignature;

    @Autowired
    private ServiceGestionDocuments serviceDocument;

    @Autowired
    private ServiceAudit serviceAudit;

    @Autowired
    private ServiceLimitationSignature serviceLimitationSignature;

    @PostMapping("/appliquer-auto-signature")
    @Transactional
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> AutoSignature(
            @RequestParam("documentId") String documentId,
            @RequestParam("x") float x,
            @RequestParam("y") float y,
            @RequestParam("pageNumber") int page,
            @RequestParam("displayWidth") float displayWidth,
            @RequestParam("displayHeight") float displayHeight,
            Authentication authentication) {
        try {
            System.out.println("=== DÉBUT AUTO-SIGNATURE CONTROLLER ===");
            System.out.println("Utilisateur: " + (authentication != null ? authentication.getName() : "null"));
            System.out.println("Document ID: " + documentId);

            // 1. Récupérer l'utilisateur connecté
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(401).body(Map.of("erreur", "Utilisateur non authentifié"));
            }

            Utilisateur user = utilisateurRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            System.out.println("Utilisateur trouvé: " + user.getEmail());

            if (!serviceLimitationSignature.peutSigner(user)) {
                ServiceLimitationSignature.QuotaInfo quota = serviceLimitationSignature.getQuotaInfo(user);
                System.err.println("REFUS : Limite de signature atteinte pour " + user.getEmail());
                return ResponseEntity.status(429).body(Map.of(
                        "erreur", "Vous avez atteint votre limite de signatures quotidienne.",
                        "signaturesAujourdhui", quota.signaturesAujourdhui,
                        "limiteQuotidienne", quota.limiteQuotidienne,
                        "resteAujourdhui", quota.resteAujourdhui,
                        "signaturesCetteSemaine", quota.signaturesCetteSemaine,
                        "signaturesCeMois", quota.signaturesCeMois,
                        "message", String.format(
                                "Vous avez signé %d documents aujourd'hui (limite: %d). Réessayez demain.",
                                quota.signaturesAujourdhui, quota.limiteQuotidienne
                        )
                ));
            }

            // 2. Vérifier si l'utilisateur a une signature enregistrée
            if (user.getImageSignature() == null || user.getImageSignature().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "erreur", "Vous n'avez pas de signature enregistrée. Veuillez d'abord créer votre signature manuscrite dans votre profil."
                ));
            }

            Long idConverti = Long.parseLong(documentId);
            byte[] pdfOriginal = serviceDocument.getContenu(idConverti);

            Document doc = documentRepository.findById(idConverti)
                    .orElseThrow(() -> new RuntimeException("Document non trouvé"));
            String nomDocument = doc.getNomFichier();

            if (doc.isEstSigne()) {
                return ResponseEntity.status(409).body(Map.of(
                        "erreur", "Ce document a déjà été signé le " + doc.getDateHorodatage()
                ));
            }

            if (!doc.getProprietaire().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of(
                        "erreur", "Vous n'êtes pas autorisé à signer ce document"
                ));
            }


            String hashOriginalStocke = doc.getHashSha256();

            if (hashOriginalStocke == null || hashOriginalStocke.isEmpty()) {
                System.err.println("Aucun hash stocké pour ce document lors de l'upload");
                return ResponseEntity.status(409).body(Map.of(
                        "erreur", "Document invalide : aucun hash d'intégrité trouvé"
                ));
            }

            System.out.println(" Hash original stocké (upload): " + hashOriginalStocke);

            List<Document> documentsMemeHash = documentRepository.findByHashSha256(hashOriginalStocke);

            for (Document docExistant : documentsMemeHash) {
                if (docExistant.isEstSigne() && !docExistant.getId().equals(idConverti)) {
                    System.err.println("REFUS : Document avec même contenu déjà signé (ID: " + docExistant.getId() + ")");
                    return ResponseEntity.status(409).body(Map.of(
                            "erreur", "Un document avec le même contenu a déjà été signé.",
                            "documentExistantId", docExistant.getId(),
                            "dateSignature", docExistant.getDateHorodatage() != null ?
                                    docExistant.getDateHorodatage().toString() : "Date inconnue",
                            "message", "Vous ne pouvez pas signer le même document plusieurs fois."
                    ));
                }
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(pdfOriginal);
            String hashActuel = Hex.toHexString(hashBytes);

            if (!hashOriginalStocke.equals(hashActuel)) {
                System.err.println("ALERTE : Le contenu du document a changé depuis l'upload !");
                return ResponseEntity.status(409).body(Map.of(
                        "erreur", "Le document a été modifié depuis son téléchargement. Signature impossible."
                ));
            }

            System.out.println("Aucun document avec le même contenu n'est déjà signé");
            System.out.println("Intégrité du document vérifiée");

            // 8. Préparation de l'image signature
            String base64Image = user.getImageSignature();
            String cleanBase64 = base64Image.contains(",") ? base64Image.split(",")[1] : base64Image;
            byte[] imageBytes = java.util.Base64.getDecoder().decode(cleanBase64);

            // 9. Signature du document
            byte[] pdfSigne = serviceAutoSignature.signerDocumentAuto(
                    pdfOriginal,
                    imageBytes,
                    user.getPrenom() + " " + user.getNom(),
                    user.getEmail(),
                    x,
                    y,
                    page,
                    displayWidth,
                    displayHeight,
                    idConverti
            );

            Document docFinal = serviceDocument.finaliserSignatureGenerique(idConverti, pdfSigne, user, null);

            serviceLimitationSignature.enregistrerSignature(user);
            System.out.println("Signature enregistrée dans le quota pour " + user.getEmail());

            serviceAudit.logAutoSignature(
                    user.getId(),
                    user.getEmail(),
                    idConverti,
                    nomDocument,
                    "SUCCESS",
                    "Auto-signature appliquée"
            );

            System.out.println("FIN AUTO-SIGNATURE CONTROLLER SUCCÈS ");

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + docFinal.getNomFichier() + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfSigne);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", "Format d'image invalide : " + e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("erreur", "Erreur technique : " + e.getMessage()));
        }
    }
}