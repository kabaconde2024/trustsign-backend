// controleurs/ia/ControleurDetectionFalsification.java
package pfe.back_end.controleurs.ia;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.ResultatAnalyseFalsification;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.services.document.ServiceGestionDocuments;
import pfe.back_end.services.ia.ServiceDetectionFalsification;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ia/securite")
@CrossOrigin(origins = {"http://localhost:3000", "https://localhost:3000"}, allowCredentials = "true")
public class ControleurDetectionFalsification {

    @Autowired
    private ServiceDetectionFalsification serviceDetectionFalsification;

    @Autowired
    private ServiceGestionDocuments serviceGestionDocuments;

    @Autowired
    private DocumentRepository documentRepository;

    @PostMapping("/analyser-falsification")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> analyserFalsification(
            @RequestParam("fichier") MultipartFile fichier,
            Authentication authentication) {
        try {
            System.out.println("=== DÉBUT ANALYSE FALSIFICATION ===");
            System.out.println("Utilisateur: " + authentication.getName());
            System.out.println("Fichier: " + fichier.getOriginalFilename());

            byte[] contenuPdf = fichier.getBytes();

            Document infosDocument = new Document();
            infosDocument.setId(0L);
            infosDocument.setNomFichier(fichier.getOriginalFilename());
            infosDocument.setHashSha256(null);

            ResultatAnalyseFalsification resultat = serviceDetectionFalsification.analyserDocument(contenuPdf, infosDocument);

            System.out.println("Score d'intégrité: " + resultat.getScoreIntegrite() + "%");
            System.out.println("Niveau de confiance: " + resultat.getNiveauConfiance());

            return ResponseEntity.ok(resultat);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("erreur", e.getMessage()));
        }
    }

    @GetMapping("/analyser-document/{idDocument}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> analyserDocumentExistant(@PathVariable Long idDocument) {
        try {
            byte[] contenuPdf = serviceGestionDocuments.getContenu(idDocument);
            Document document = documentRepository.findById(idDocument)
                    .orElseThrow(() -> new RuntimeException("Document non trouvé"));

            ResultatAnalyseFalsification resultat = serviceDetectionFalsification.analyserDocument(contenuPdf, document);

            return ResponseEntity.ok(resultat);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("erreur", e.getMessage()));
        }
    }

    @PostMapping("/verifier-integrite-rapide")
    public ResponseEntity<?> verifierIntegriteRapide(@RequestParam("fichier") MultipartFile fichier) {
        try {
            byte[] contenuPdf = fichier.getBytes();
            String hashActuel = serviceDetectionFalsification.calculerSha256(contenuPdf);

            Map<String, Object> reponse = new HashMap<>();
            reponse.put("hash", hashActuel);
            reponse.put("nomFichier", fichier.getOriginalFilename());
            reponse.put("taille", fichier.getSize());
            reponse.put("dateAnalyse", java.time.LocalDateTime.now().toString());

            return ResponseEntity.ok(reponse);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("erreur", e.getMessage()));
        }
    }
}