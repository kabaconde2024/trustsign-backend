package pfe.back_end.services.signature;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pfe.back_end.modeles.entites.SignatureQuota;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.SignatureQuotaRepository;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Service
public class ServiceLimitationSignature {

    @Autowired
    private SignatureQuotaRepository quotaRepository;

    @Value("${app.signature.limite-quotidienne:20}")
    private int limiteQuotidienne;

    @Value("${app.signature.limite-hebdomadaire:100}")
    private int limiteHebdomadaire;

    @Value("${app.signature.limite-mensuelle:300}")
    private int limiteMensuelle;

    // Map pour stocker les limites personnalisées par utilisateur
    private final Map<Long, Integer> limitesPersonnalisees = new HashMap<>();

    /**
     * Vérifie si l'utilisateur peut encore signer aujourd'hui
     */
    public boolean peutSigner(Utilisateur utilisateur) {
        int signaturesAujourdhui = getNombreSignaturesAujourdhui(utilisateur);
        int limite = getLimiteUtilisateur(utilisateur);

        if (signaturesAujourdhui >= limite) {
            return false;
        }

        int signaturesCetteSemaine = getNombreSignaturesCetteSemaine(utilisateur);
        if (signaturesCetteSemaine >= limiteHebdomadaire) {
            return false;
        }

        int signaturesCeMois = getNombreSignaturesCeMois(utilisateur);
        if (signaturesCeMois >= limiteMensuelle) {
            return false;
        }

        return true;
    }

    public int getLimiteUtilisateur(Utilisateur utilisateur) {
        return limitesPersonnalisees.getOrDefault(utilisateur.getId(), limiteQuotidienne);
    }

    public int getNombreSignaturesAujourdhui(Utilisateur utilisateur) {
        LocalDate aujourdhui = LocalDate.now();
        return quotaRepository.findByUtilisateurAndDateSignature(utilisateur, aujourdhui)
                .map(SignatureQuota::getNombreSignatures)
                .orElse(0);
    }

    public int getNombreSignaturesCetteSemaine(Utilisateur utilisateur) {
        LocalDate debutSemaine = LocalDate.now().minusDays(LocalDate.now().getDayOfWeek().getValue() - 1);
        LocalDate finSemaine = debutSemaine.plusDays(6);
        Integer total = quotaRepository.getTotalSignaturesBetweenDates(utilisateur, debutSemaine, finSemaine);
        return total != null ? total : 0;
    }

    public int getNombreSignaturesCeMois(Utilisateur utilisateur) {
        LocalDate debutMois = LocalDate.now().withDayOfMonth(1);
        LocalDate finMois = debutMois.plusMonths(1).minusDays(1);
        Integer total = quotaRepository.getTotalSignaturesBetweenDates(utilisateur, debutMois, finMois);
        return total != null ? total : 0;
    }

    @Transactional
    public void enregistrerSignature(Utilisateur utilisateur) {
        LocalDate aujourdhui = LocalDate.now();
        SignatureQuota quota = quotaRepository.findByUtilisateurAndDateSignature(utilisateur, aujourdhui)
                .orElse(new SignatureQuota(utilisateur, aujourdhui));

        quota.incrementer();
        quotaRepository.save(quota);
        nettoyerAnciensQuotas();
    }

    @Transactional
    public void nettoyerAnciensQuotas() {
        LocalDate dateLimite = LocalDate.now().minusDays(30);
        quotaRepository.deleteOldQuotas(dateLimite);
    }

    public QuotaInfo getQuotaInfo(Utilisateur utilisateur) {
        QuotaInfo info = new QuotaInfo();
        info.signaturesAujourdhui = getNombreSignaturesAujourdhui(utilisateur);
        info.limiteQuotidienne = getLimiteUtilisateur(utilisateur);
        info.signaturesCetteSemaine = getNombreSignaturesCetteSemaine(utilisateur);
        info.limiteHebdomadaire = limiteHebdomadaire;
        info.signaturesCeMois = getNombreSignaturesCeMois(utilisateur);
        info.limiteMensuelle = limiteMensuelle;
        info.resteAujourdhui = Math.max(0, info.limiteQuotidienne - info.signaturesAujourdhui);
        return info;
    }

    @Transactional
    public void reinitialiserQuota(Utilisateur utilisateur) {
        quotaRepository.deleteByUtilisateur(utilisateur);
        limitesPersonnalisees.remove(utilisateur.getId());
    }

    public void modifierLimiteUtilisateur(Utilisateur utilisateur, int nouvelleLimite) {
        if (nouvelleLimite < 1) {
            throw new IllegalArgumentException("La limite doit être au minimum 1");
        }
        limitesPersonnalisees.put(utilisateur.getId(), nouvelleLimite);
    }
    // Dans ServiceLimitationSignature.java - Corriger getStatistiquesGlobales
    public Map<String, Object> getStatistiquesGlobales() {
        Map<String, Object> stats = new HashMap<>();

        LocalDate aujourdhui = LocalDate.now();
        LocalDate debutSemaine = LocalDate.now().minusDays(LocalDate.now().getDayOfWeek().getValue() - 1);
        LocalDate debutMois = LocalDate.now().withDayOfMonth(1);

        try {
            int totalAujourdhui = quotaRepository.getTotalSignaturesForDate(aujourdhui);
            int totalSemaine = quotaRepository.getTotalSignaturesBetweenDates(debutSemaine, aujourdhui);
            int totalMois = quotaRepository.getTotalSignaturesBetweenDates(debutMois, aujourdhui);
            int utilisateursActifs = quotaRepository.countDistinctUtilisateursBetweenDates(debutMois, aujourdhui);

            stats.put("totalSignaturesAujourdhui", totalAujourdhui);
            stats.put("totalSignaturesCetteSemaine", totalSemaine);
            stats.put("totalSignaturesCeMois", totalMois);
            stats.put("utilisateursActifsCeMois", utilisateursActifs);
            stats.put("date", aujourdhui.toString());
        } catch (Exception e) {
            // En cas d'erreur, retourner des valeurs par défaut
            stats.put("totalSignaturesAujourdhui", 0);
            stats.put("totalSignaturesCetteSemaine", 0);
            stats.put("totalSignaturesCeMois", 0);
            stats.put("utilisateursActifsCeMois", 0);
            stats.put("date", aujourdhui.toString());
            stats.put("error", e.getMessage());
        }

        return stats;
    }

    public static class QuotaInfo {
        public int signaturesAujourdhui;
        public int limiteQuotidienne;
        public int resteAujourdhui;
        public int signaturesCetteSemaine;
        public int limiteHebdomadaire;
        public int signaturesCeMois;
        public int limiteMensuelle;
    }


}