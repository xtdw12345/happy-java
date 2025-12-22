package com.example.service;

import com.example.repository.UserRepository;
import com.example.repository.OrderRepository;
import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Test fixture for Lombok @AllArgsConstructor with onConstructor
 * Includes ALL fields regardless of @NonNull or final
 */
@Service
@AllArgsConstructor(onConstructor=@__({@Autowired}))
public class AllArgsConstructorService {

    // This field will be included (no @NonNull or final)
    private UserRepository userRepository;

    // This field will also be included
    private OrderRepository orderRepository;

    // Even optional String fields are included
    private String configuration;

    public String processUser(Long userId) {
        return userRepository.findUser(userId);
    }

    public String processOrder(Long orderId) {
        return orderRepository.findOrder(orderId);
    }
}
