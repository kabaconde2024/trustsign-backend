package pfe.back_end.controleurs.certificat;

import org.bouncycastle.util.encoders.Base64;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.audit.ServiceAudit;
import pfe.back_end.services.ca.ServiceAutoriteCertification;
import pfe.back_end.services.ca.ServiceVerificationCertificat;
import pfe.back_end.services.hsm.ServiceGestionClesHSM;
import pfe.back_end.services.notification.ServiceNotification;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;

import java.io.ByteArrayInputStream;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/pki")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "https://frontendmemoire.onrender.com"
}, allowCredentials = "true")
public class PkiAdminController {

    private final ServiceGestionClesHSM hsmService;
    private final ServiceAutoriteCertification caService;
    private final UtilisateurRepository utilisateurRepository;
    private final ServiceVerificationCertificat serviceVerificationCertificat;

    @Autowired
    private ServiceAudit serviceAudit;

    @Autowired
    private ServiceNotification serviceNotification;

    @Value("${app.frontend.url:https://frontendmemoire.onrender.com}")
    private String frontendUrl;

    public PkiAdminController(ServiceGestionClesHSM hsmService,
                              ServiceAutoriteCertification caService,
                              UtilisateurRepository utilisateurRepository,
                              ServiceVerificationCertificat serviceVerificationCertificat) {
        this.hsmService = hsmService;
        this.caService = caService;
        this.utilisateurRepository = utilisateurRepository;
        this.serviceVerificationCertificat = serviceVerificationCertificat;
    }

    @PostConstruct
    public void init() {
        System.out.println("PkiAdminController initialisé");
    }

