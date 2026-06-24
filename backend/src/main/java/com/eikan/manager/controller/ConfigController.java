package com.eikan.manager.controller;

import com.eikan.manager.entity.UserSettings;
import com.eikan.manager.repository.UserSettingsRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
public class ConfigController {

    private final UserSettingsRepository userSettingsRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<String> getConfig() throws Exception {
        ClassPathResource resource = new ClassPathResource("config.json");
        String json = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.ok().header("Content-Type", "application/json").body(json);
    }

    @GetMapping("/weights")
    public ResponseEntity<String> getWeights(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return ResponseEntity.ok("{}");
        String uid = user.getAttribute("sub");
        return userSettingsRepository.findById(uid)
                .map(s -> ResponseEntity.ok(s.getWeightSettings() != null ? s.getWeightSettings() : "{}"))
                .orElse(ResponseEntity.ok("{}"));
    }

    @PutMapping("/weights")
    public ResponseEntity<Void> saveWeights(@AuthenticationPrincipal OAuth2User user,
                                            @RequestBody Map<String, Object> body) throws Exception {
        if (user == null) return ResponseEntity.noContent().build();
        String uid = user.getAttribute("sub");
        UserSettings settings = userSettingsRepository.findById(uid).orElse(new UserSettings());
        settings.setUserId(uid);
        settings.setWeightSettings(objectMapper.writeValueAsString(body));
        userSettingsRepository.save(settings);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/roles")
    public ResponseEntity<Void> saveRoles(@AuthenticationPrincipal OAuth2User user,
                                          @RequestBody Map<String, Object> body) throws Exception {
        if (user == null) return ResponseEntity.noContent().build();
        String uid = user.getAttribute("sub");
        UserSettings settings = userSettingsRepository.findById(uid).orElse(new UserSettings());
        settings.setUserId(uid);
        settings.setRoleSettings(objectMapper.writeValueAsString(body));
        userSettingsRepository.save(settings);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/roles")
    public ResponseEntity<String> getRoles(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return ResponseEntity.ok("{}");
        String uid = user.getAttribute("sub");
        return userSettingsRepository.findById(uid)
                .map(s -> ResponseEntity.ok(s.getRoleSettings() != null ? s.getRoleSettings() : "{}"))
                .orElse(ResponseEntity.ok("{}"));
    }
}
