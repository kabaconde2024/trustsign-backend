package pfe.back_end.controleurs.authentification;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pfe.back_end.configuration.ServiceJwt;
import pfe.back_end.dto.RequeteConnexion;
import pfe.back_end.dto.ReponseAuthentification;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.audit.ServiceAudit;
import pfe.back_end.services.authentification.ActivationCompte;
import pfe.back_end.services.authentification.Connexion;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ConnexionController {

    @Autowired
    private ActivationCompte serviceInscriptionPublic;

    @Autowired
    private ServiceJwt jwtUtils;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private Connexion connexionService;

    @Autowired
    private ServiceAudit serviceAudit;

    @Autowired
    private HttpServletRequest httpServletRequest;

    /* Connexion standard par email/password */
    @PostMapping("/connexion")
    public ResponseEntity<?> connexion(@RequestBody RequeteConnexion request) {
        try {
            ReponseAuthentification reponse = connexionService.connecter(request);
            String jwt = reponse.getAccessToken(); 

            serviceAudit.logConnexion(request.getEmail(), true, "Connexion réussie", httpServletRequest);

            // Renvoyer le token dans le body (pas de cookie)
            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("accessToken", jwt);
            responseBody.put("role", reponse.getRole());
            responseBody.put("email", reponse.getEmail());
            responseBody.put("necessiteMfa", reponse.isNecessiteMfa());
            responseBody.put("prenom", reponse.getPrenom());
            responseBody.put("nom", reponse.getNom());

            return ResponseEntity.ok(responseBody);
            
        } catch (Exception e) {
            serviceAudit.logConnexion(request.getEmail(), false, e.getMessage(), httpServletRequest);
            return ResponseEntity.status(401).body(Map.of("erreur", e.getMessage()));
        }
    }

    /* Connexion via Google OAuth2 */
    @PostMapping("/auth/google")
    public ResponseEntity<?> authenticateGoogleUser(@RequestBody Map<String, String> payload, HttpServletResponse response) {
        String idTokenString = payload.get("token");
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList("320659477478-00hgntilql2f933lr33go2tie7b5em2u.apps.googleusercontent.com"))
                    .build();

            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken != null) {
                String email = idToken.getPayload().getEmail();
                Utilisateur user = utilisateurRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("Compte Google non reconnu."));

                String roleName = (user.getRole() != null) ? user.getRole().name() : "UTILISATEUR";
                String jwt = jwtUtils.generateToken(user.getEmail(), roleName);

                Map<String, Object> reponseBody = new HashMap<>();
                reponseBody.put("accessToken", jwt);
                reponseBody.put("role", roleName);
                reponseBody.put("email", user.getEmail());
                reponseBody.put("userId", user.getId());
                reponseBody.put("prenom", user.getPrenom());
                reponseBody.put("nom", user.getNom());
                reponseBody.put("statut", user.getStatutCycleVie());

                serviceAudit.logConnexion(email, true, "Connexion Google réussie", httpServletRequest);

                return ResponseEntity.ok(reponseBody);
            }
            
            serviceAudit.logConnexion(null, false, "Authentification Google invalide (Token nul)", httpServletRequest);
            return ResponseEntity.status(401).body(Map.of("erreur", "Authentification Google invalide"));
            
        } catch (Exception e) {
            serviceAudit.logConnexion(null, false, "Erreur Google: " + e.getMessage(), httpServletRequest);
            return ResponseEntity.status(401).body(Map.of("erreur", e.getMessage()));
        }
    }

    /* Déconnexion */
    @PostMapping("/deconnexion")
    public ResponseEntity<?> deconnexion() {
        return ResponseEntity.ok(Map.of("message", "Déconnecté."));
    }

    /* Vérification de la validité de la session */
    @GetMapping("/auth/check")
    public ResponseEntity<?> verifierSession(HttpServletRequest request) {
        String token = recupererJwtDepuisHeader(request);
        if (token == null || !jwtUtils.validateToken(token)) {
            return ResponseEntity.ok(Map.of("authentifie", false));
        }
        return ResponseEntity.ok(Map.of(
            "authentifie", true, 
            "role", jwtUtils.getRoleFromToken(token),
            "email", jwtUtils.getEmailFromToken(token)
        ));
    }

    private String recupererJwtDepuisHeader(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}