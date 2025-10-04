# 大学证件综合生成系统 (University Certificate Generation System)

[![](https://img.shields.io/badge/在线体验-Demo-brightgreen.svg)](https://university.gujiangjiang.cloudns.club/)

### 本网站使用 [Google Gemini](https://gemini.google.com/) 生成并优化
### 更新日志：[CHANGELOG](./docs/CHANGELOG.md)

这是一个基于Web的大学证件生成工具，允许用户根据预设的模板，快速生成包括学生证、录取通知书、在读证明等多种类型的学术证明文件。

This is a web-based university certificate generation tool that allows users to quickly create various academic documents, such as student cards, admission letters, and enrollment certificates, based on predefined templates.

## ✨ 功能特性 (Features)

* **分层模板管理**：系统支持按“国家/地区”对大学模板进行分组，结构更清晰，易于扩展。
* **模板化设计**：系统完全基于模板驱动，可以轻松添加新的学校或地区模板，而无需修改核心代码。
* **多文档支持**：每个模板可以支持多种证件类型（如学生证、录取通知书、在读证明等）。
* **实时预览**：在控制面板中输入信息，右侧预览区域会实时更新，所见即所得。
* **全局Toast通知**：在进行关键操作时（如选择模板、更新预览、打印等），右上角会弹出友好的提示信息，提升用户体验。
* **风险提醒**：进入页面时会自动弹出风险提示，明确工具的测试用途和免责声明。
* **信息自定义**：支持自定义填写大学通用信息（校名、校徽）和各类证件所需的详细信息（学生姓名、学号、日期等）。
* **打印优化**：提供专门的打印样式，不仅支持将生成的证件以标准尺寸（如A4）进行打印，还会自动隐藏操作界面和通知弹窗等无关元素。

## 💻 技术栈 (Technology Stack)

* **前端 (Frontend)**: HTML5, CSS3, JavaScript
* **核心逻辑**: 使用原生JavaScript (Vanilla JS) 实现，无任何外部框架依赖，轻量且高效。

## 📂 项目结构 (Project Structure)
```
.
├── README.md               # 项目说明文件
├── index.html              # 应用程序主页面
├── assets                  # 存放全局静态资源
│   ├── css/
│   │   ├── style.css       # 全局UI样式文件
│   │   ├── toast.css       # Toast通知弹窗样式文件
│   │   └── templates/      # 存放通用的模板CSS
│   │       ├── common.css  # 所有模板共享的基础样式
│   │       └── print.css   # 全局通用的打印样式
│   └── js/
│       ├── main.js         # 核心的JavaScript逻辑
│       ├── resource-loader.js # 本地/在线CSS资源加载器
│       └── toast.js        # Toast通知弹窗的逻辑
└── templates/              # 存放所有证件模板
    ├── manifest.json       # 模板清单 (定义国家和大学的层级)
    └── kyrgyzstan/         # "吉尔吉斯斯坦" 国家文件夹 (示例)
        └── pamir_university/ # "帕米尔大学" 模板文件夹 (示例)
            ├── config.json     # 模板配置文件（定义文档类型、默认值等）
            ├── style.css       # 仅适用于此模板的特定样式
            ├── admission_letter.html   # 录取通知书的HTML片段
            ├── enrollment_cert.html    # 在读证明的HTML片段
            └── student_card.html       # 学生证的HTML片段

```

## 🚀 如何使用 (How to Use)

1.  **访问在线网站** 或 **克隆项目到本地**：
    * **在线体验**: [https://university.gujiangjiang.cloudns.club/](https://university.gujiangjiang.cloudns.club/)
    * **本地运行**:
        ```bash
        git clone [https://github.com/gujiangjiang/University_Certificate_Generation_System.git](https://github.com/gujiangjiang/University_Certificate_Generation_System.git)
        ```
        然后直接用浏览器打开项目根目录下的 `index.html` 文件。

2.  **开始生成**：
    * 在页面左侧的下拉菜单中，首先**选择一个国家**。
    * 接着，在下方的**选择大学**下拉菜单中选择一所大学模板。
    * 通用大学信息和支持的证件类型按钮将会出现。
    * **点击一个证件类型**（如“学生证”），下方会加载对应的表单。
    * 在表单中填写或修改信息。
    * 右侧的预览区域会实时展示最终效果。
    * 点击“打印”按钮即可输出或保存为PDF。

## 🎨 如何创建新模板 (How to Create a New Template)

本系统最大的优势在于其扩展性。您可以轻松添加新的学校模板：

1.  **创建模板文件夹**: 在 `templates/` 目录下，根据 `国家/大学` 的结构创建文件夹。
    * 如果国家文件夹（如 `uk`）不存在，请先创建它。
    * 然后在国家文件夹内，为你的大学创建一个新文件夹（如 `oxford`）。
    * 最终路径示例： `templates/uk/oxford/`。

2.  **更新清单文件**: 打开 `templates/manifest.json`，在 `countries` 数组中找到对应的国家对象（如果不存在则新建一个），然后在该国家的 `universities` 数组中添加一个新对象来注册你的大学模板。
    * `country.id`: 国家文件夹名称。
    * `university.id`: 大学文件夹名称。
    ```json
    {
        "countries": [
            {
                "name": "吉尔吉斯斯坦",
                "id": "kyrgyzstan",
                "universities": [
                    {
                        "name": "帕米尔大学",
                        "id": "pamir_university"
                    }
                ]
            },
            {
                "name": "英国",
                "id": "uk",
                "universities": [
                    {
                        "name": "牛津大学",
                        "id": "oxford"
                    }
                ]
            }
        ]
    }
    ```

3.  **创建配置文件**: 在你的新大学模板文件夹 (`templates/uk/oxford/`) 内，创建一个 `config.json` 文件。
    * `name`: 模板的显示名称。
    * `universityInfo`, `studentInfoDefaults`: 包含各项信息的默认值。
    * `documents`: 一个对象，定义此模板支持的所有证件。键名（如 `student_card`）将作为HTML文件名，`name` 是按钮上显示的文字，`available` 设为 `true`。
    ```json
    {
        "name": "英国牛津大学模板",
        "universityInfo": {
            "universityName": "牛津大学",
            "universityNameEn": "University of Oxford"
        },
        "studentInfoDefaults": { "..." },
        "documents": {
          "student_card": {
            "name": "学生卡",
            "available": true,
            "defaults": { "..." }
          }
        }
    }
    ```

4.  **创建模板样式**: 在大学模板文件夹内，创建一个 `style.css` 文件，用于编写该模板下所有证件的专属样式。

5.  **创建证件HTML片段**: 根据 `config.json` 中定义的证件，在大学模板文件夹内创建对应的 `.html` 文件（如 `student_card.html`）。每个文件必须包含两个 `div`：
    * `<div id="form-snippet">...</div>`: 包含该证件所需的所有表单输入项。
    * `<div id="preview-snippet">...</div>`: 包含该证件的预览HTML结构。

6.  **实现数据绑定**:
    * 在 `form-snippet` 的输入控件（`input`, `select`等）上，使用 `data-bind-to="key"` 属性。
    * 在 `preview-snippet` 中需要显示该数据的地方，使用 `data-preview-id="key"` 属性。
    * 系统会自动将 `data-bind-to` 的值更新到 `data-preview-id` 对应的元素中。

    **示例**:
    ```html
    <input type="text" id="studentName" data-bind-to="studentName">

    <div data-preview-id="studentName"></div>
    ```

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 授权。