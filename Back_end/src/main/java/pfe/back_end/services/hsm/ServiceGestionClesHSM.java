package pfe.back_end.services.hsm;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.pkcs.jcajce.JcaPKCS10CertificationRequestBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import pfe.back_end.modeles.entites.Utilisateur;

import java.io.File;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.math.BigInteger;
import java.security.*;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.Date;

@Service
public class ServiceGestionClesHSM {

    @Value("${hsm.pin.utilisateur:1234}")
    private String pinUtilisateur;

    private Provider fournisseurPKCS11;
    private static boolean hsmInitialized = false;

    public Provider getFournisseurPKCS11() {
        return initialiserFournisseur();
    }

    private Provider initialiserFournisseur() {
        if (fournisseurPKCS11 == null || !hsmInitialized) {
            try {
                String configContent;
                String os = System.getProperty("os.name").toLowerCase();
                
                if (os.contains("win")) {
                    configContent = "name = SoftHSM2\nlibrary = C:/SoftHSM2/lib/softhsm2-x64.dll\nslot = 0\n";
                } else {
                    // Configuration pour Render/Linux
                    configContent = "name = SoftHSM2\nlibrary = /usr/lib/x86_64-linux-gnu/softhsm/libsofthsm2.so\nslot = 0\n";
                }
                
                File tempConfig = File.createTempFile("pkcs11", ".cfg");
                Files.writeString(tempConfig.toPath(), configContent);
                tempConfig.deleteOnExit();
                
                // Nettoyer l'ancien provider si existant
                Provider oldProvider = Security.getProvider("SunPKCS11-SoftHSM2");
                if (oldProvider != null) {
                    Security.removeProvider("SunPKCS11-SoftHSM2");
                }
                
                Provider p = Security.getProvider("SunPKCS11");
                fournisseurPKCS11 = p.configure(tempConfig.getAbsolutePath());
                Security.addProvider(fournisseurPKCS11);
                
                // Tester la connexion au HSM
                testHSMConnection();
                
                hsmInitialized = true;
                System.out.println("✅ HSM initialisé avec succès");
                
            } catch (Exception e) {
                System.err.println("❌ Erreur initialisation HSM: " + e.getMessage());
                e.printStackTrace();
                throw new RuntimeException("Erreur PKCS11 : " + e.getMessage(), e);
            }
        }
        return fournisseurPKCS11;
    }
    
    private void testHSMConnection() {
        try {
            KeyStore ks = KeyStore.getInstance("PKCS11", fournisseurPKCS11);
            ks.load(null, pinUtilisateur.toCharArray());
            System.out.println("✅ Connexion HSM réussie, slots disponibles");
        } catch (Exception e) {
            System.err.println("⚠️ Test connexion HSM échoué: " + e.getMessage());
        }
    }

    public void genererIdentiteSecurisee(String aliasUtilisateur) throws Exception {
        // Vérifier d'abord si l'identité existe déjà
        KeyStore ks = getKeyStore();
        if (ks.containsAlias(aliasUtilisateur)) {
            System.out.println("ℹ️ L'identité existe déjà pour: " + aliasUtilisateur);
            return;
        }
        
        try {
            System.out.println("🔐 Génération clé RSA 2048 bits pour: " + aliasUtilisateur);
            
            // Génération de la paire de clés RSA 2048 directement DANS le HSM
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA", initialiserFournisseur());
            gen.initialize(2048, new SecureRandom());
            KeyPair paireCles = gen.generateKeyPair();
            
            System.out.println("✅ Paire de clés RSA générée");
            
            // Création d'un certificat auto-signé temporaire
            X509Certificate certTemporaire = genererCertificatTemporaire(paireCles, aliasUtilisateur);
            
            // Stockage de la clé et du certificat dans le HSM
            ks.setKeyEntry(aliasUtilisateur, paireCles.getPrivate(), null, new Certificate[]{certTemporaire});
            System.out.println("✅ Paire de clés et certificat temporaire stockés dans le HSM");
            
        } catch (Exception e) {
            System.err.println("❌ Erreur génération HSM: " + e.getMessage());
            throw new Exception("Erreur HSM: " + e.getMessage(), e);
        }
    }

