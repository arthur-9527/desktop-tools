/**
 * Accessibility Native Addon - Windows implementation
 * 
 * Uses Windows UIAutomation Core API to get Accessibility element tree.
 * 
 * API:
 *   getAccessibilityTree(maxDepth) - Get element tree
 *   getFocusedElement() - Get focused element
 */

#include <napi.h>
#include <UIAutomation.h>
#include <string>

#pragma comment(lib, "UIAutomationCore.lib")

// ControlType to string conversion
std::string ControlTypeToString(int controlType) {
    switch (controlType) {
        case UIA_WindowControlTypeId: return "Window";
        case UIA_PaneControlTypeId: return "Pane";
        case UIA_ButtonControlTypeId: return "Button";
        case UIA_TextControlTypeId: return "Text";
        case UIA_EditControlTypeId: return "Edit";
        case UIA_CheckBoxControlTypeId: return "CheckBox";
        case UIA_MenuControlTypeId: return "Menu";
        case UIA_MenuItemControlTypeId: return "MenuItem";
        case UIA_TabControlTypeId: return "Tab";
        case UIA_TabItemControlTypeId: return "TabItem";
        case UIA_ComboBoxControlTypeId: return "ComboBox";
        case UIA_ProgressBarControlTypeId: return "ProgressBar";
        case UIA_SeparatorControlTypeId: return "Separator";
        case UIA_RadioButtonControlTypeId: return "RadioButton";
        case UIA_TreeControlTypeId: return "Tree";
        case UIA_TreeItemControlTypeId: return "TreeItem";
        case UIA_ListControlTypeId: return "List";
        case UIA_ListItemControlTypeId: return "ListItem";
        case UIA_DocumentControlTypeId: return "Document";
        case UIA_HyperlinkControlTypeId: return "Hyperlink";
        case UIA_ImageControlTypeId: return "Image";
        case UIA_ToolBarControlTypeId: return "ToolBar";
        case UIA_DataGridControlTypeId: return "DataGrid";
        case UIA_DataItemControlTypeId: return "DataItem";
        case UIA_CustomControlTypeId: return "Custom";
        case UIA_HeaderControlTypeId: return "Header";
        case UIA_HeaderItemControlTypeId: return "HeaderItem";
        case UIA_ThumbControlTypeId: return "Thumb";
        case UIA_TitleBarControlTypeId: return "TitleBar";
        case UIA_SplitButtonControlTypeId: return "SplitButton";
        default: return "Unknown";
    }
}

// Get element Name property (BSTR -> std::string)
std::string GetElementName(IUIAutomationElement* element) {
    BSTR nameBSTR = nullptr;
    std::string name;
    if (SUCCEEDED(element->get_CurrentName(&nameBSTR)) && nameBSTR) {
        int len = WideCharToMultiByte(CP_UTF8, 0, nameBSTR, -1, nullptr, 0, nullptr, nullptr);
        if (len > 0) {
            char* buffer = new char[len];
            WideCharToMultiByte(CP_UTF8, 0, nameBSTR, -1, buffer, len, nullptr, nullptr);
            name = buffer;
            delete[] buffer;
        }
        SysFreeString(nameBSTR);
    }
    return name;
}

// Get element BoundingRectangle property as Napi object
Napi::Object GetBoundsObject(Napi::Env env, IUIAutomationElement* element) {
    RECT rect;
    Napi::Object bounds = Napi::Object::New(env);
    if (SUCCEEDED(element->get_CurrentBoundingRectangle(&rect))) {
        bounds.Set("x", Napi::Number::New(env, (double)rect.left));
        bounds.Set("y", Napi::Number::New(env, (double)rect.top));
        bounds.Set("width", Napi::Number::New(env, (double)(rect.right - rect.left)));
        bounds.Set("height", Napi::Number::New(env, (double)(rect.bottom - rect.top)));
    } else {
        bounds.Set("x", Napi::Number::New(env, 0.0));
        bounds.Set("y", Napi::Number::New(env, 0.0));
        bounds.Set("width", Napi::Number::New(env, 0.0));
        bounds.Set("height", Napi::Number::New(env, 0.0));
    }
    return bounds;
}

