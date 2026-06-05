// SignatureQuota.java
package pfe.back_end.modeles.entites;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "signature_quotas", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"utilisateur_id", "date_signature"})
})
public class SignatureQuota {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "utilisateur_id", nullable = false)
    private Utilisateur utilisateur;

    @Column(name = "date_signature", nullable = false)
    private LocalDate dateSignature;

    @Column(name = "nombre_signatures", nullable = false)
    private int nombreSignatures = 0;

    public SignatureQuota() {}

    public SignatureQuota(Utilisateur utilisateur, LocalDate dateSignature) {
        this.utilisateur = utilisateur;
        this.dateSignature = dateSignature;
        this.nombreSignatures = 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Utilisateur getUtilisateur() { return utilisateur; }
    public void setUtilisateur(Utilisateur utilisateur) { this.utilisateur = utilisateur; }

    public LocalDate getDateSignature() { return dateSignature; }
    public void setDateSignature(LocalDate dateSignature) { this.dateSignature = dateSignature; }

    public int getNombreSignatures() { return nombreSignatures; }
    public void setNombreSignatures(int nombreSignatures) { this.nombreSignatures = nombreSignatures; }

    public void incrementer() {
        this.nombreSignatures++;
    }
}