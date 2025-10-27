package dev.alefiengo.api.service;

import dev.alefiengo.api.model.User;
import dev.alefiengo.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    // Cachea la lista de usuarios por 60 segundos (configurado en application.properties)
    @Cacheable(value = "users", key = "'all'")
    public List<User> getAllUsers() {
        System.out.println("Cache MISS: Consultando base de datos para todos los usuarios");
        return userRepository.findAll();
    }

    // Cachea usuario individual por ID
    @Cacheable(value = "users", key = "#id")
    public Optional<User> getUserById(Long id) {
        System.out.println("Cache MISS: Consultando base de datos para usuario ID: " + id);
        return userRepository.findById(id);
    }

    // Invalida cache al crear usuario
    @CacheEvict(value = "users", key = "'all'")
    public User createUser(User user) {
        System.out.println("Cache EVICT: Invalidando cache de usuarios");
        return userRepository.save(user);
    }

    // Invalida cache al actualizar usuario
    @CacheEvict(value = "users", allEntries = true)
    public User updateUser(Long id, User userDetails) {
        System.out.println("Cache EVICT: Invalidando todo el cache de usuarios");
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        user.setNombre(userDetails.getNombre());
        user.setEmail(userDetails.getEmail());
        return userRepository.save(user);
    }

    // Invalida cache al eliminar usuario
    @CacheEvict(value = "users", allEntries = true)
    public void deleteUser(Long id) {
        System.out.println("Cache EVICT: Invalidando todo el cache de usuarios");
        userRepository.deleteById(id);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }
}
