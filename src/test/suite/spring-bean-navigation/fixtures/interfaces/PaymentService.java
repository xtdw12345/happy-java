package com.example.service;

/**
 * Test fixture: Interface for Payment Service (multiple implementations)
 */
public interface PaymentService {
    boolean processPayment(Double amount);
    String getProviderName();
}
