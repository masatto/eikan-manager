package com.eikan.manager.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
public class UserSettings {

    @Id
    private String userId;

    @Column(columnDefinition = "TEXT")
    private String weightSettings;

    @Column(columnDefinition = "TEXT")
    private String roleSettings;
}
