package pfe.back_end.services.document;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pfe.back_end.modeles.entites.Document;
import pfe.back_end.modeles.entites.InvitationSignature;
import pfe.back_end.modeles.entites.StatutDocument;
import pfe.back_end.modeles.entites.Utilisateur;
import pfe.back_end.repositories.sql.DocumentRepository;
import pfe.back_end.repositories.sql.InvitationRepository;
import pfe.back_end.repositories.sql.UtilisateurRepository;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Service
public class ServiceGestionDocuments {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private InvitationRepository invitationRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Transactional
    public Document enregistrerDocument(MultipartFile fichier, String clientHash) throws Exception {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Utilisateur proprietaire = utilisateurRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        byte[] octets = fichier.getBytes();
        String serverHash = calculerHash(octets);


        if (clientHash != null && !clientHash.isEmpty()) {
            if (!clientHash.equals(serverHash)) {
                String errorMsg = String.format(
                        "Intégrité du fichier non vérifiée. Client: %s, Serveur: %s",
                        clientHash, serverHash
                );
                System.err.println("" + errorMsg);
                throw new RuntimeException("L'intégrité du fichier n'a pas pu être vérifiée. Le fichier a peut-être été corrompu lors du transfert.");
            }
            System.out.println("Intégrité du fichier vérifiée - Hash: " + serverHash);
        }

        else {
            System.out.println("Aucun hash client fourni - Vérification d'intégrité ignorée");
        }

        Document doc = new Document();
        doc.setNomFichier(fichier.getOriginalFilename());
        doc.setHashSha256(serverHash);
        doc.setHashDocument(serverHash);
        doc.setTaille(fichier.getSize());
        doc.setTypeMime(fichier.getContentType());
        doc.setStatut(StatutDocument.EN_ATTENTE);
        doc.setDateCreation(LocalDateTime.now());
        doc.setEstSigne(false);
        doc.setProprietaire(proprietaire);
        doc.setContenu(octets);
        doc.setCheminStockage("db://" + System.currentTimeMillis() + "_" + fichier.getOriginalFilename());

        System.out.println("DOCUMENT ENREGISTRÉ AVEC SUCCÈS:");
        System.out.println("Nom: " + fichier.getOriginalFilename());
        System.out.println("Propriétaire: " + email);
        System.out.println("Hash ORIGINAL (upload): " + serverHash);

        return documentRepository.save(doc);
    }


    @Transactional
    public Document finaliserSignatureGenerique(Long idDocument, byte[] contenuSigne, Utilisateur signataire, String token) {
        Document doc = documentRepository.findById(idDocument)
                .orElseThrow(() -> new RuntimeException("Document introuvable ID : " + idDocument));

        String hashOriginal = doc.getHashSha256();

        System.out.println(" FINALISATION SIGNATURE ");
        System.out.println("Document ID: " + idDocument);
        System.out.println("Signataire reçu: " + (signataire != null ? signataire.getEmail() + " (ID: " + signataire.getId() + ")" : "NULL"));

        doc.setContenu(contenuSigne);
        doc.setTaille((long) contenuSigne.length);
        doc.setNomFichier("SIGNE_" + doc.getNomFichier().replace("SIGNE_", ""));
        doc.setCheminStockage("db://" + System.currentTimeMillis() + "_" + doc.getNomFichier());
        doc.setEstSigne(true);
        doc.setStatut(StatutDocument.SIGNE);
        doc.setDateHorodatage(LocalDateTime.now());

        if (signataire != null && signataire.getId() != null) {
            Utilisateur managedSignataire = utilisateurRepository.findById(signataire.getId())
                    .orElseThrow(() -> new RuntimeException("Signataire non trouvé en BDD"));
            doc.setSignataire(managedSignataire);
            System.out.println(" Signataire défini: " + managedSignataire.getEmail() + " (ID: " + managedSignataire.getId() + ")");
        } else {
            System.out.println("ATTENTION: signataire est NULL ou sans ID !");
        }

        // Stocker le hash signé
        String hashSigne = calculerHash(contenuSigne);
        doc.setSignatureNumerique(hashSigne);
        System.out.println("Hash SIGNÉ: " + hashSigne);

        doc.setHashSha256(hashOriginal);
        doc.setHashDocument(hashOriginal);

        Document saved = documentRepository.saveAndFlush(doc);

        entityManager.refresh(saved);

        System.out.println("✅ VÉRIFICATION FINALE:");
        System.out.println("   - signataire_id: " + (saved.getSignataire() != null ? saved.getSignataire().getId() : "NULL"));
        System.out.println("   - signataire_email: " + (saved.getSignataire() != null ? saved.getSignataire().getEmail() : "NULL"));

        return saved;
    }

    // Ajoutez EntityManager
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public byte[] getContenu(Long id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document introuvable"));

        if (doc.getContenu() == null) {
            throw new RuntimeException("Le contenu binaire est vide en base de données.");
        }
        return doc.getContenu();
    }

    @Transactional
    public void supprimerDocument(Long id) {
        if (!documentRepository.existsById(id)) {
            throw new RuntimeException("Document introuvable");
        }
        documentRepository.deleteById(id);
    }

    private String calculerHash(byte[] donnees) {
        try {
            byte[] hashBytes = MessageDigest.getInstance("SHA-256").digest(donnees);
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Erreur SHA-256", e);
        }
    }

    @Transactional
    public String sauvegarderSurDisque(Long idDocument, byte[] contenu, String nomFichier) {
        Document doc = documentRepository.findById(idDocument)
                .orElseThrow(() -> new RuntimeException("Document introuvable ID: " + idDocument));

        doc.setContenu(contenu);
        doc.setTaille((long) contenu.length);
        String chemin = "db://" + System.currentTimeMillis() + "_" + nomFichier;
        doc.setCheminStockage(chemin);

        documentRepository.save(doc);
        return chemin;
    }

    public String calculerHashPublic(byte[] donnees) {
        return calculerHash(donnees);
    }
}