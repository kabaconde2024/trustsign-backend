package pfe.back_end.modeles.entites;

public class AnomalieFalsification {
    private String type;
    private String severite;
    private String description;
    private String details;

    public AnomalieFalsification() {}

    public AnomalieFalsification(String type, String severite, String description, String details) {
        this.type = type;
        this.severite = severite;
        this.description = description;
        this.details = details;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSeverite() { return severite; }
    public void setSeverite(String severite) { this.severite = severite; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }
}