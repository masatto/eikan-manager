package com.eikan.manager.repository;

import com.eikan.manager.entity.Player;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlayerRepository extends JpaRepository<Player, String> {
    List<Player> findByUserId(String userId);
    void deleteByIdAndUserId(String id, String userId);
}
