package com.eikan.manager.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal OAuth2User user) {
        if (user == null) return Map.of("authenticated", false);
        return Map.of(
            "authenticated", true,
            "userId", user.getAttribute("sub"),
            "name", user.getAttribute("name"),
            "email", user.getAttribute("email"),
            "picture", user.getAttribute("picture")
        );
    }
}
