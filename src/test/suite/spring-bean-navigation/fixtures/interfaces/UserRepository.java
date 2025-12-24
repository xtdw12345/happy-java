package com.example.repository;

/**
 * Test fixture: Interface for User Repository
 */
public interface UserRepository {
    String findUser(Long id);
    void saveUser(String user);
}
