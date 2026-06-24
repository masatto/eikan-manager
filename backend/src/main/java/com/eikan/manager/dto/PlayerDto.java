package com.eikan.manager.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class PlayerDto {
    private String id;
    private String name;
    private Integer grade;
    private String main;
    private List<String> subs = new ArrayList<>();
    private List<String> subsHigh = new ArrayList<>();
    private Map<String, Object> abilities = new HashMap<>();
    private Map<String, Object> pitch = new HashMap<>();
    private List<String> specialAbilities = new ArrayList<>();
    private String memo;
    private Long updatedAt;
}
