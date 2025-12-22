package com.example.repository;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Repository;

/**
 * Test fixture for Lombok with @Qualifier annotations
 * Tests that qualifiers are correctly extracted from Lombok fields
 */
@Repository
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class LombokWithQualifierRepository {

    @NonNull
    @Qualifier("primaryDataSource")
    private final DataSource dataSource;

    @NonNull
    @Qualifier("cacheManager")
    private final CacheManager cacheManager;

    // Field without qualifier
    @NonNull
    private final Logger logger;

    public void saveData(String data) {
        logger.log("Saving data with " + dataSource.getName());
    }

    public Object getCachedData(String key) {
        return cacheManager.get(key);
    }
}

// Mock dependencies for the fixture
class DataSource {
    public String getName() {
        return "Primary DataSource";
    }
}

class CacheManager {
    public Object get(String key) {
        return "cached:" + key;
    }
}

class Logger {
    public void log(String message) {
        System.out.println(message);
    }
}
