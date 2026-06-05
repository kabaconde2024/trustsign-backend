package pfe.back_end.services.authentification;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pfe.back_end.dto.ReponseAuthentification;
import pfe.back_end.dto.RequeteConnexion;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.UtilisateurRepository;
import pfe.back_end.services.configuration.ServiceConfiguration;
import pfe.back_end.services.notification.ServiceNotification;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class Connexion {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final ServiceNotification emailService;
    private final ServiceConfiguration serviceConfiguration;

    @Transactional
    public ReponseAuthentification connecter(RequeteConnexion requete) {

        Utilisateur u = utilisateurRepository.findByEmailIgnoreCase(requete.getEmail())
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));


        String statut = u.getStatutCycleVie();

        if (statut == null || !"ACTIF".equals(statut)) {
            String message;
            if ("INACTIF".equals(statut)) {
                message = "Votre compte est inactif. Veuillez contacter l'administrateur pour le réactiver.";
            } else if ("SUSPENDU".equals(statut)) {
                message = "Votre compte a été suspendu pour des raisons de sécurité. Veuillez contacter l'administrateur.";
            } else if ("SUPPRIME".equals(statut)) {
                message = "Ce compte a été supprimé. L'accès est définitivement bloqué.";
            } else {
                message = "Compte non actif. Veuillez contacter l'administrateur.";
            }
            throw new RuntimeException(message);
        }

        if (!passwordEncoder.matches(requete.getMotDePasse(), u.getMotDePasse())) {
            throw new RuntimeException("Identifiants invalides");
        }

        String code = String.format("%06d", new Random().nextInt(1000000));
        u.setCodeMfa(code);

        int dureeExpirationMinutes = serviceConfiguration.getMfaCodeExpirationMinutes();
        u.setExpirationCodeMfa(LocalDateTime.now().plusMinutes(dureeExpirationMinutes));
        utilisateurRepository.save(u);

        emailService.envoyerCodeMfa(u.getEmail(), code, dureeExpirationMinutes);

        return ReponseAuthentification.builder()
                .succes(true)
                .necessiteMfa(true)
                .email(u.getEmail())
                .build();
    }
}