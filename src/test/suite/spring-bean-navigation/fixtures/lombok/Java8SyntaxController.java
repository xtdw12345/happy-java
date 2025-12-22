package com.example.controller;

import com.example.service.UserService;
import com.example.service.OrderService;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * Test fixture for Lombok Java 8 syntax: onConstructor_= variant
 * Tests alternative onConstructor syntax
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class Java8SyntaxController {

    @NonNull
    private final UserService userService;

    @NonNull
    private final OrderService orderService;

    @GetMapping("/users/{id}")
    public String getUser(@PathVariable Long id) {
        return userService.findUser(id);
    }

    @GetMapping("/orders/{id}")
    public String getOrder(@PathVariable Long id) {
        return orderService.findOrder(id);
    }
}
