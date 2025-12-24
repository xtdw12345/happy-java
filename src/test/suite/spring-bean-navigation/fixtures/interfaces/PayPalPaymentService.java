package com.example.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * Test fixture: PayPal implementation of PaymentService (with qualifier)
 */
@Service
@Qualifier("paypal")
public class PayPalPaymentService implements PaymentService {
    @Override
    public boolean processPayment(Double amount) {
        System.out.println("Processing payment with PayPal: $" + amount);
        return true;
    }

    @Override
    public String getProviderName() {
        return "PayPal";
    }
}
