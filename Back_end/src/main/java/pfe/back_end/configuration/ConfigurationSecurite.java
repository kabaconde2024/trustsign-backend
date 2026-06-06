package pfe.back_end.configuration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import java.util.Arrays;
import java.util.Collections;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class ConfigurationSecurite {

    @Autowired
    private FiltreJwt jwtFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 1. ENDPOINTS PUBLICS
                        .requestMatchers(
                                "/",
                                "/api/auth/**",
                                "/api/connexion",
                                "/api/verifier-otp",
                                "/api/activer-compte",
                                "/api/finaliser-activation",
                                "/api/mot-de-passe-oublie",
                                "/api/reinitialiser-mot-de-passe",
                                "/api/horodatage/statut",
                                "/api/auth/check",
                                "/api/debug/**"
                        ).permitAll()


                        // 2. ENDPOINTS DE SIGNATURE PUBLICS
                        .requestMatchers(
                                "/api/signature/details/**",
                                "/api/signature/apercu/**",
                                "/api/signature/send-otp",
                                "/api/signature/valider-simple",
                                "/api/signature/pki/executer",
                                "/api/invitations/verifier/**"
                        ).permitAll()


                        // 3. ENDPOINTS IA PUBLICS
                        .requestMatchers(
                                "/api/ia/logs/public",
                                "/api/ia/health",
                                "/api/ia/anomalies",
                                "/api/ia/rapports",
                                "/api/ia/securite/verifier-integrite-rapide"
                        ).permitAll()

                        // 4. ENDPOINTS DE QUOTA
                        .requestMatchers(
                                "/api/signature/quota/mon-quota"
                        ).authenticated()


                        // 5. ENDPOINTS IA SÉCURISÉS (authentification requise)

                        .requestMatchers(
                                "/api/ia/securite/analyser-falsification",
                                "/api/ia/securite/analyser-document/**",
                                "/api/ia/analyse-document/**"
                        ).authenticated()


                        // 6. ENDPOINTS ADMIN AUDIT

                        .requestMatchers(
                                "/api/admin/audit/ia-data",
                                "/api/admin/audit/test"
                        ).permitAll()


                        // 7. ENDPOINTS ENTREPRISE

                        .requestMatchers("/api/entreprise/**").hasAuthority("ADMIN_ENTREPRISE")


                        // 8. ENDPOINTS SUPER_ADMIN (gestion des quotas)

                        .requestMatchers(
                                "/api/signature/quota/utilisateur/**",
                                "/api/signature/quota/reinitialiser/**",
                                "/api/signature/quota/modifier-limite/**",
                                "/api/signature/quota/statistiques"
                        ).authenticated()


                        // 9. ENDPOINTS SUPER ADMIN

                        .requestMatchers("/api/super-admin/**").hasAuthority("SUPER_ADMIN")


                        // 10. ENDPOINTS PROTÉGÉS (authentification requise)

                        .requestMatchers(
                                "/api/documents/download/**",
                                "/api/documents/verifier-signature-pki",
                                "/api/documents/download-signe/**",
                                "/api/signature/appliquer-auto-signature",
                                "/api/documents/**",
                                "/api/utilisateur/**",
                                "/api/signature/quota/mon-quota"
                        ).authenticated()

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(Arrays.asList(
            "http://localhost:3000",
            "http://localhost:8080",
            "http://localhost:8000",
            "https://b0f3-197-0-139-60.ngrok-free.app",
            "https://87fd-197-0-139-60.ngrok-free.app",
            "https://frontendmemoire.onrender.com"  // ← AJOUTEZ CETTE LIGNE
    ));
    configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
    configuration.setAllowedHeaders(Arrays.asList(
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Requested-With",
            "Cache-Control"
    ));
    configuration.setAllowCredentials(true);
    configuration.setExposedHeaders(Collections.singletonList("Authorization"));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
}
}