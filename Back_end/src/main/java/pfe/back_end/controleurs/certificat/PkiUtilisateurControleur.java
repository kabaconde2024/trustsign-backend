package pfe.back_end.controleurs.certificat;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.audit.ServiceAudit;

import java.io.ByteArrayInputStream;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/utilisateur/pki")
@CrossOrigin(origins = {
    "http://localhost:3000",
    "https://frontendmemoire.onrender.com"
}, allowCredentials = "true")
public class PkiUtilisateurControleur {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private ServiceAudit serviceAudit;

    /**
     * Nettoie une chaîne PEM pour en extraire uniquement les données Base64 pures.
     */
    private byte[] extraireOctetsCertificat(String pemRaw) throws IllegalArgumentException {
        if (pemRaw == null || pemRaw.isEmpty()) {
            throw new IllegalArgumentException("Le certificat PEM est vide.");
        }
        // Supprime les en-têtes/pieds personnalisés ou standards (et tous les espaces/retours à la ligne)
        String pemClean = pemRaw
                .replaceAll("-+BEGIN CERTIFICATE-+", "")
                .replaceAll("-+END CERTIFICATE-+", "")
                .replaceAll("Debut\\s+Certificat", "")
                .replaceAll("Fin\\s+Certificat", "")
                .replaceAll("\\s", ""); // Supprime \n, \r, espaces et tabulations

        return Base64.getDecoder().decode(pemClean);
    }

    @PostMapping("/request-certificate")
    public ResponseEntity<?> requestCertificate(Authentication auth) {
        try {
            String email = auth.getName();
            System.out.println("Demande de certificat pour: " + email);

            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            if ("PENDING".equals(user.getStatusPki())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Une demande de certificat est déjà en attente de validation par l'administrateur."
                ));
            }

            if ("ACTIVE".equals(user.getStatusPki())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Vous avez déjà un certificat actif."
                ));
            }

            user.setStatusPki("PENDING");
            utilisateurRepository.save(user);

            serviceAudit.logDemandeCertificat(user.getId(), email, "PENDING", "Demande de certificat envoyée");

            System.out.println("Demande de certificat enregistrée pour: " + email);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Votre demande de certificat a été envoyée à l'administrateur."
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "message", "Erreur lors de la demande: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/mon-statut")
    public ResponseEntity<?> getMonStatut(Authentication auth) {
        try {
            String email = auth.getName();
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            String status = user.getStatusPki();
            if (status == null || status.isEmpty()) {
                status = "NONE";
            }

            Map<String, Object> response = new HashMap<>();
            response.put("status", status);
            response.put("certificatPem", user.getCertificatPem());
            response.put("hsmAlias", user.getHsmAlias());

            if (user.getCertificatPem() != null && !user.getCertificatPem().isEmpty()) {
                try {
                    CertificateFactory cf = CertificateFactory.getInstance("X.509");
                    byte[] certBytes = extraireOctetsCertificat(user.getCertificatPem());
                    X509Certificate cert = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certBytes));

                    response.put("dateEmission", cert.getNotBefore());
                    response.put("dateExpiration", cert.getNotAfter());
                    response.put("sujet", cert.getSubjectX500Principal().getName());
                    response.put("emetteur", cert.getIssuerX500Principal().getName());
                    response.put("numeroSerie", cert.getSerialNumber().toString(16).toUpperCase());

                } catch (Exception e) {
                    System.err.println("Erreur lecture certificat pour " + email + ": " + e.getMessage());
                    // On ne bloque pas la réponse entière si seul le parsing de la carte d'identité du cert échoue
                    response.put("erreurParsingCertificat", "Impossible de décoder les détails du certificat.");
                }
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("erreur", e.getMessage()));
        }
    }

    @PostMapping("/renouveler-certificat")
    public ResponseEntity<?> renouvelerCertificat(Authentication auth) {
        try {
            String email = auth.getName();
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            String currentStatus = user.getStatusPki();
            System.out.println("Statut actuel pour renouvellement: " + currentStatus);

            if ("PENDING".equals(currentStatus)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "message", "Une demande est déjà en attente."
                ));
            }

            if ("ACTIVE".equals(currentStatus) && user.getCertificatPem() != null) {
                try {
                    CertificateFactory cf = CertificateFactory.getInstance("X.509");
                    byte[] certBytes = extraireOctetsCertificat(user.getCertificatPem());
                    X509Certificate cert = (X509Certificate) cf.generateCertificate(new ByteArrayInputStream(certBytes));
                    
                    // Vérifie si le certificat est valide à l'instant T
                    cert.checkValidity();

                    // Si aucune exception n'est levée, le certificat est encore valide
                    return ResponseEntity.badRequest().body(Map.of(
                            "message", "Votre certificat est encore valide jusqu'au " + cert.getNotAfter()
                    ));
                } catch (CertificateException e) {
                    // Attrape CertificateExpiredException et CertificateNotYetValidException
                    System.out.println("Certificat non valide ou expiré pour " + email + " - Renouvellement autorisé. Motif: " + e.getMessage());
                }
            }

            // Mise à jour du statut pour la validation administrative
            user.setStatusPki("PENDING");
            user.setCertificatPem(null);
            utilisateurRepository.save(user);

            serviceAudit.logRenouvellementCertificat(user.getId(), email, "PENDING",
                    "Demande de renouvellement de certificat (ancien statut: " + currentStatus + ")");

            System.out.println("Demande de renouvellement enregistrée avec succès pour: " + email);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Votre demande de renouvellement a été envoyée à l'administrateur."
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("erreur", e.getMessage()));
        }
    }
}