package com.eikan.manager.entity;

import com.eikan.manager.converter.AbilitiesConverter;
import com.eikan.manager.converter.ListStringConverter;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "players")
@Data
@NoArgsConstructor
public class Player {

    @Id
    private String id;

    private String userId;

    private String name;

    private Integer grade;

    private String mainPosition;

    private Long updatedAt;

    @Column(columnDefinition = "TEXT")
    @Convert(converter = AbilitiesConverter.class)
    private Map<String, Object> abilities = new HashMap<>();

    @Column(columnDefinition = "TEXT")
    @Convert(converter = AbilitiesConverter.class)
    private Map<String, Object> pitch = new HashMap<>();

    @Column(columnDefinition = "TEXT")
    @Convert(converter = ListStringConverter.class)
    private List<String> subs = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    @Convert(converter = ListStringConverter.class)
    private List<String> subsHigh = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    @Convert(converter = ListStringConverter.class)
    private List<String> specialAbilities = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String memo;
}
