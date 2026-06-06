package pfe.back_end.dto;

public class ReponseAuthentification {
    private String accessToken;
    private String type = "Bearer";
    private String email;
    private String role;
    private boolean succes;
    private String message;
    private boolean necessiteMfa;
    private String prenom;
    private String nom;

    // Constructeurs
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

    // GETTERS (OBLIGATOIRES)
    public String getAccessToken() { return accessToken; }
    public String getType() { return type; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public boolean isSucces() { return succes; }
    public String getMessage() { return message; }
    public boolean isNecessiteMfa() { return necessiteMfa; }
    public String getPrenom() { return prenom; }
    public String getNom() { return nom; }

    // SETTERS
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public void setType(String type) { this.type = type; }
    public void setEmail(String email) { this.email = email; }
    public void setRole(String role) { this.role = role; }
    public void setSucces(boolean succes) { this.succes = succes; }
    public void setMessage(String message) { this.message = message; }
    public void setNecessiteMfa(boolean necessiteMfa) { this.necessiteMfa = necessiteMfa; }
    public void setPrenom(String prenom) { this.prenom = prenom; }
    public void setNom(String nom) { this.nom = nom; }

    // BUILDER
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