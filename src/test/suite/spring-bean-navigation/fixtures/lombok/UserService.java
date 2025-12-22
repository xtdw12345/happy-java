package com.example.service;

import org.springframework.stereotype.Service;

/**
 * Test fixture bean definition - target for Lombok injection navigation
 */
@Service
public class UserService {

    public String findUser(Long id) {
        return "User " + id;
    }

    public String createUser(String userData) {
        return "Created user";
    }

    public void deleteUser(Long id) {
        // Delete logic
    }
}
