package pfe.back_end.controleurs.authentification;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.configuration.ServiceJwt;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
// 🌐 L'annotation @CrossOrigin a été supprimée d'ici car elle est entièrement centralisée dans ConfigurationSecurite.java
public class ProfileControleur {

    private final ServiceJwt jwtUtils;
    private final UtilisateurRepository utilisateurRepository;

    // Injection par constructeur
    public ProfileControleur(ServiceJwt jwtUtils, UtilisateurRepository utilisateurRepository) {
        this.jwtUtils = jwtUtils;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping("/utilisateur/mon-profil")
    public ResponseEntity<?> getMonProfil(HttpServletRequest request) {
        try {
            String token = recupererJwtDepuisHeader(request);
            if (token == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erreur", "Non autorisé - Token manquant"));
            }

            if (!jwtUtils.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erreur", "Token invalide ou expiré"));
            }

            String email = jwtUtils.getEmailFromToken(token);
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("email", user.getEmail());
            userData.put("prenom", user.getPrenom());
            userData.put("nom", user.getNom());
            userData.put("telephone", user.getTelephone());
            userData.put("role", user.getRole().name());
            userData.put("statut", user.getStatutCycleVie());
            userData.put("statutCompte", user.getStatutCycleVie());
            userData.put("photoProfil", user.getPhotoProfil()); 
            userData.put("imageSignature", user.getImageSignature());

            String statusPki = user.getStatusPki();
            if (statusPki == null || statusPki.isEmpty()) {
                statusPki = "NONE";
            }
            userData.put("status_pki", statusPki);
            userData.put("hsmAlias", user.getHsmAlias());

            return ResponseEntity.ok(userData);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("erreur", e.getMessage()));
        }
    }

    @PutMapping("/utilisateur/modifier-profil")
    public ResponseEntity<?> updateProfil(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        try {
            String token = recupererJwtDepuisHeader(request);
            if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erreur", "Session expirée"));

            if (!jwtUtils.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erreur", "Token invalide"));
            }

            String email = jwtUtils.getEmailFromToken(token);
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            if (payload.containsKey("prenom")) user.setPrenom(payload.get("prenom"));
            if (payload.containsKey("nom")) user.setNom(payload.get("nom"));
            if (payload.containsKey("telephone")) user.setTelephone(payload.get("telephone"));

            if (payload.containsKey("photoProfil")) {
                String photoProfil = payload.get("photoProfil");
                if (photoProfil != null && !photoProfil.isEmpty()) {
                    user.setPhotoProfil(photoProfil);
                }
            }

            utilisateurRepository.save(user);
            return ResponseEntity.ok(Map.of("message", "Profil mis à jour avec succès !"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("erreur", "Erreur lors de la mise à jour : " + e.getMessage()));
        }
    }

    @PostMapping("/utilisateur/upload-photo")
    public ResponseEntity<?> uploadPhoto(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        try {
            String token = recupererJwtDepuisHeader(request);
            if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("erreur", "Non autorisé"));

            String email = jwtUtils.getEmailFromToken(token);
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            String photoBase64 = payload.get("photo");
            if (photoBase64 == null || photoBase64.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("erreur", "Aucune photo fournie"));
            }

            user.setPhotoProfil(photoBase64);
            utilisateurRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "Photo de profil mise à jour avec succès"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("erreur", e.getMessage()));
        }
    }

    private String recupererJwtDepuisHeader(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}