package com.example.datasource;

/**
 * Test fixture: Abstract class (should be treated like an interface)
 */
public abstract class DataSource {
    public abstract String getConnectionUrl();
    public abstract boolean isConnected();

    // Concrete method
    public void logConnection() {
        System.out.println("Connected to: " + getConnectionUrl());
    }
}
