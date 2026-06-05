package pfe.back_end.repositories.sql;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pfe.back_end.modeles.entites.SignatureQuota;
import pfe.back_end.modeles.entites.Utilisateur;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface SignatureQuotaRepository extends JpaRepository<SignatureQuota, Long> {

    Optional<SignatureQuota> findByUtilisateurAndDateSignature(Utilisateur utilisateur, LocalDate date);

    @Modifying
    @Query("DELETE FROM SignatureQuota q WHERE q.dateSignature < :date")
    void deleteOldQuotas(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(q.nombreSignatures), 0) FROM SignatureQuota q WHERE q.utilisateur = :user AND q.dateSignature BETWEEN :debut AND :fin")
    Integer getTotalSignaturesBetweenDates(@Param("user") Utilisateur user,
                                           @Param("debut") LocalDate debut,
                                           @Param("fin") LocalDate fin);

    @Modifying
    @Query("DELETE FROM SignatureQuota q WHERE q.utilisateur = :utilisateur")
    void deleteByUtilisateur(@Param("utilisateur") Utilisateur utilisateur);

    @Query("SELECT COALESCE(SUM(q.nombreSignatures), 0) FROM SignatureQuota q WHERE q.dateSignature = :date")
    int getTotalSignaturesForDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(q.nombreSignatures), 0) FROM SignatureQuota q WHERE q.dateSignature BETWEEN :debut AND :fin")
    int getTotalSignaturesBetweenDates(@Param("debut") LocalDate debut, @Param("fin") LocalDate fin);

    @Query("SELECT COUNT(DISTINCT q.utilisateur) FROM SignatureQuota q WHERE q.dateSignature BETWEEN :debut AND :fin")
    int countDistinctUtilisateursBetweenDates(@Param("debut") LocalDate debut, @Param("fin") LocalDate fin);
}