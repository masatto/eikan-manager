package com.eikan.manager.service;

import com.eikan.manager.dto.PlayerDto;
import com.eikan.manager.entity.Player;
import com.eikan.manager.repository.PlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlayerService {

    private final PlayerRepository playerRepository;

    public List<PlayerDto> getAll(String userId) {
        return playerRepository.findByUserId(userId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PlayerDto save(String userId, PlayerDto dto) {
        Player player = toEntity(dto, userId);
        if (player.getId() == null || player.getId().isBlank()) {
            player.setId(UUID.randomUUID().toString());
        }
        if (player.getUpdatedAt() == null) {
            player.setUpdatedAt(System.currentTimeMillis());
        }
        player.setUserId(userId);
        return toDto(playerRepository.save(player));
    }

    @Transactional
    public PlayerDto update(String userId, String id, PlayerDto dto) {
        Player existing = playerRepository.findById(id)
                .filter(p -> userId.equals(p.getUserId()))
                .orElseThrow(() -> new IllegalArgumentException("Player not found: " + id));
        dto.setId(existing.getId());
        Player updated = toEntity(dto, userId);
        updated.setUpdatedAt(System.currentTimeMillis());
        return toDto(playerRepository.save(updated));
    }

    @Transactional
    public void delete(String userId, String id) {
        playerRepository.findById(id)
                .filter(p -> userId.equals(p.getUserId()))
                .ifPresent(playerRepository::delete);
    }

    private PlayerDto toDto(Player p) {
        PlayerDto dto = new PlayerDto();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setGrade(p.getGrade());
        dto.setMain(p.getMainPosition());
        dto.setSubs(p.getSubs());
        dto.setSubsHigh(p.getSubsHigh());
        dto.setAbilities(p.getAbilities());
        dto.setPitch(p.getPitch());
        dto.setSpecialAbilities(p.getSpecialAbilities());
        dto.setMemo(p.getMemo());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private Player toEntity(PlayerDto dto, String userId) {
        Player p = new Player();
        p.setId(dto.getId());
        p.setUserId(userId);
        p.setName(dto.getName());
        p.setGrade(dto.getGrade());
        p.setMainPosition(dto.getMain());
        p.setSubs(dto.getSubs());
        p.setSubsHigh(dto.getSubsHigh());
        p.setAbilities(dto.getAbilities());
        p.setPitch(dto.getPitch());
        p.setSpecialAbilities(dto.getSpecialAbilities());
        p.setMemo(dto.getMemo());
        p.setUpdatedAt(dto.getUpdatedAt());
        return p;
    }
}
