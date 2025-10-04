document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentTemplate: null,
        currentDocument: null,
        config: null, // 用于存储加载的模板配置
    };

    const selectors = {
        templateSelector: document.getElementById('template-selector'),
        commonInfoSection: document.getElementById('common-info-section'),
        commonStudentSection: document.getElementById('common-student-section'),
        documentSelector: document.getElementById('document-selector'),
        docFormContainer: document.getElementById('document-form-container'),
        previewContainer: document.getElementById('preview-container'),
        actionButtons: document.getElementById('action-buttons'),
        printBtn: document.getElementById('print-btn'),
        previewBtn: document.getElementById('preview-btn'),
    };

    // 1. 初始化
    async function initialize() {
        try {
            const response = await fetch('templates/manifest.json');
            if (!response.ok) throw new Error('无法加载模板清单 manifest.json');
            const manifest = await response.json();
            
            manifest.templates.forEach(template => {
                selectors.templateSelector.appendChild(new Option(template.name, template.id));
            });
            
            bindCommonFormEvents();
        } catch (error) {
            console.error('初始化失败:', error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：${error.message}</div>`;
        }
    }

    // 2. 加载模板 (核心重构)
    async function loadTemplate(templateId) {
        if (!templateId) {
            resetUI();
            return;
        }
        state.currentTemplate = templateId;
        resetUI(true);

        try {
            const response = await fetch(`templates/${templateId}/config.json`);
            if (!response.ok) throw new Error('无法加载 config.json');
            state.config = await response.json(); // 保存配置

            // 使用配置填充通用表单
            populateForm(document.body, state.config.universityInfo);
            populateForm(document.body, state.config.studentInfoDefaults);

            loadTemplateCSS(templateId);

            // 动态显示通用信息模块
            selectors.commonInfoSection.classList.remove('hidden');
            selectors.commonStudentSection.classList.remove('hidden');
            selectors.actionButtons.classList.remove('hidden');

            // 创建文档选择按钮
            selectors.documentSelector.innerHTML = ''; // 清空旧按钮
            for (const [docId, docInfo] of Object.entries(state.config.documents)) {
                if (docInfo.available) {
                    const button = document.createElement('button');
                    button.className = 'doc-type-btn';
                    button.textContent = docInfo.name;
                    button.dataset.docId = docId;
                    selectors.documentSelector.appendChild(button);
                }
            }
            // 初始加载时，如果默认有文档，则加载第一个
            const firstDoc = document.querySelector('.doc-type-btn');
            if(firstDoc) {
                loadDocument(firstDoc.dataset.docId);
            } else {
                updateAll();
            }

        } catch (error) {
            console.error(`加载模板 ${templateId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载模板失败。</div>`;
            state.config = null;
        }
    }
    
    // 3. 加载文档 (核心重构)
    async function loadDocument(docId) {
        if (state.currentDocument === docId && selectors.docFormContainer.innerHTML !== '') return;
        state.currentDocument = docId;

        document.querySelectorAll('.doc-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.docId === docId);
        });

        try {
            const response = await fetch(`templates/${state.currentTemplate}/${docId}.html`);
            if (!response.ok) throw new Error(`无法加载 ${docId}.html`);
            const htmlContent = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            selectors.docFormContainer.innerHTML = doc.getElementById('form-snippet')?.innerHTML || '';
            selectors.previewContainer.innerHTML = doc.getElementById('preview-snippet')?.innerHTML || '';

            // 使用配置填充文档特定表单
            if (state.config.documents[docId]?.defaults) {
                populateForm(selectors.docFormContainer, state.config.documents[docId].defaults);
            }

            bindDocumentFormEvents();
            updateAll();

        } catch (error) {
            console.error(`加载文档 ${docId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载文档失败。<br><pre>${error.stack}</pre></div>`;
        }
    }

    // 4. 更新所有预览
    function updateAll() {
        if (!state.currentTemplate) return;
        updateCalculatedFields();
        updatePreview();
    }

    // 5. 更新常规预览
    function updatePreview() {
        const inputs = document.querySelectorAll('.control-panel [data-bind-to]');
        inputs.forEach(input => {
            const bindKey = input.dataset.bindTo;
            const previewElements = document.querySelectorAll(`[data-preview-id="${bindKey}"]`);
            
            previewElements.forEach(el => {
                if (input.type === 'file') {
                    const imgElement = el;
                    const container = imgElement.parentElement;
                    const placeholder = container?.querySelector('.placeholder');

                    if (input.files && input.files[0]) {
                        const reader = new FileReader();
                        reader.onload = e => {
                            imgElement.src = e.target.result;
                            imgElement.style.display = 'block';
                            if (placeholder) placeholder.style.display = 'none';
                        };
                        reader.readAsDataURL(input.files[0]);
                    } else {
                        imgElement.src = '';
                        imgElement.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'flex';
                    }
                } else if (input.type === 'date') {
                    el.textContent = formatDate(input.value);
                } else {
                    const suffix = el.dataset.suffix || '';
                    el.textContent = (input.value || '') + suffix;
                }
            });
        });
    }

    // 6. 更新计算字段
    function updateCalculatedFields() {
        const enrollmentDateVal = document.getElementById('enrollmentDate')?.value;
        const studyPeriod = parseInt(document.getElementById('studyPeriod')?.value, 10);
        const universityName = document.getElementById('universityName')?.value || 'университета';

        if (enrollmentDateVal) {
            const startDate = new Date(enrollmentDateVal.replace(/-/g, '/'));
            const year = startDate.getFullYear();
            const academicYear = `${year}-${year + 1}`;
            
            document.querySelectorAll('[data-preview-id="academicYear"]').forEach(el => {
                 el.textContent = el.dataset.fullYear ? academicYear : year;
            });
            document.querySelectorAll('[data-preview-id="enrollYear"]').forEach(el => el.textContent = year);
            document.querySelectorAll('[data-preview-id="issueDate"]').forEach(el => el.textContent = formatDate(startDate));

            if (!isNaN(studyPeriod)) {
                // 创建一个新的日期对象进行计算，避免修改原始的startDate
                const endDate = new Date(startDate);
                endDate.setFullYear(endDate.getFullYear() + studyPeriod);
                document.querySelectorAll('[data-preview-id="validDate"]').forEach(el => el.textContent = formatDate(endDate));
            }
        }
        
        const noticePreviewElement = document.querySelector('[data-preview-id="notice"]');
        if (noticePreviewElement) {
            const noticeText = `Эта карта является собственностью ${universityName} и должна быть возвращена по требованию. В случае находки, пожалуйста, верните в ближайший офис ${universityName}.`;
            noticePreviewElement.textContent = noticeText;
        }
    }
    
    // 7. 事件绑定
    function bindCommonFormEvents() {
        [selectors.commonInfoSection, selectors.commonStudentSection].forEach(form => {
            form.addEventListener('input', updateAll);
            form.addEventListener('change', updateAll);
        });
    }

    function bindDocumentFormEvents() {
        selectors.docFormContainer.addEventListener('input', updateAll);
        selectors.docFormContainer.addEventListener('change', updateAll);
    }

    selectors.templateSelector.addEventListener('change', (e) => loadTemplate(e.target.value));
    selectors.documentSelector.addEventListener('click', (e) => {
        if (e.target.matches('.doc-type-btn')) loadDocument(e.target.dataset.docId);
    });
    selectors.previewBtn.addEventListener('click', updateAll);
    selectors.printBtn.addEventListener('click', () => {
        updateAll();
        window.print();
    });

    // 8. 辅助函数
    function resetUI(isTemplateLoading = false) {
        state.currentDocument = null;
        selectors.documentSelector.innerHTML = '';
        selectors.docFormContainer.innerHTML = '';
        if (!isTemplateLoading) {
            state.currentTemplate = null;
            state.config = null;
            selectors.previewContainer.innerHTML = '<div class="placeholder-text">请先选择一个模板和证件类型</div>';
            // 隐藏通用模块
            selectors.commonInfoSection.classList.add('hidden');
            selectors.commonStudentSection.classList.add('hidden');
            selectors.actionButtons.classList.add('hidden');
            // 清空通用表单
            document.querySelectorAll('#common-info-section input, #common-student-section input').forEach(input => {
                if (input.type === 'file') {
                    // 创建一个新的文件输入框来重置
                    const newInput = input.cloneNode(true);
                    input.parentNode.replaceChild(newInput, input);
                } else {
                    input.value = '';
                }
            });
            removeTemplateCSS();
        }
    }

    // 新增：通用表单填充函数
    function populateForm(container, data) {
        if (!data) return;
        for (const [key, value] of Object.entries(data)) {
            const input = container.querySelector(`#${key}`);
            if (input) {
                input.value = value;
            }
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
        document.getElementById('template-styles')?.remove();
    }
    
    function formatDate(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(String(date).replace(/-/g, '/'));
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 启动应用
    initialize();
});
