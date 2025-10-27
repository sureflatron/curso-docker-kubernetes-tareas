package dev.alefiengo.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@RestController
public class GreetingController {

    @GetMapping("/")
    public Map<String, Object> home() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Welcome to Spring Boot API - Proyecto Integrador");
        response.put("version", "2.0.0");
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME));
        return response;
    }

    @GetMapping("/api/greeting")
    public Map<String, Object> greeting() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Hello from Spring Boot!");
        response.put("course", "Docker & Kubernetes");
        response.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME));
        return response;
    }

    @GetMapping("/api/info")
    public ResponseEntity<Map<String, Object>> getInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("alumno", "Miguel Claure Villca");
        info.put("version", "v2.1");
        info.put("curso", "Docker & Kubernetes - i-Quattro");
        info.put("timestamp", LocalDateTime.now().toString());
        info.put("hostname", System.getenv("HOSTNAME"));
        return ResponseEntity.ok(info);
    }
}
