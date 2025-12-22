package com.example.controller;

import com.example.service.UserService;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * Test fixture for Lombok @RequiredArgsConstructor with onConstructor
 * Used for testing CodeLens navigation from @NonNull fields
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class RequiredArgsConstructorController {

    @NonNull
    private final UserService userService;

    @GetMapping("/{id}")
    public String getUser(@PathVariable Long id) {
        return userService.findUser(id);
    }

    @PostMapping
    public String createUser(@RequestBody String userData) {
        return userService.createUser(userData);
    }
}
