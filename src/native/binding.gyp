{
  "targets": [
    {
      "target_name": "accessibility",
      "sources": [
        "accessibility_binding.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "_CRT_SECURE_NO_WARNINGS"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalIncludeDirectories": [
                "C:/Program Files (x86)/Windows Kits/10/Include/10.0.22621.0/um"
              ]
            }
          },
          "libraries": [
            "C:/Program Files (x86)/Windows Kits/10/Lib/10.0.22621.0/um/x64/UIAutomationCore.lib"
          ]
        }],
        ["OS=='mac'", {
          "sources": [
            "accessibility_binding_mac.cc"
          ],
          "libraries": [
            "-framework ApplicationServices"
          ],
          "xcode_settings": {
            "OTHER_CPLUSPLUSFLAGS": [
              "-std=c++17"
            ],
            "OTHER_LDFLAGS": [
              "-framework ApplicationServices"
            ],
            "MACOSX_DEPLOYMENT_TARGET": "10.15"
          }
        }]
      ]
    }
  ]
}