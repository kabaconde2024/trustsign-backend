package pfe.back_end.repositories.sql;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.modeles.entites.Role;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {

    Optional<Utilisateur> findByEmailIgnoreCase(String email);
    Optional<Utilisateur> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<Utilisateur> findByTokenActivation(String token);
    List<Utilisateur> findByRole(Role role);
    long countByRole(Role role);
    List<Utilisateur> findAllByStatusPki(String statusPki);
    Optional<Utilisateur> findByEmailAndStatutCycleVie(String email, String statutCycleVie);
    Optional<Utilisateur> findByConfirmationToken(String token);
    
    // ⭐ AJOUTER CES 5 MÉTHODES POUR LES STATISTIQUES
    long countByStatusPki(String statusPki);
    long count();
    
    @Modifying
    @Transactional
    @Query("UPDATE Utilisateur u SET u.confirmationToken = :token, u.confirmationExpiration = :expiration, u.demandeStatut = 'AWAITING_CONFIRMATION' WHERE u.id = :userId")
    int updateConfirmationToken(@Param("userId") Long userId, @Param("token") String token, @Param("expiration") LocalDateTime expiration);
}