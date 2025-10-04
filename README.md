# 大学证件综合生成系统 (University Certificate Generation System)

### 本网站使用 [Google Gemini 2.5](https://gemini.google.com/) 生成并优化
### 更新日志：[CHANGELOG](./docs/CHANGELOG.md)

这是一个基于Web的大学证件生成工具，允许用户根据预设的模板，快速生成包括学生证、录取通知书、在读证明等多种类型的学术证明文件。

This is a web-based university certificate generation tool that allows users to quickly create various academic documents, such as student cards, admission letters, and enrollment certificates, based on predefined templates.

## ✨ 功能特性 (Features)

* **模板化设计**：系统完全基于模板驱动，可以轻松添加新的学校或地区模板，而无需修改核心代码。
* **多文档支持**：每个模板可以支持多种证件类型（如学生证、录取通知书、在读证明等）。
* **实时预览**：在控制面板中输入信息，右侧预览区域会实时更新，所见即所得。
* **信息自定义**：支持自定义填写大学通用信息（校名、校徽）和各类证件所需的详细信息（学生姓名、学号、日期等）。
* **默认值加载**：模板可在 `config.json` 中配置默认大学名称，选择模板后可自动填充。
* **打印优化**：提供专门的打印样式，支持将生成的证件以标准尺寸（如A4）进行打印。

## 💻 技术栈 (Technology Stack)

* **前端 (Frontend)**: HTML5, CSS3, JavaScript
* **核心逻辑**: 使用原生JavaScript (Vanilla JS) 实现，无任何外部框架依赖，轻量且高效。

## 📂 项目结构 (Project Structure)

```
.
├── index.html              # 应用程序主页面
├── assets                  # 存放全局静态资源
│   ├── css/style.css       # 全局UI样式文件
│   └── js/main.js          # 核心的JavaScript逻辑
└── templates               # 存放所有证件模板
    ├── manifest.json       # 模板清单，用于在下拉菜单中注册模板
    └── russia/             # "俄罗斯"模板示例文件夹
        ├── config.json     # 模板配置文件（定义文档类型、默认校名等）
        ├── style.css       # 仅适用于此模板的特定样式
        ├── admission_letter.html   # 录取通知书的表单和预览HTML片段
        ├── enrollment_cert.html    # 在读证明的HTML片段
        └── student_card.html       # 学生证的HTML片段
```

## 🚀 如何使用 (How to Use)

1.  **克隆或下载项目**：
    ```bash
    git clone [https://github.com/gujiangjiang/University_Certificate_Generation_System.git](https://github.com/gujiangjiang/University_Certificate_Generation_System.git)
    ```
2.  **在浏览器中打开**：
    直接用浏览器打开项目根目录下的 `index.html` 文件。

3.  **开始生成**：
    * 在页面左上角的下拉菜单中**选择一个证件模板**（例如，“俄罗斯帕米尔大学模板”）。
    * 通用大学信息（校名、校徽）和支持的证件类型按钮将会出现。
    * **点击一个证件类型**（如“学生证”），下方会加载对应的表单。
    * 在表单中填写或修改信息。
    * 右侧的预览区域会实时展示最终效果。
    * 点击“打印”按钮即可输出或保存为PDF。

## 🎨 如何创建新模板 (How to Create a New Template)

本系统最大的优势在于其扩展性。您可以轻松添加新的学校模板：

1.  **创建模板文件夹**: 在 `templates/` 目录下，创建一个新的文件夹，建议使用简短的英文作为文件夹名称（例如 `uk_oxford`）。

2.  **更新清单文件**: 打开 `templates/manifest.json`，在 `templates` 数组中添加一个新对象来注册你的模板。
    ```json
    {
        "templates": [
            {
                "id": "russia",
                "name": "俄罗斯帕米尔大学模板"
            },
            {
                "id": "uk_oxford",
                "name": "英国牛津大学模板"
            }
        ]
    }
    ```

3.  **创建配置文件**: 在你的新模板文件夹 (`uk_oxford/`) 内，创建一个 `config.json` 文件。
    * `name`: 模板在下拉菜单中显示的名称。
    * `universityName`, `universityNameEn`: 可选的默认大学中英文名称。
    * `documents`: 一个对象，定义此模板支持的所有证件。键名（如 `student_card`）将作为HTML文件名，`name` 是按钮上显示的文字，`available` 设为 `true`。
    ```json
    {
        "name": "英国牛津大学模板",
        "universityName": "牛津大学",
        "universityNameEn": "University of Oxford",
        "documents": {
          "student_card": {
            "name": "学生卡",
            "available": true
          },
          "admission_letter": {
            "name": "录取通知书",
            "available": true
          }
        }
    }
    ```

4.  **创建模板样式**: 在模板文件夹内，创建一个 `style.css` 文件，用于编写该模板下所有证件的专属样式。

5.  **创建证件HTML片段**: 根据 `config.json` 中定义的证件，在模板文件夹内创建对应的 `.html` 文件（如 `student_card.html`）。每个文件必须包含两个 `div`：
    * `<div id="form-snippet">...</div>`: 包含该证件所需的所有表单输入项。
    * `<div id="preview-snippet">...</div>`: 包含该证件的预览HTML结构。

6.  **实现数据绑定**:
    * 在 `form-snippet` 的输入控件（`input`, `select`等）上，使用 `data-bind-to="key"` 属性。
    * 在 `preview-snippet` 中需要显示该数据的地方，使用 `data-preview-id="key"` 属性。
    * 系统会自动将 `data-bind-to` 的值更新到 `data-preview-id` 对应的元素中。

    **示例**:
    ```html
    <input type="text" data-bind-to="studentName" value="张三">

    <div data-preview-id="studentName">张三</div>
    ```

## 📄 许可证 (License)

本项目采用 [MIT License](LICENSE) 授权。