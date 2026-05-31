package pfe.back_end.controleurs.signature;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.dto.SignatureRequest;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.InvitationSignature;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.repositories.sql.InvitationRepository;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.document.ServiceGestionDocuments;
import pfe.back_end.services.signature.ServiceSignatureSimple;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/signature")
@CrossOrigin(origins = {
        "http://localhost:3000"
        // "https://trustsign-frontend.onrender.com"
}, allowCredentials = "true")
public class SignatureSimpleControleur {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private InvitationRepository invitationRepository;

    @Autowired
    private ServiceSignatureSimple serviceSignatureSimple;

    @Autowired
    private ServiceGestionDocuments serviceDocument;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @PostMapping("/valider-simple")
    @Transactional
    public ResponseEntity<?> signerSimple(@RequestBody SignatureRequest request) {
        try {
            InvitationSignature inv = invitationRepository.findByTokenSignature(request.getToken())
                    .orElseThrow(() -> new RuntimeException("Invitation invalide"));

            Document doc = inv.getDocument();

            Utilisateur signataire = utilisateurRepository.findByEmail(inv.getEmailDestinataire())
                    .orElseThrow(() -> new RuntimeException("Utilisateur signataire non trouvé"));

            byte[] pdfOriginal = serviceDocument.getContenu(doc.getId());

            byte[] pdfSigne = serviceSignatureSimple.signerDocumentSimple(
                    pdfOriginal,
                    request.getNom(),
                    inv.getEmailDestinataire(),
                    request.getOtp(),
                    request.getX(),
                    request.getY(),
                    request.getPageNumber(),
                    request.getDisplayWidth(),
                    request.getDisplayHeight(),
                    request.getSignatureImage(),
                    doc.getId(),
                    signataire
            );

            inv.setStatut("SIGNE");
            inv.setDateSignature(LocalDateTime.now());
            inv.setCoordonneeX(request.getX());
            inv.setCoordonneeY(request.getY());
            inv.setPageNumber(request.getPageNumber());
            invitationRepository.save(inv);

            String nouveauNom = "SIGNE_" + doc.getNomFichier();
            String cheminStockage = serviceDocument.sauvegarderSurDisque(doc.getId(), pdfSigne, nouveauNom);

            doc.setCheminStockage(cheminStockage);
            doc.setEstSigne(true);
            doc.setStatut(pfe.back_end.modeles.entites.StatutDocument.SIGNE);
            doc.setSignataire(signataire);
            documentRepository.save(doc);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nouveauNom + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfSigne);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }
}