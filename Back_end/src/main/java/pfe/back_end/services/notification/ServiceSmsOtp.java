package pfe.back_end.services.notification;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pfe.back_end.services.configuration.ServiceConfiguration;

import java.security.SecureRandom; // Plus sécurisé pour la crypto
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Service
public class ServiceSmsOtp {

    // On utilise ConcurrentHashMap pour gérer les accès simultanés
    private final Map<String, String> otpStore = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    private ServiceConfiguration serviceConfiguration;


    public String generateOtp(String identifier, int longueur) {
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < longueur; i++) {
            otp.append(secureRandom.nextInt(10));
        }
        
        String code = otp.toString();
        otpStore.put(identifier, code);
        return code;
    }




    public boolean verifyOtp(String identifier, String userCode) {
        if (identifier == null || userCode == null) return false;
        
        String validCode = otpStore.get(identifier);
        if (validCode != null && validCode.equals(userCode)) {
            otpStore.remove(identifier);
            return true;
        }
        return false;
    }
}