package com.eikan.manager.controller;

import com.eikan.manager.dto.PlayerDto;
import com.eikan.manager.service.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerService playerService;

    @GetMapping
    public List<PlayerDto> getAll(@AuthenticationPrincipal OAuth2User user) {
        return playerService.getAll(userId(user));
    }

    @PostMapping
    public PlayerDto create(@AuthenticationPrincipal OAuth2User user,
                            @RequestBody PlayerDto dto) {
        return playerService.save(userId(user), dto);
    }

    @PutMapping("/{id}")
    public PlayerDto update(@AuthenticationPrincipal OAuth2User user,
                            @PathVariable String id,
                            @RequestBody PlayerDto dto) {
        return playerService.update(userId(user), id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal OAuth2User user,
                                       @PathVariable String id) {
        playerService.delete(userId(user), id);
        return ResponseEntity.noContent().build();
    }

    private String userId(OAuth2User user) {
        return user.getAttribute("sub");
    }
}
