package pfe.back_end.controleurs.authentification;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.configuration.ServiceJwt;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.authentification.ValidationOtp;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class VerificationOtpControleur {

    @Autowired
    private ValidationOtp validationOtpService;

    @Autowired
    private ServiceJwt jwtUtils;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @PostMapping("/verifier-otp")
    public ResponseEntity<?> verifierOtp(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String email = request.get("email");
        String code = request.get("code");

        if (validationOtpService.validerOTP(email, code)) {
            Utilisateur user = utilisateurRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

            String roleName = (user.getRole() != null) ? user.getRole().name() : "UTILISATEUR";
            String token = jwtUtils.generateToken(user.getEmail(), roleName);

            // Renvoyer le token dans le body
            Map<String, Object> reponse = new HashMap<>();
            reponse.put("accessToken", token);
            reponse.put("role", roleName);
            reponse.put("email", user.getEmail());
            reponse.put("userId", user.getId());
            reponse.put("prenom", user.getPrenom());
            reponse.put("nom", user.getNom());
            reponse.put("statut", user.getStatutCycleVie());

            return ResponseEntity.ok(reponse);
        }
        return ResponseEntity.status(401).body(Map.of("erreur", "Code MFA invalide ou expiré"));
    }
}