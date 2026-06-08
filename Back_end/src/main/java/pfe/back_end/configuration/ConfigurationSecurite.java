package pfe.back_end.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
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

import java.util.Arrays;
import java.util.Collections;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class ConfigurationSecurite {

    private final FiltreJwt jwtFilter;

    // Injection par constructeur recommandée
    public ConfigurationSecurite(FiltreJwt jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

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
                                "/api/debug/**",
                                "/api/admin/pki/confirmer-identite"
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

                        // 3. ENDPOINTS IA PUBLICS (Attention aux endpoints sensibles passés ici)
                        .requestMatchers(
                                "/api/ia/logs/public",
                                "/api/ia/health",
                                "/api/ia/securite/verifier-integrite-rapide"
                        ).permitAll()

                        // 4. ENDPOINTS ADMIN AUDIT EXEMPTÉS
                        .requestMatchers(
                                "/api/admin/audit/ia-data",
                                "/api/admin/audit/test"
                        ).permitAll()

                        // 5. PROTECTION PAR AUTORITÉS (L'ordre compte : du plus spécifique au plus général)
                        .requestMatchers("/api/entreprise/**").hasAuthority("ADMIN_ENTREPRISE")
                        .requestMatchers("/api/super-admin/**").hasAuthority("SUPER_ADMIN")
                        .requestMatchers("/api/admin/pki/**").hasAuthority("SUPER_ADMIN")
                        .requestMatchers("/api/admin/stats/**").hasAuthority("SUPER_ADMIN")
                        .requestMatchers("/api/admin/audit/**").hasAuthority("SUPER_ADMIN")
                        .requestMatchers("/api/admin/config").hasAuthority("SUPER_ADMIN")
                        .requestMatchers("/api/admin/**").hasAuthority("SUPER_ADMIN")

                        // 6. ENDPOINTS ACCESSIBLES PAR AUTHENTIFICATION REQUSE
                        .requestMatchers(
                                "/api/signature/quota/mon-quota",
                                "/api/ia/securite/analyser-falsification",
                                "/api/ia/securite/analyser-document/**",
                                "/api/ia/analyse-document/**",
                                "/api/ia/anomalies", // 🔒 Déplacé ici pour des raisons de sécurité
                                "/api/ia/rapports",   // 🔒 Déplacé ici pour des raisons de sécurité
                                "/api/signature/quota/utilisateur/**",
                                "/api/signature/quota/reinitialiser/**",
                                "/api/signature/quota/modifier-limite/**",
                                "/api/signature/quota/statistiques",
                                "/api/documents/download/**",
                                "/api/documents/verifier-signature-pki",
                                "/api/documents/download-signe/**",
                                "/api/signature/appliquer-auto-signature",
                                "/api/documents/**",
                                "/api/utilisateur/**"
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
                "https://localhost:3000", // Unifié avec le contrôleur
                "http://localhost:8080",
                "http://localhost:8000",
                "https://frontendmemoire.onrender.com"
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