    private X509Certificate genererCertificatTemporaire(KeyPair kp, String alias) throws Exception {
        long now = System.currentTimeMillis();
        X500Name dnName = new X500Name("CN=TEMP_" + alias);

        org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder certBuilder =
                new org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder(
                        dnName,
                        new BigInteger(Long.toString(now)),
                        new Date(now),
                        new Date(now + 31536000000L), // 1 an
                        dnName,
                        kp.getPublic());

        ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
                        .setProvider(initialiserFournisseur())
                        .build(kp.getPrivate());

        return new org.bouncycastle.cert.jcajce.JcaX509CertificateConverter()
                        .setProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider())
                        .getCertificate(certBuilder.build(signer));
    }

    public String creerDemandeCertification(String aliasUtilisateur, Utilisateur utilisateur) throws Exception {
        KeyStore ks = getKeyStore();
        PrivateKey clePrivee = (PrivateKey) ks.getKey(aliasUtilisateur, null);
        PublicKey clePublique = ks.getCertificate(aliasUtilisateur).getPublicKey();

        X500Name subject = new X500Name("CN=" + utilisateur.getPrenom() + " " + utilisateur.getNom() +
                ", E=" + utilisateur.getEmail() + ", O=TrustSign, C=TN");

        JcaPKCS10CertificationRequestBuilder builder = new JcaPKCS10CertificationRequestBuilder(subject, clePublique);

        ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
                .setProvider(initialiserFournisseur())
                .build(clePrivee);

        return "-----BEGIN CERTIFICATE REQUEST-----\n" +
                Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(builder.build(signer).getEncoded()) +
                "\n-----END CERTIFICATE REQUEST-----";
    }

  public void stockerCertificatFinal(String aliasUtilisateur, String certificatSignePem) throws Exception {
    KeyStore ks = getKeyStore();
    
    if (certificatSignePem == null || certificatSignePem.isEmpty()) {
        throw new IllegalArgumentException("Le certificat Pem fourni est vide ou nul");
    }
    
    // 1. Nettoyage robuste : Enlève les en-têtes/pieds de page et TOUT ce qui n'est pas un caractère Base64 valide
    String cleanPem = certificatSignePem
            .replace("-----BEGIN CERTIFICATE-----", "")
            .replace("-----END CERTIFICATE-----", "")
            .replaceAll("[^a-zA-Z0-9+/=]", ""); // Garde uniquement les caractères strictement Base64

    // 2. Gestion automatique du padding '=' manquant (sécurité contre le "not enough valid bits")
    int missingPadding = cleanPem.length() % 4;
    if (missingPadding > 0) {
        cleanPem += "====".substring(missingPadding);
    }

    CertificateFactory cf = CertificateFactory.getInstance("X.509");
    
    // 3. Utilisation de getMimeDecoder() qui est beaucoup plus tolérant avec les structures de blocs
    byte[] decodedBytes = Base64.getMimeDecoder().decode(cleanPem);
    
    X509Certificate cert = (X509Certificate) cf.generateCertificate(
            new ByteArrayInputStream(decodedBytes));

    PrivateKey pk = (PrivateKey) ks.getKey(aliasUtilisateur, null);
    if (pk == null) {
        throw new KeyStoreException("Impossible de trouver la clé privée associée à l'alias : " + aliasUtilisateur);
    }
    
    ks.setKeyEntry(aliasUtilisateur, pk, null, new Certificate[]{cert});
    System.out.println("✅ Certificat final stocké avec succès dans le HSM");
}

    public PrivateKey recupererClePrivee(String alias) throws Exception {
        return (PrivateKey) getKeyStore().getKey(alias, null);
    }

    public X509Certificate recupererCertificat(String alias) throws Exception {
        Certificate cert = getKeyStore().getCertificate(alias);
        return (cert instanceof X509Certificate) ? (X509Certificate) cert : null;
    }

    private KeyStore getKeyStore() throws Exception {
        Provider p = initialiserFournisseur();
        KeyStore ks = KeyStore.getInstance("PKCS11", p);
        ks.load(null, pinUtilisateur.toCharArray());
        return ks;
    }

    public void verifierOuCreerIdentite(String aliasUtilisateur, Utilisateur utilisateur) {
        try {
            System.out.println("🔍 Vérification identité HSM pour: " + aliasUtilisateur);

            KeyStore ks = getKeyStore();

            if (!ks.containsAlias(aliasUtilisateur)) {
                System.out.println("   - Alias non trouvé, création d'une nouvelle identité...");
                genererIdentiteSecurisee(aliasUtilisateur);

                utilisateur.setStatusPki("ACTIVE");
                utilisateur.setHsmAlias(aliasUtilisateur);

                System.out.println("✅ Identité HSM créée avec succès pour: " + aliasUtilisateur);
            } else {
                System.out.println("ℹ️ Identité HSM existante trouvée pour: " + aliasUtilisateur);

                if (!"ACTIVE".equals(utilisateur.getStatusPki())) {
                    utilisateur.setStatusPki("ACTIVE");
                    System.out.println("Statut PKI mis à jour: ACTIVE");
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Erreur HSM: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Erreur HSM: " + e.getMessage(), e);
        }
    }
}