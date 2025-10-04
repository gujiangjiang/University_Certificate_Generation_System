document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentTemplate: null,
        currentDocument: null,
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

    // 1. 初始化：加载模板清单
    async function initialize() {
        try {
            const response = await fetch('templates/manifest.json');
            if (!response.ok) {
                throw new Error('无法加载模板清单 manifest.json');
            }
            const manifest = await response.json();
            
            manifest.templates.forEach(template => {
                const option = new Option(template.name, template.id);
                selectors.templateSelector.appendChild(option);
            });
            
            bindCommonFormEvents();

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
            
            document.getElementById('universityName').value = config.universityName || '';
            document.getElementById('universityNameEn').value = config.universityNameEn || '';
            
            loadTemplateCSS(templateId);

            selectors.commonInfoSection.classList.remove('hidden');
            selectors.commonStudentSection.classList.remove('hidden');
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
            updateAll(); 
        } catch (error) {
            console.error(`加载模板 ${templateId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载模板失败。</div>`;
        }
    }
    
    // 3. 加载选定的文档
    async function loadDocument(docId) {
        if (state.currentDocument === docId) return;
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

            bindDocumentFormEvents();
            updateAll();

        } catch (error) {
            console.error(`加载文档 ${docId} 失败:`, error);
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载文档失败。<br><pre>${error.stack}</pre></div>`;
        }
    }

    // 4. 更新所有预览（包括计算字段和常规字段）
    function updateAll() {
        if (!state.currentTemplate) return;
        updateCalculatedFields();
        updatePreview();
    }

    // 5. 更新常规预览（读取所有 data-bind-to 的值）
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

    // 6. 更新所有自动计算的字段
    function updateCalculatedFields() {
        const enrollmentDateVal = document.getElementById('enrollmentDate')?.value;
        const studyPeriod = parseInt(document.getElementById('studyPeriod')?.value, 10);
        const universityName = document.getElementById('universityName')?.value || 'университета'; // 提供一个默认值

        if (enrollmentDateVal) {
            const startDate = new Date(enrollmentDateVal.replace(/-/g, '/'));
            const year = startDate.getFullYear();
            const academicYear = `${year}-${year + 1}`;
            
            document.querySelectorAll('[data-preview-id="academicYear"]').forEach(el => {
                el.textContent = el.textContent.includes('-') ? academicYear : year;
            });
            document.querySelectorAll('[data-preview-id="enrollYear"]').forEach(el => el.textContent = year);
            document.querySelectorAll('[data-preview-id="issueDate"]').forEach(el => el.textContent = formatDate(startDate));

            if (studyPeriod) {
                const endDate = new Date(startDate.setFullYear(startDate.getFullYear() + studyPeriod));
                document.querySelectorAll('[data-preview-id="validDate"]').forEach(el => el.textContent = formatDate(endDate));
            }
        }
        
        // --- 核心修复：确保两处大学名称都被正确替换 ---
        const noticePreviewElement = document.querySelector('[data-preview-id="notice"]');
        if (noticePreviewElement) {
            const noticeText = `Эта карта является собственностью ${universityName} и должна быть возвращена по требованию. В случае находки, пожалуйста, верните в ближайший офис ${universityName}.`;
            noticePreviewElement.textContent = noticeText;
        }
    }
    
    // 7. 事件绑定
    function bindCommonFormEvents() {
        const commonForms = [selectors.commonInfoSection, selectors.commonStudentSection];
        commonForms.forEach(form => {
            form.addEventListener('input', updateAll);
            form.addEventListener('change', updateAll);
        });
    }

    function bindDocumentFormEvents() {
        const inputs = selectors.docFormContainer.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', updateAll);
            input.addEventListener('change', updateAll);
        });
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
            selectors.commonInfoSection.classList.add('hidden');
            selectors.commonStudentSection.classList.add('hidden');
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
        document.getElementById('template-styles')?.remove();
    }
    
    function formatDate(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date.replace(/-/g, '/'));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 启动应用
    initialize();
});