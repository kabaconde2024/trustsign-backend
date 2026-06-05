package pfe.back_end.dto;

public class RequeteChangementMdp {
    private String ancienMdp;
    private String nouveauMdp;

    public RequeteChangementMdp() {}

    public RequeteChangementMdp(String ancienMdp, String nouveauMdp) {
        this.ancienMdp = ancienMdp;
        this.nouveauMdp = nouveauMdp;
    }

    public String getAncienMdp() { return ancienMdp; }
    public void setAncienMdp(String ancienMdp) { this.ancienMdp = ancienMdp; }
    
    public String getNouveauMdp() { return nouveauMdp; }
    public void setNouveauMdp(String nouveauMdp) { this.nouveauMdp = nouveauMdp; }
}