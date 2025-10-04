document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentTemplate: null,
        currentDocument: null,
    };

    const selectors = {
        templateSelector: document.getElementById('template-selector'),
        commonInfoSection: document.getElementById('common-info-section'),
        documentSelector: document.getElementById('document-selector'),
        docFormContainer: document.getElementById('document-form-container'),
        previewContainer: document.getElementById('preview-container'),
        actionButtons: document.getElementById('action-buttons'),
        printBtn: document.getElementById('print-btn'),
        previewBtn: document.getElementById('preview-btn'),
    };

    // 1. 初始化：加载模板清单
    async function initialize() {
        try {
            const response = await fetch('templates/manifest.json');
            if (!response.ok) {
                throw new Error('无法加载模板清单 manifest.json');
            }
            const manifest = await response.json();
            
            manifest.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                selectors.templateSelector.appendChild(option);
            });

        } catch (error) {
            console.error('初始化失败:', error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：${error.message}</div>`;
        }
    }

    // 2. 加载选定的模板
    async function loadTemplate(templateId) {
        if (!templateId) {
            resetUI();
            return;
        }
        state.currentTemplate = templateId;
        
        resetUI(true);

        try {
            const configResponse = await fetch(`templates/${templateId}/config.json`);
            if (!configResponse.ok) {
                throw new Error('无法加载 config.json');
            }
            const config = await configResponse.json();

            // --- 新增功能：填充默认大学名称 ---
            // 检查 config 对象中是否存在 universityName 属性
            if (config.universityName) {
                // 如果存在，则设置 id 为 universityName 的输入框的值
                document.getElementById('universityName').value = config.universityName;
            }
            // 检查 config 对象中是否存在 universityNameEn 属性
            if (config.universityNameEn) {
                // 如果存在，则设置 id 为 universityNameEn 的输入框的值
                document.getElementById('universityNameEn').value = config.universityNameEn;
            }
            // --- 功能新增结束 ---

            loadTemplateCSS(templateId);

            selectors.commonInfoSection.classList.remove('hidden');
            selectors.actionButtons.classList.remove('hidden');

            for (const [docId, docInfo] of Object.entries(config.documents)) {
                if (docInfo.available) {
                    const button = document.createElement('button');
                    button.className = 'doc-type-btn';
                    button.textContent = docInfo.name;
                    button.dataset.docId = docId;
                    selectors.documentSelector.appendChild(button);
                }
            }
        } catch (error) {
            console.error(`加载模板 ${templateId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载模板失败。</div>`;
        }
    }
    
    // 3. 加载选定的文档
    async function loadDocument(docId) {
        if (state.currentDocument === docId) {
            return;
        }
        state.currentDocument = docId;

        document.querySelectorAll('.doc-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.docId === docId);
        });

        try {
            const response = await fetch(`templates/${state.currentTemplate}/${docId}.html`);
            if (!response.ok) {
                throw new Error(`无法加载 ${docId}.html`);
            }
            const htmlContent = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            const formSnippet = doc.getElementById('form-snippet')?.innerHTML || '';
            const previewSnippet = doc.getElementById('preview-snippet')?.innerHTML || '';

            selectors.docFormContainer.innerHTML = formSnippet;
            selectors.previewContainer.innerHTML = previewSnippet;

            updatePreview();
            bindFormEvents();

        } catch (error) {
            console.error(`加载文档 ${docId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载文档失败。</div>`;
        }
    }

    // 4. 更新预览
    function updatePreview() {
        if (!state.currentTemplate || !state.currentDocument) {
            return;
        }

        const inputs = document.querySelectorAll('.control-panel [data-bind-to]');
        inputs.forEach(input => {
            const bindKey = input.dataset.bindTo;
            const previewElements = document.querySelectorAll(`[data-preview-id="${bindKey}"]`);
            
            previewElements.forEach(el => {
                if (input.type === 'file') {
                    const imgElement = el;
                    const container = imgElement.parentElement;
                    const placeholderElement = container ? container.querySelector('.placeholder') : null;

                    if (input.files && input.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            imgElement.src = e.target.result;
                            imgElement.style.display = 'block';
                            if (placeholderElement) {
                                placeholderElement.style.display = 'none';
                            }
                        };
                        reader.readAsDataURL(input.files[0]);
                    } else {
                        imgElement.src = '';
                        imgElement.style.display = 'none';
                        if (placeholderElement) {
                             placeholderElement.style.display = 'flex';
                        }
                    }
                } else if (input.type === 'date') {
                    el.textContent = formatDate(input.value) || '____-__-__';
                } else {
                    const suffix = el.dataset.suffix || '';
                    el.textContent = input.value + suffix;
                }
            });
        });
    }

    // 5. 事件绑定
    function bindFormEvents() {
        const inputs = document.querySelectorAll('.control-panel input, .control-panel select, .control-panel textarea');
        inputs.forEach(input => {
            input.addEventListener('input', updatePreview);
            input.addEventListener('change', updatePreview); 
        });
    }

    selectors.templateSelector.addEventListener('change', (e) => loadTemplate(e.target.value));
    
    selectors.documentSelector.addEventListener('click', (e) => {
        if (e.target.matches('.doc-type-btn')) {
            loadDocument(e.target.dataset.docId);
        }
    });

    selectors.previewBtn.addEventListener('click', updatePreview);

    selectors.printBtn.addEventListener('click', () => {
        updatePreview();
        window.print();
    });

    // 6. 辅助函数
    function resetUI(isTemplateLoading = false) {
        state.currentDocument = null;
        selectors.documentSelector.innerHTML = '';
        selectors.docFormContainer.innerHTML = '';
        if (!isTemplateLoading) {
            state.currentTemplate = null;
            selectors.commonInfoSection.classList.add('hidden');
            selectors.actionButtons.classList.add('hidden');
            selectors.previewContainer.innerHTML = '<div class="placeholder-text">请先选择一个模板和证件类型</div>';
            removeTemplateCSS();
        }
    }

    function loadTemplateCSS(templateId) {
        removeTemplateCSS();
        const link = document.createElement('link');
        link.id = 'template-styles';
        link.rel = 'stylesheet';
        link.href = `templates/${templateId}/style.css`;
        document.head.appendChild(link);
    }

    function removeTemplateCSS() {
        const existingLink = document.getElementById('template-styles');
        if (existingLink) {
            existingLink.remove();
        }
    }
    
    function formatDate(dateString) {
        if (!dateString) {
            return '';
        }
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }

    // 启动应用
    initialize();
});