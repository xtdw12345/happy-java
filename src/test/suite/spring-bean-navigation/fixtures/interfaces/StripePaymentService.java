package com.example.service;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

/**
 * Test fixture: Stripe implementation of PaymentService (marked as @Primary)
 */
@Service
@Primary
public class StripePaymentService implements PaymentService {
    @Override
    public boolean processPayment(Double amount) {
        System.out.println("Processing payment with Stripe: $" + amount);
        return true;
    }

    @Override
    public String getProviderName() {
        return "Stripe";
    }
}
