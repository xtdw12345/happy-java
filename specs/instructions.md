# instruction

./speckit-spicify 我想开发一个vscode的插件，安装了该插件后，用户可以从使用spring bean的位置通过鼠标点击的方式定位到bean的定义处，而不用再通过手工搜索的方式进行查找。根据@specs/instructions.md的内容，think ultra hard，进行系统的web search，确保其准确性，并根据需要补充必要的内容，最后构建一份设计文档，放在specs/0002-design.md中，输出为中文，如果需要绘制图表，请使用mermaid.


## 增加lombok支持
现在需要为本插件新增功能：支持lombok的注解识别。
比如在类上加了 @RequiredArgsConstructor(onConstructor=@__({@Autowired}))，然后在字段上标注@NonNull，lombok会自动生成带有@Autowire注解的构造器，需要在对应的字段上增加codeLens，以跳转到bean定义处。
示例：
package com.translationcenter.controller;

import com.translationcenter.dto.response.ApiResponse;
import com.translationcenter.dto.response.PageResponse;
import com.translationcenter.entity.Copy;
import com.translationcenter.entity.CopyInstance;
import com.translationcenter.entity.CopyInstanceVersion;
import com.translationcenter.service.CopyService;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 翻译内容控制器
 */
@RestController
@RequestMapping("/copies")
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class CopyController {

    @NonNull
    private final CopyService copyService;

    /**
     * 获取Copy列表
     */
    @GetMapping("/list")
    public ApiResponse<PageResponse<Copy>> list(
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "100") int limit
    ) {
        try {
            int offset = (page - 1) * limit;
            List<Copy> copies = keyword != null && !keyword.isEmpty()
                    ? copyService.search(tenantId, keyword, limit, offset)
                    : copyService.findByTenantId(tenantId, limit, offset);

            PageResponse<Copy> pageResponse = PageResponse.of(copies, copies.size(), page, limit);
            return ApiResponse.success(pageResponse);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 根据ID获取Copy详情
     */
    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> getById(@PathVariable Long id) {
        try {
            Copy copy = copyService.findById(id);
            if (copy == null) {
                return ApiResponse.error("内容不存在");
            }

            List<CopyInstance> instances = copyService.findInstancesByCopyId(id);

            Map<String, Object> result = new HashMap<>();
            result.put("copy", copy);
            result.put("instances", instances);

            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 获取实例版本历史
     */
    @GetMapping("/instances/{instanceId}/versions")
    public ApiResponse<List<CopyInstanceVersion>> getVersions(@PathVariable Long instanceId) {
        try {
            List<CopyInstanceVersion> versions = copyService.findVersionsByInstanceId(instanceId);
            return ApiResponse.success(versions);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 发布实例
     */
    @PostMapping("/instances/{instanceId}/publish")
    public ApiResponse<String> publish(@PathVariable Long instanceId) {
        try {
            copyService.publishInstance(instanceId);
            return ApiResponse.success("发布成功");
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 归档实例
     */
    @PostMapping("/instances/{instanceId}/archive")
    public ApiResponse<String> archive(@PathVariable Long instanceId) {
        try {
            copyService.archiveInstance(instanceId);
            return ApiResponse.success("归档成功");
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ApiResponse<String> health() {
        return ApiResponse.success("healthy");
    }
}
