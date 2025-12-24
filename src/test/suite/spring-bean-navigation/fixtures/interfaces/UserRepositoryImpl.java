package com.example.repository;

import org.springframework.stereotype.Repository;

/**
 * Test fixture: Single implementation of UserRepository
 */
@Repository
public class UserRepositoryImpl implements UserRepository {
    @Override
    public String findUser(Long id) {
        return "User " + id;
    }

    @Override
    public void saveUser(String user) {
        // Mock implementation
    }
}
