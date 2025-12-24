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

## 支持interface bean 注入
当前版本中，本项目仅支持在 以具体实现类类型直接引用 Bean 的场景下，对 Bean 定义位置进行识别与定位。

然而，在实际的 Spring 应用开发中，更为常见的实践是 面向接口编程：
业务逻辑通常通过接口进行抽象，并由具体实现类完成实现，从而提升系统的可扩展性与可维护性。在 Spring 框架中，这类 Bean 通常通过以下方式进行定义：

在接口实现类上标注 @Component、@Service、@Repository 等注解

或通过 @Bean 方法返回接口实现类的实例

在上述模式下，Bean 的注入点往往以 接口类型 进行声明，而非直接依赖具体实现类。当前项目尚无法在此类场景中正确解析接口与其实现类之间的关系，从而无法为接口类型的注入点提供 Bean 定义定位能力。

因此，有必要对现有的 Bean 查找与解析能力进行升级：
当某个 Field 以接口类型引入 Bean 时，项目应能够解析该接口对应的实现类 Bean，并在该 Field 上方提供相应的 CodeLens，以支持快速定位到具体的 Bean 定义位置（包括实现类或 @Bean 方法）。


## lombok注解 注入interface bean
在当前版本中，本插件对 Bean 注入点的识别主要基于显式的 Spring 注入注解（如 @Autowired、@Resource 等）以及字段或构造函数的直接声明方式。

然而，在实际的 Spring 项目开发中，Lombok 注解被广泛用于简化样板代码，尤其是在构造函数注入场景下。常见实践是通过 @RequiredArgsConstructor 自动生成构造函数，并结合 Spring 的依赖注入机制完成 Bean 的注入。

例如，在 Controller 或 Service 类上使用如下方式进行依赖注入：

在类级别使用
@RequiredArgsConstructor(onConstructor = @__({ @Autowired }))

在字段级别通过
@NonNull private final IExampleService exampleService;
的形式声明接口类型的依赖

在该模式下，依赖注入并未通过显式的字段注解完成，而是由 Lombok 在编译期生成带有 @Autowired 注解的构造函数，从而实现基于接口的构造器注入。

目前，本插件尚无法识别此类 由 Lombok 注解隐式生成的注入点，因此也无法在对应字段位置提供 CodeLens 或跳转能力，定位到具体的 Bean 定义（实现类或 @Bean 方法）。

为提升插件在真实 Spring 项目中的适用性，有必要扩展现有的注入点解析能力，使插件能够正确识别 Lombok 驱动的构造函数注入场景：
当某个字段通过 Lombok 注解参与构造函数注入，且其类型为接口时，插件应能够将该字段视为有效的 Bean 注入点，并基于接口类型解析对应的实现类 Bean，在字段上方提供 CodeLens，以支持快速定位到 Bean 定义位置。