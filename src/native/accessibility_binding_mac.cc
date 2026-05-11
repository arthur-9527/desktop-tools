/**
 * Accessibility Native Addon - macOS 实现
 * 
 * 使用 macOS AXUIElement API 获取 Accessibility 元素树。
 * 
 * API:
 *   getAccessibilityTree(maxDepth) - 获取元素树
 *   getFocusedElement() - 获取当前焦点元素
 * 
 * 编译:
 *   npx node-gyp rebuild
 * 
 * 链接:
 *   - ApplicationServices.framework (AXUIElement.framework)
 *   - node-addon-api
 */

#include <napi.h>
#include <ApplicationServices/ApplicationServices.h>
#include <string>

// ===== 辅助函数 =====

// 将 AXRole 转换为字符串
std::string RoleToString(AXRole role) {
    CFStringRef roleValue;
    if (AXUIElementCopyAttributeValue(AXUIElementCreateSystemWide(), role, reinterpret_cast<CFTypeRef*>(&roleValue)) == kAXErrorSuccess && roleValue) {
        CFIndex length = CFStringGetLength(roleValue);
        char buffer[256];
        if (CFStringGetCString(roleValue, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
            CFRelease(roleValue);
            return std::string(buffer);
        }
        CFRelease(roleValue);
    }
    return "Unknown";
}

// 获取元素的 AXRole
std::string GetElementRole(AXUIElementRef element) {
    CFStringRef role = nullptr;
    if (AXUIElementCopyAttributeValue(element, kAXRoleAttribute, reinterpret_cast<CFTypeRef*>(&role)) == kAXErrorSuccess && role) {
        CFIndex length = CFStringGetLength(role);
        char buffer[256];
        if (CFStringGetCString(role, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
            CFRelease(role);
            return std::string(buffer);
        }
        CFRelease(role);
    }
    return "Unknown";
}

// 获取元素的 AXTitle (name)
std::string GetElementName(AXUIElementRef element) {
    CFStringRef title = nullptr;
    if (AXUIElementCopyAttributeValue(element, kAXTitleAttribute, reinterpret_cast<CFTypeRef*>(&title)) == kAXErrorSuccess && title) {
        CFIndex length = CFStringGetLength(title);
        char buffer[512];
        if (CFStringGetCString(title, buffer, sizeof(buffer), kCFStringEncodingUTF8)) {
            CFRelease(title);
            return std::string(buffer);
        }
        CFRelease(title);
    }
    return "";
}

// 获取元素的 AXPosition
Napi::Value GetPosition(Napi::Env env, AXUIElementRef element) {
    Napi::Object pos = Napi::Object::New(env);
    AXValueRef value = nullptr;
    if (AXUIElementCopyAttributeValue(element, kAXPositionAttribute, reinterpret_cast<CFTypeRef*>(&value)) == kAXErrorSuccess && value) {
        AXValueDataType dataType;
        void* data = nullptr;
        if (AXValueGetType(value, &dataType) == kAXErrorSuccess && dataType == kAXValueCGPointType) {
            data = malloc(sizeof(CGPoint));
            if (AXValueGetValue(value, dataType, data)) {
                CGPoint* point = (CGPoint*)data;
                pos.Set("x", Napi::Number::New(env, point->x));
                pos.Set("y", Napi::Number::New(env, point->y));
                free(data);
            } else {
                free(data);
            }
        }
        CFRelease(value);
    }
    if (!pos.Get("x").IsNumber()) pos.Set("x", Napi::Number::New(env, 0.0));
    if (!pos.Get("y").IsNumber()) pos.Set("y", Napi::Number::New(env, 0.0));
    return pos;
}

// 获取元素的 AXSize
Napi::Value GetSize(Napi::Env env, AXUIElementRef element) {
    Napi::Object size = Napi::Object::New(env);
    AXValueRef value = nullptr;
    if (AXUIElementCopyAttributeValue(element, kAXSizeAttribute, reinterpret_cast<CFTypeRef*>(&value)) == kAXErrorSuccess && value) {
        AXValueDataType dataType;
        void* data = nullptr;
        if (AXValueGetType(value, &dataType) == kAXErrorSuccess && dataType == kAXValueCGSizeType) {
            data = malloc(sizeof(CGSize));
            if (AXValueGetValue(value, dataType, data)) {
                CGSize* s = (CGSize*)data;
                size.Set("width", Napi::Number::New(env, s->width));
                size.Set("height", Napi::Number::New(env, s->height));
                free(data);
            } else {
                free(data);
            }
        }
        CFRelease(value);
    }
    if (!size.Get("width").IsNumber()) size.Set("width", Napi::Number::New(env, 0.0));
    if (!size.Get("height").IsNumber()) size.Set("height", Napi::Number::New(env, 0.0));
    return size;
}

// 获取元素的 AXBounds (bounds in screen coordinates)
Napi::Value GetBounds(Napi::Env env, AXUIElementRef element) {
    Napi::Object bounds = Napi::Object::New(env);
    AXValueRef value = nullptr;
    if (AXUIElementCopyAttributeValue(element, kAXBoundsAttribute, reinterpret_cast<CFTypeRef*>(&value)) == kAXErrorSuccess && value) {
        AXValueDataType dataType;
        void* data = nullptr;
        if (AXValueGetType(value, &dataType) == kAXErrorSuccess && dataType == kAXValueCGRectType) {
            data = malloc(sizeof(CGRect));
            if (AXValueGetValue(value, dataType, data)) {
                CGRect* rect = (CGRect*)data;
                bounds.Set("x", Napi::Number::New(env, rect->origin.x));
                bounds.Set("y", Napi::Number::New(env, rect->origin.y));
                bounds.Set("width", Napi::Number::New(env, rect->size.width));
                bounds.Set("height", Napi::Number::New(env, rect->size.height));
                free(data);
            } else {
                free(data);
            }
        }
        CFRelease(value);
    }
    if (!bounds.Get("x").IsNumber()) bounds.Set("x", Napi::Number::New(env, 0.0));
    if (!bounds.Get("y").IsNumber()) bounds.Set("y", Napi::Number::New(env, 0.0));
    if (!bounds.Get("width").IsNumber()) bounds.Set("width", Napi::Number::New(env, 0.0));
    if (!bounds.Get("height").IsNumber()) bounds.Set("height", Napi::Number::New(env, 0.0));
    return bounds;
}

// 递归构建元素树节点
Napi::Object BuildElementNode(Napi::Env env, AXUIElementRef element, int depth, int maxDepth) {
    if (!element) {
        return Napi::Object::New(env);
    }

    Napi::Object node = Napi::Object::New(env);

    // 获取 Role
    std::string role = GetElementRole(element);
    node.Set("role", Napi::String::New(env, role));

    // 获取 Name/Title
    std::string name = GetElementName(element);
    node.Set("name", Napi::String::New(env, name));

    // 获取 Bounds
    node.Set("bounds", GetBounds(env, element));

    // 递归获取子元素
    if (depth < maxDepth) {
        AXUIElementRef children = nullptr;
        if (AXUIElementCopyAttributeValue(element, kAXChildrenAttribute, reinterpret_cast<CFTypeRef*>(&children)) == kAXErrorSuccess && children) {
            CFIndex count = 0;
            if (AXUIElementCopyAttributeValue(children, kAXCountAttribute, reinterpret_cast<CFTypeRef*>(&count)) == kAXErrorSuccess) {
                if (count > 0) {
                    Napi::Array childrenArray = Napi::Array::New(env);
                    for (CFIndex i = 0; i < count; i++) {
                        AXUIElementRef child = nullptr;
                        if (AXUIElementCopyAttributeValue(children, CFSTR("children"), reinterpret_cast<CFTypeRef*>(&child)) == kAXErrorSuccess && child) {
                            Napi::Object childNode = BuildElementNode(env, child, depth + 1, maxDepth);
                            childrenArray.Set(childrenArray.Length(), childNode);
                            CFRelease(child);
                        }
                    }
                    node.Set("children", childrenArray);
                }
            }
            CFRelease(children);
        }
    }

    return node;
}

// ===== Node-API 导出函数 =====

// getAccessibilityTree(maxDepth) - 获取元素树
Napi::Value GetAccessibilityTree(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // 解析 maxDepth 参数
    int maxDepth = 3;
    if (info.Length() > 0 && info[0].IsNumber()) {
        maxDepth = info[0].As<Napi::Number>().Int32Value();
    }
    if (maxDepth < 1) maxDepth = 1;
    if (maxDepth > 20) maxDepth = 20;

    // 获取系统级 AXUIElement
    AXUIElementRef systemWide = AXUIElementCreateSystemWide();
    if (!systemWide) {
        return env.Undefined();
    }

    // 获取 root element (窗口列表)
    AXUIElementRef windows = nullptr;
    if (AXUIElementCopyAttributeValue(systemWide, kAXWindowsAttribute, reinterpret_cast<CFTypeRef*>(&windows)) == kAXErrorSuccess && windows) {
        // 获取第一个窗口
        CFIndex windowCount = 0;
        if (AXUIElementCopyAttributeValue(windows, kAXCountAttribute, reinterpret_cast<CFTypeRef*>(&windowCount)) == kAXErrorSuccess) {
            if (windowCount > 0) {
                AXUIElementRef frontmostWindow = nullptr;
                if (AXUIElementCopyAttributeValue(windows, CFSTR("windows"), reinterpret_cast<CFTypeRef*>(&frontmostWindow)) == kAXErrorSuccess && frontmostWindow) {
                    // 构建第一个窗口的元素树
                    Napi::Object root = BuildElementNode(env, frontmostWindow, 0, maxDepth);
                    CFRelease(frontmostWindow);
                    CFRelease(windows);
                    CFRelease(systemWide);
                    return root;
                }
            }
        }
        CFRelease(windows);
    }
    
    CFRelease(systemWide);
    return env.Undefined();
}

// getFocusedElement() - 获取当前焦点元素
Napi::Value GetFocusedElement(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // 获取系统级 AXUIElement
    AXUIElementRef systemWide = AXUIElementCreateSystemWide();
    if (!systemWide) {
        return env.Undefined();
    }

    // 获取 frontmost application
    AXUIElementRef app = nullptr;
    if (AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute, reinterpret_cast<CFTypeRef*>(&app)) == kAXErrorSuccess && app) {
        // 获取 app 的 focused element
        AXUIElementRef focusedElement = nullptr;
        if (AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute, reinterpret_cast<CFTypeRef*>(&focusedElement)) == kAXErrorSuccess && focusedElement) {
            Napi::Object element = BuildElementNode(env, focusedElement, 0, 2);
            CFRelease(focusedElement);
            CFRelease(app);
            CFRelease(systemWide);
            return element;
        }
        CFRelease(app);
    }
    
    CFRelease(systemWide);
    return env.Undefined();
}

// ===== Module 初始化 =====

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    exports.Set("getAccessibilityTree", Napi::Function::New(env, GetAccessibilityTree));
    exports.Set("getFocusedElement", Napi::Function::New(env, GetFocusedElement));
    return exports;
}

NODE_API_MODULE(accessibility, InitAll)