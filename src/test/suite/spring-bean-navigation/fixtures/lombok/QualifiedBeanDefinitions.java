package com.example.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

/**
 * Bean definition with @Qualifier for testing qualifier matching
 */
@Service
@Qualifier("primaryDataSource")
public class PrimaryDataSourceImpl {
    public String getName() {
        return "Primary DataSource Implementation";
    }
}

/**
 * Bean definition with @Qualifier for cache manager
 */
@Service
@Qualifier("cacheManager")
class CacheManagerImpl {
    public Object get(String key) {
        return "value for " + key;
    }
}

/**
 * Bean definition with @Primary annotation
 */
@Service
@Primary
class DefaultLogger {
    public void log(String message) {
        System.out.println("[DEFAULT] " + message);
    }
}
