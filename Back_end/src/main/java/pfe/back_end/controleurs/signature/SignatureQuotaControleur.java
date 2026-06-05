package pfe.back_end.controleurs.signature;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.signature.ServiceLimitationSignature;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/signature/quota")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "https://localhost:3000"
}, allowCredentials = "true")
public class SignatureQuotaControleur {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private ServiceLimitationSignature serviceLimitationSignature;

    @GetMapping("/mon-quota")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMonQuota(Authentication authentication) {
        try {
            Utilisateur user = utilisateurRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            ServiceLimitationSignature.QuotaInfo quota = serviceLimitationSignature.getQuotaInfo(user);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("signaturesAujourdhui", quota.signaturesAujourdhui);
            response.put("limiteQuotidienne", quota.limiteQuotidienne);
            response.put("resteAujourdhui", quota.resteAujourdhui);
            response.put("signaturesCetteSemaine", quota.signaturesCetteSemaine);
            response.put("limiteHebdomadaire", quota.limiteHebdomadaire);
            response.put("signaturesCeMois", quota.signaturesCeMois);
            response.put("limiteMensuelle", quota.limiteMensuelle);
            response.put("pourcentageAujourdhui", quota.limiteQuotidienne > 0 ?
                    Math.round((quota.signaturesAujourdhui * 100.0 / quota.limiteQuotidienne) * 100.0) / 100.0 : 0);
            response.put("peutEncoreSigner", serviceLimitationSignature.peutSigner(user));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("success", "false");
            error.put("erreur", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }


    @GetMapping("/utilisateur/{userId}")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<?> getQuotaUtilisateur(@PathVariable Long userId) {
        try {
            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            ServiceLimitationSignature.QuotaInfo quota = serviceLimitationSignature.getQuotaInfo(user);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("utilisateurId", user.getId());
            response.put("utilisateurEmail", user.getEmail());
            response.put("utilisateurNom", user.getPrenom() + " " + user.getNom());
            response.put("signaturesAujourdhui", quota.signaturesAujourdhui);
            response.put("limiteQuotidienne", quota.limiteQuotidienne);
            response.put("resteAujourdhui", quota.resteAujourdhui);
            response.put("signaturesCetteSemaine", quota.signaturesCetteSemaine);
            response.put("signaturesCeMois", quota.signaturesCeMois);
            response.put("pourcentageAujourdhui", quota.limiteQuotidienne > 0 ?
                    Math.round((quota.signaturesAujourdhui * 100.0 / quota.limiteQuotidienne) * 100.0) / 100.0 : 0);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("success", "false");
            error.put("erreur", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }


    @DeleteMapping("/reinitialiser/{userId}")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<?> reinitialiserQuota(@PathVariable Long userId) {
        try {
            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            serviceLimitationSignature.reinitialiserQuota(user);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Quota réinitialisé avec succès pour l'utilisateur " + user.getEmail());
            response.put("utilisateurId", userId);
            response.put("utilisateurEmail", user.getEmail());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("success", "false");
            error.put("erreur", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }


    @PutMapping("/modifier-limite/{userId}")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<?> modifierLimiteQuotidienne(
            @PathVariable Long userId,
            @RequestParam("limite") int nouvelleLimite) {
        try {
            if (nouvelleLimite < 1 || nouvelleLimite > 500) {
                Map<String, String> error = new HashMap<>();
                error.put("success", "false");
                error.put("erreur", "La limite doit être comprise entre 1 et 500");
                return ResponseEntity.badRequest().body(error);
            }

            Utilisateur user = utilisateurRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            serviceLimitationSignature.modifierLimiteUtilisateur(user, nouvelleLimite);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Limite modifiée avec succès");
            response.put("utilisateurId", userId);
            response.put("utilisateurEmail", user.getEmail());
            response.put("ancienneLimite", serviceLimitationSignature.getLimiteUtilisateur(user));
            response.put("nouvelleLimite", nouvelleLimite);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("success", "false");
            error.put("erreur", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }


    @GetMapping("/statistiques")
    @PreAuthorize("hasAuthority('SUPER_ADMIN')")
    public ResponseEntity<?> getStatistiquesGlobales() {
        try {
            Map<String, Object> stats = serviceLimitationSignature.getStatistiquesGlobales();
            stats.put("success", true);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("success", "false");
            error.put("erreur", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}