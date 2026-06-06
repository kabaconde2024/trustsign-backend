package pfe.back_end.dto;

public class ReponseAuthentification {
    private String accessToken;
    private String type = "Bearer";
    private String email;
    private String role;
    private boolean succes;
    private String message;
    private boolean necessiteMfa;
    private String prenom;  // ← AJOUTER
    private String nom;      // ← AJOUTER

    public ReponseAuthentification() {}

    public ReponseAuthentification(String accessToken, String type, String email, String role,
                                   boolean succes, String message, boolean necessiteMfa,
                                   String prenom, String nom) {
        this.accessToken = accessToken;
        this.type = type;
        this.email = email;
        this.role = role;
        this.succes = succes;
        this.message = message;
        this.necessiteMfa = necessiteMfa;
        this.prenom = prenom;
        this.nom = nom;
    }

    // Getters et Setters existants...

    public String getPrenom() { return prenom; }
    public void setPrenom(String prenom) { this.prenom = prenom; }

    public String getNom() { return nom; }
    public void setNom(String nom) { this.nom = nom; }

    public static ReponseAuthentificationBuilder builder() {
        return new ReponseAuthentificationBuilder();
    }

    public static class ReponseAuthentificationBuilder {
        private String accessToken;
        private String type = "Bearer";
        private String email;
        private String role;
        private boolean succes;
        private String message;
        private boolean necessiteMfa;
        private String prenom;
        private String nom;

        public ReponseAuthentificationBuilder accessToken(String accessToken) { this.accessToken = accessToken; return this; }
        public ReponseAuthentificationBuilder type(String type) { this.type = type; return this; }
        public ReponseAuthentificationBuilder email(String email) { this.email = email; return this; }
        public ReponseAuthentificationBuilder role(String role) { this.role = role; return this; }
        public ReponseAuthentificationBuilder succes(boolean succes) { this.succes = succes; return this; }
        public ReponseAuthentificationBuilder message(String message) { this.message = message; return this; }
        public ReponseAuthentificationBuilder necessiteMfa(boolean necessiteMfa) { this.necessiteMfa = necessiteMfa; return this; }
        public ReponseAuthentificationBuilder prenom(String prenom) { this.prenom = prenom; return this; }
        public ReponseAuthentificationBuilder nom(String nom) { this.nom = nom; return this; }

        public ReponseAuthentification build() {
            return new ReponseAuthentification(accessToken, type, email, role, succes, message, necessiteMfa, prenom, nom);
        }
    }
}