// Recursive function to build element tree node
Napi::Object BuildElementNode(Napi::Env env, IUIAutomationTreeWalker* walker, IUIAutomationElement* element, int depth, int maxDepth) {
    if (!element) {
        return Napi::Object::New(env);
    }

    Napi::Object node = Napi::Object::New(env);

    int controlType = 0;
    std::string role = "Unknown";
    if (SUCCEEDED(element->get_CurrentControlType(&controlType))) {
        role = ControlTypeToString(controlType);
    }
    node.Set("role", Napi::String::New(env, role));

    std::string name = GetElementName(element);
    node.Set("name", Napi::String::New(env, name));

    node.Set("bounds", GetBoundsObject(env, element));

    // Get children recursively using tree walker
    if (depth < maxDepth) {
        IUIAutomationElement* child = nullptr;
        if (SUCCEEDED(walker->GetFirstChildElement(element, &child)) && child) {
            Napi::Array childrenArray = Napi::Array::New(env);
            int childIndex = 0;
            IUIAutomationElement* current = child;
            while (current) {
                Napi::Object childNode = BuildElementNode(env, walker, current, depth + 1, maxDepth);
                childrenArray.Set(childIndex, childNode);
                childIndex++;
                IUIAutomationElement* sibling = nullptr;
                if (SUCCEEDED(walker->GetNextSiblingElement(current, &sibling)) && sibling) {
                    current->Release();
                    current = sibling;
                } else {
                    current->Release();
                    current = nullptr;
                }
            }
            if (childIndex > 0) {
                node.Set("children", childrenArray);
            }
        }
    }

    return node;
}

// getAccessibilityTree(maxDepth) - Get element tree
Napi::Value GetAccessibilityTree(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    int maxDepth = 3;
    if (info.Length() > 0 && info[0].IsNumber()) {
        maxDepth = info[0].As<Napi::Number>().Int32Value();
    }
    if (maxDepth < 1) maxDepth = 1;
    if (maxDepth > 20) maxDepth = 20;

    // Initialize COM
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // Create UIAutomation instance
    IUIAutomation* pAutomation = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_CUIAutomation, nullptr, CLSCTX_INPROC_SERVER, IID_IUIAutomation, (void**)&pAutomation);
    if (FAILED(hr) || !pAutomation) {
        CoUninitialize();
        return env.Undefined();
    }

    // Get raw view tree walker for child/sibling navigation
    IUIAutomationTreeWalker* pWalker = nullptr;
    pAutomation->get_RawViewWalker(&pWalker);

    // Get root element
    IUIAutomationElement* rootElement = nullptr;
    hr = pAutomation->GetRootElement(&rootElement);

    if (FAILED(hr) || !rootElement) {
        if (pWalker) pWalker->Release();
        pAutomation->Release();
        CoUninitialize();
        return env.Undefined();
    }

    Napi::Object root = BuildElementNode(env, pWalker, rootElement, 0, maxDepth);
    rootElement->Release();
    if (pWalker) pWalker->Release();
    pAutomation->Release();
    CoUninitialize();
    return root;
}

// getFocusedElement() - Get focused element
Napi::Value GetFocusedElement(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Initialize COM
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

    // Create UIAutomation instance
    IUIAutomation* pAutomation = nullptr;
    HRESULT hr = CoCreateInstance(CLSID_CUIAutomation, nullptr, CLSCTX_INPROC_SERVER, IID_IUIAutomation, (void**)&pAutomation);
    if (FAILED(hr) || !pAutomation) {
        CoUninitialize();
        return env.Undefined();
    }

    // Get raw view tree walker for child/sibling navigation
    IUIAutomationTreeWalker* pWalker = nullptr;
    pAutomation->get_RawViewWalker(&pWalker);

    // Get focused element
    IUIAutomationElement* focusedElement = nullptr;
    hr = pAutomation->GetFocusedElement(&focusedElement);

    if (FAILED(hr) || !focusedElement) {
        if (pWalker) pWalker->Release();
        pAutomation->Release();
        CoUninitialize();
        return env.Undefined();
    }

    Napi::Object element = BuildElementNode(env, pWalker, focusedElement, 0, 2);
    focusedElement->Release();
    if (pWalker) pWalker->Release();
    pAutomation->Release();
    CoUninitialize();
    return element;
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "getAccessibilityTree"), Napi::Function::New(env, GetAccessibilityTree));
    exports.Set(Napi::String::New(env, "getFocusedElement"), Napi::Function::New(env, GetFocusedElement));
    return exports;
}

NODE_API_MODULE(accessibility, InitAll)