    @PostMapping("/demander-confirmation/{userId}")
    public ResponseEntity<?> demanderConfirmationIdentite(@PathVariable Long userId) {
        try {
            String token = UUID.randomUUID().toString();
            LocalDateTime expiration = LocalDateTime.now().plusHours(24);

            System.out.println("TOKEN: " + token);
            System.out.println("EXPIRATION: " + expiration);

            int updated = utilisateurRepository.updateConfirmationToken(userId, token, expiration);
            System.out.println("Nombre de lignes mises à jour: " + updated);

            if (updated == 0) {
                throw new RuntimeException("Échec de la mise à jour du token");
            }

            Utilisateur user = utilisateurRepository.findById(userId).get();
            System.out.println("Vérification: token en base = " + user.getConfirmationToken());

            String lienConfirmation = frontendUrl + "/confirmer-certificat?token=" + token;
            serviceNotification.envoyerLienConfirmationCertificat(
                    user.getEmail(), lienConfirmation, user.getNom(), user.getPrenom()
            );

            return ResponseEntity.ok(Map.of("status", "success", "message", "Email envoyé"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/confirmer-identite")
    public ResponseEntity<?> confirmerIdentite(@RequestParam String token, HttpServletRequest request) {
        try {
            Utilisateur user = utilisateurRepository.findByConfirmationToken(token)
                    .orElseThrow(() -> new RuntimeException("Token invalide"));

            if (user.getConfirmationExpiration() == null || user.getConfirmationExpiration().isBefore(LocalDateTime.now())) {
                user.setDemandeStatut("PENDING");
                user.setConfirmationToken(null);
                utilisateurRepository.save(user);
                return ResponseEntity.status(401).body(Map.of(
                        "error", "Lien expiré",
                        "message", "Ce lien n'est plus valable. Veuillez demander un nouveau lien."
                ));
            }

            user.setConfirme(true);
            user.setDemandeStatut("READY");
            user.setConfirmationToken(null);
            utilisateurRepository.save(user);

            String ipAddress = request.getRemoteAddr();
            System.out.println("Identité confirmée pour: " + user.getEmail() + " depuis IP: " + ipAddress);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Votre identité a été confirmée avec succès !",
                    "redirectUrl", "/dashboard"
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/verifier-confirmation/{userId}")
    public ResponseEntity<?> verifierConfirmation(@PathVariable Long userId) {
        try {
            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            return ResponseEntity.ok(Map.of(
                    "confirme", user.isConfirme(),
                    "demandeStatut", user.getDemandeStatut(),
                    "email", user.getEmail()
            ));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/approve/{userId}")
    public ResponseEntity<?> approuverEtGenererCertificat(@PathVariable Long userId) {
        try {
            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            if (!user.isConfirme()) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Identité non confirmée",
                        "message", "L'utilisateur doit d'abord confirmer son identité par email.",
                        "action", "Utilisez l'endpoint /demander-confirmation/" + userId + " pour envoyer le lien"
                ));
            }

            if (!"READY".equals(user.getDemandeStatut())) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Demande non prête",
                        "message", "Statut actuel: " + user.getDemandeStatut(),
                        "expected", "READY"
                ));
            }

            System.out.println("Génération certificat pour: " + user.getEmail());

            String alias = user.getEmail();

            hsmService.genererIdentiteSecurisee(alias);
            String csrPem = hsmService.creerDemandeCertification(alias, user);
            String certificatPem = caService.signerDemandeUtilisateur(csrPem);
            hsmService.stockerCertificatFinal(alias, certificatPem);

            user.setCertificatPem(certificatPem);
            user.setStatusPki("ACTIVE");
            user.setHsmAlias(alias);
            user.setDemandeStatut("APPROVED");
            utilisateurRepository.save(user);

            System.out.println("Certificat généré avec succès pour: " + user.getEmail());
            serviceAudit.logApprobationCertificat(
                    user.getId(),
                    user.getEmail(),
                    alias,
                    "SUCCESS",
                    "Certificat généré après confirmation d'identité"
            );

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Certificat généré avec succès",
                    "identiteVerifiee", true
            ));

        } catch (Exception e) {
            e.printStackTrace();
            serviceAudit.logApprobationCertificat(userId, null, null, "FAILED", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Erreur PKI : " + e.getMessage()));
        }
    }

    @PostMapping("/refuser/{userId}")
    public ResponseEntity<?> refuserDemande(@PathVariable Long userId) {
        try {
            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            user.setDemandeStatut("REJECTED");
            user.setConfirmationToken(null);
            user.setConfirme(false);
            utilisateurRepository.save(user);

            System.out.println(" Demande refusée pour: " + user.getEmail());

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Demande refusée"
            ));

        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/requests")
    public ResponseEntity<List<Utilisateur>> getPendingRequests() {
        List<Utilisateur> demandes = utilisateurRepository.findAllByStatusPki("PENDING");
        return ResponseEntity.ok(demandes);
    }

    @GetMapping("/demandes-en-attente")
    public ResponseEntity<List<Map<String, Object>>> listerDemandesEnAttente() {
        List<Utilisateur> utilisateurs = utilisateurRepository.findAllByStatusPki("PENDING");

        List<Map<String, Object>> reponse = utilisateurs.stream().map(user -> {
            Map<String, Object> item = new HashMap<>();
            item.put("id", user.getId());
            item.put("nom", user.getNom());
            item.put("prenom", user.getPrenom());
            item.put("email", user.getEmail());
            item.put("statusPki", user.getStatusPki());
            item.put("demandeStatut", user.getDemandeStatut());
            item.put("confirme", user.isConfirme());
            item.put("telephone", user.getTelephone());
            item.put("role", user.getRole());
            return item;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(reponse);
    }

    @GetMapping("/certificats-actifs")
    public ResponseEntity<List<Map<String, Object>>> listerCertificatsActifs() {
        List<Utilisateur> utilisateursActifs = utilisateurRepository.findAllByStatusPki("ACTIVE");

        List<Map<String, Object>> reponse = utilisateursActifs.stream()
                .filter(user -> user.getCertificatPem() != null)
                .map(user -> {
                    Map<String, Object> infos = new HashMap<>();
                    infos.put("id", user.getId());
                    infos.put("nomComplet", user.getNom() + " " + user.getPrenom());
                    infos.put("email", user.getEmail());
                    infos.put("aliasHsm", user.getHsmAlias());
                    infos.put("certificatPem", user.getCertificatPem());

                    try {
                        CertificateFactory fact = CertificateFactory.getInstance("X.509");
                        X509Certificate cer = (X509Certificate) fact.generateCertificate(
                                new ByteArrayInputStream(user.getCertificatPem().getBytes())
                        );

                        infos.put("dateEmission", cer.getNotBefore());
                        infos.put("dateExpiration", cer.getNotAfter());
                        infos.put("numeroSerie", cer.getSerialNumber().toString(16).toUpperCase());
                        infos.put("algorithme", cer.getSigAlgName());

                        String clePubliqueBase64 = Base64.toBase64String(cer.getPublicKey().getEncoded());
                        infos.put("clePublique", clePubliqueBase64);
                        infos.put("sujet", cer.getSubjectX500Principal().getName());

                    } catch (Exception e) {
                        infos.put("erreur", "Impossible de lire les détails du certificat: " + e.getMessage());
                    }

                    return infos;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(reponse);
    }

    @GetMapping("/certificats")
    public ResponseEntity<List<Map<String, Object>>> listerTousCertificats() {
        List<Utilisateur> utilisateurs = utilisateurRepository.findAll();
        
        List<Map<String, Object>> reponse = utilisateurs.stream()
                .filter(user -> user.getCertificatPem() != null || "PENDING".equals(user.getStatusPki()))
                .map(user -> {
                    Map<String, Object> infos = new HashMap<>();
                    infos.put("id", user.getId());
                    infos.put("commonName", user.getNom() + " " + user.getPrenom());
                    infos.put("user", user.getPrenom() + " " + user.getNom());
                    infos.put("email", user.getEmail());
                    infos.put("status", user.getStatusPki());
                    infos.put("dateCreation", user.getDateCreation());
                    infos.put("certificatPem", user.getCertificatPem());
                    
                    if (user.getCertificatPem() != null && !"PENDING".equals(user.getStatusPki())) {
                        try {
                            CertificateFactory fact = CertificateFactory.getInstance("X.509");
                            X509Certificate cer = (X509Certificate) fact.generateCertificate(
                                    new ByteArrayInputStream(user.getCertificatPem().getBytes())
                            );
                            infos.put("dateEmission", cer.getNotBefore());
                            infos.put("dateExpiration", cer.getNotAfter());
                        } catch (Exception e) {
                            // Ignorer
                        }
                    }
                    return infos;
                })
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(reponse);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long total = utilisateurRepository.count();
        long active = utilisateurRepository.countByStatusPki("ACTIVE");
        long pending = utilisateurRepository.countByStatusPki("PENDING");
        long expired = utilisateurRepository.countByStatusPki("EXPIRED");
        long revoked = utilisateurRepository.countByStatusPki("REVOKED");
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("active", active);
        stats.put("pending", pending);
        stats.put("expired", expired);
        stats.put("revoked", revoked);
        
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/nettoyer-certificats-expires")
    public ResponseEntity<?> nettoyerCertificatsExpires() {
        List<Utilisateur> utilisateursActifs = utilisateurRepository.findAllByStatusPki("ACTIVE");
        int compteurExpires = 0;

        for (Utilisateur user : utilisateursActifs) {
            if (user.getCertificatPem() == null) continue;
            try {
                CertificateFactory fact = CertificateFactory.getInstance("X.509");
                X509Certificate cer = (X509Certificate) fact.generateCertificate(
                        new ByteArrayInputStream(user.getCertificatPem().getBytes())
                );
                cer.checkValidity();
            } catch (CertificateExpiredException e) {
                user.setStatusPki("EXPIRED");
                utilisateurRepository.save(user);
                compteurExpires++;
                System.out.println("Certificat expiré pour: " + user.getEmail());
            } catch (Exception e) {
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Nettoyage terminé",
                "certificatsExpires", compteurExpires
        ));
    }
}