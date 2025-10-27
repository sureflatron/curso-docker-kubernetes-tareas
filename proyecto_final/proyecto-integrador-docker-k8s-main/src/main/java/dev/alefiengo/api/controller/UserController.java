package dev.alefiengo.api.controller;

import dev.alefiengo.api.model.User;
import dev.alefiengo.api.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    // GET /api/users - Listar todos los usuarios (con cache)
    @GetMapping
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    // GET /api/users/{id} - Obtener usuario por ID (con cache)
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(user -> ResponseEntity.ok(user))
                .orElse(ResponseEntity.notFound().build());
    }

    // POST /api/users - Crear nuevo usuario (invalida cache)
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody User user) {
        // Validar email único
        if (userService.existsByEmail(user.getEmail())) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Email ya existe");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
        }

        User savedUser = userService.createUser(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    // PUT /api/users/{id} - Actualizar usuario (invalida cache)
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        try {
            User updatedUser = userService.updateUser(id, userDetails);
            return ResponseEntity.ok(updatedUser);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // DELETE /api/users/{id} - Eliminar usuario (invalida cache)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            userService.deleteUser(id);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Usuario eliminado correctamente");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
