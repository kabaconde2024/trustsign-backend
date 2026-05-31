// modeles/entites/ResultatAnalyseFalsification.java
package pfe.back_end.modeles.entites;

import java.time.LocalDateTime;
import java.util.List;

public class ResultatAnalyseFalsification {
    private Long idDocument;
    private String nomFichier;
    private LocalDateTime dateAnalyse;
    private String hashActuel;
    private String hashOriginal;
    private boolean hashCorrespond;
    private String createur;
    private String producteur;
    private String versionPdf;
    private int nombrePages;
    private int elementsSuspects;
    private List<String> pagesSuspectes;
    private boolean aSignaturesExistantes;
    private int nombreSignaturesExistantes;
    private int scoreIntegrite;
    private String niveauConfiance;
    private String messageConfiance;
    private List<AnomalieFalsification> anomalies;
    private List<String> recommandations;

    // modeles/entites/ResultatAnalyseFalsification.java
// Ajoutez ces champs avec les autres

    private int nombrePolices;
    private boolean aTexteCache;
    private boolean aDatesIncoherentes;
    private String logicielDetection;

    public int getNombrePolices() { return nombrePolices; }
    public void setNombrePolices(int nombrePolices) { this.nombrePolices = nombrePolices; }

    public boolean isATexteCache() { return aTexteCache; }
    public void setATexteCache(boolean aTexteCache) { this.aTexteCache = aTexteCache; }

    public boolean isADatesIncoherentes() { return aDatesIncoherentes; }
    public void setADatesIncoherentes(boolean aDatesIncoherentes) { this.aDatesIncoherentes = aDatesIncoherentes; }

    public String getLogicielDetection() { return logicielDetection; }
    public void setLogicielDetection(String logicielDetection) { this.logicielDetection = logicielDetection; }
    // Constructeur par défaut
    public ResultatAnalyseFalsification() {
        this.scoreIntegrite = 100;
        this.dateAnalyse = LocalDateTime.now();
    }

    public Long getIdDocument() { return idDocument; }
    public void setIdDocument(Long idDocument) { this.idDocument = idDocument; }

    public String getNomFichier() { return nomFichier; }
    public void setNomFichier(String nomFichier) { this.nomFichier = nomFichier; }

    public LocalDateTime getDateAnalyse() { return dateAnalyse; }
    public void setDateAnalyse(LocalDateTime dateAnalyse) { this.dateAnalyse = dateAnalyse; }

    public String getHashActuel() { return hashActuel; }
    public void setHashActuel(String hashActuel) { this.hashActuel = hashActuel; }

    public String getHashOriginal() { return hashOriginal; }
    public void setHashOriginal(String hashOriginal) { this.hashOriginal = hashOriginal; }

    public boolean isHashCorrespond() { return hashCorrespond; }
    public void setHashCorrespond(boolean hashCorrespond) { this.hashCorrespond = hashCorrespond; }

    public String getCreateur() { return createur; }
    public void setCreateur(String createur) { this.createur = createur; }

    public String getProducteur() { return producteur; }
    public void setProducteur(String producteur) { this.producteur = producteur; }

    public String getVersionPdf() { return versionPdf; }
    public void setVersionPdf(String versionPdf) { this.versionPdf = versionPdf; }

    public int getNombrePages() { return nombrePages; }
    public void setNombrePages(int nombrePages) { this.nombrePages = nombrePages; }

    public int getElementsSuspects() { return elementsSuspects; }
    public void setElementsSuspects(int elementsSuspects) { this.elementsSuspects = elementsSuspects; }

    public List<String> getPagesSuspectes() { return pagesSuspectes; }
    public void setPagesSuspectes(List<String> pagesSuspectes) { this.pagesSuspectes = pagesSuspectes; }

    public boolean isASignaturesExistantes() { return aSignaturesExistantes; }
    public void setASignaturesExistantes(boolean aSignaturesExistantes) { this.aSignaturesExistantes = aSignaturesExistantes; }

    public int getNombreSignaturesExistantes() { return nombreSignaturesExistantes; }
    public void setNombreSignaturesExistantes(int nombreSignaturesExistantes) { this.nombreSignaturesExistantes = nombreSignaturesExistantes; }

    public int getScoreIntegrite() { return scoreIntegrite; }
    public void setScoreIntegrite(int scoreIntegrite) { this.scoreIntegrite = scoreIntegrite; }

    public String getNiveauConfiance() { return niveauConfiance; }
    public void setNiveauConfiance(String niveauConfiance) { this.niveauConfiance = niveauConfiance; }

    public String getMessageConfiance() { return messageConfiance; }
    public void setMessageConfiance(String messageConfiance) { this.messageConfiance = messageConfiance; }

    public List<AnomalieFalsification> getAnomalies() { return anomalies; }
    public void setAnomalies(List<AnomalieFalsification> anomalies) { this.anomalies = anomalies; }

    public List<String> getRecommandations() { return recommandations; }
    public void setRecommandations(List<String> recommandations) { this.recommandations = recommandations; }
}