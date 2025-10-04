document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentTemplate: null,
        currentDocument: null,
        config: null,
        // (*** 新增 ***) "管家"对象：用于缓存需要跨页面保留状态的动态输入框
        dynamicInputs: {},
    };

    const selectors = {
        templateSelector: document.getElementById('template-selector'),
        mainContentArea: document.getElementById('main-content-area'),
        documentSelector: document.getElementById('document-selector'),
        docFormContainer: document.getElementById('document-form-container'),
        previewContainer: document.getElementById('preview-container'),
        // --- (*** 新增 ***) ---
        // 获取预览区域的 DOM 元素，用于计算缩放比例
        previewArea: document.querySelector('.preview-area'),
        printBtn: document.getElementById('print-btn'),
        previewBtn: document.getElementById('preview-btn'),
    };

    // 1. 初始化
    async function initialize() {
        try {
            showToast({
                message: '<strong>风险提醒：</strong>本工具仅供学习和技术测试使用，请勿用于非法用途。使用本工具造成的任何后果由使用者自行承担。',
                type: 'warning',
                persistent: true
            });

            const response = await fetch('/templates/manifest.json');
            if (!response.ok) throw new Error('无法加载模板清单 manifest.json');
            const manifest = await response.json();
            
            manifest.templates.forEach(template => {
                selectors.templateSelector.appendChild(new Option(template.name, template.id));
            });
            
            bindFormEvents();
            setupCustomFileUploads(document.body);

            // --- (*** 新增 ***) ---
            // 添加窗口大小变化的监听器，当用户调整浏览器窗口时，重新计算缩放
            window.addEventListener('resize', updatePreviewScaling);

        } catch (error) {
            console.error('初始化失败:', error);
            showToast({ message: `初始化失败: ${error.message}`, type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：${error.message}</div>`;
        }
    }

    // 2. 加载模板
    async function loadTemplate(templateId) {
        if (!templateId) {
            resetUI();
            return;
        }
        state.currentTemplate = templateId;
        resetUI(true);

        try {
            const response = await fetch(`/templates/${templateId}/config.json`);
            if (!response.ok) throw new Error('无法加载 config.json');
            state.config = await response.json();

            populateForm(document.body, state.config.universityInfo);
            populateForm(document.body, state.config.studentInfoDefaults);

            loadTemplateCSS(templateId);
            selectors.mainContentArea.classList.remove('hidden');

            const selectedTemplateName = selectors.templateSelector.options[selectors.templateSelector.selectedIndex].text;
            showToast({
                message: `已选择模板：${selectedTemplateName}。<br>请完善信息后选择证件类型。`,
                type: 'success'
            });

            selectors.documentSelector.innerHTML = '';
            for (const [docId, docInfo] of Object.entries(state.config.documents)) {
                if (docInfo.available) {
                    const button = document.createElement('button');
                    button.className = 'doc-type-btn';
                    button.textContent = docInfo.name;
                    button.dataset.docId = docId;
                    selectors.documentSelector.appendChild(button);
                }
            }
            const firstDoc = document.querySelector('.doc-type-btn');
            if(firstDoc) {
                loadDocument(firstDoc.dataset.docId);
            } else {
                updateAll();
            }

        } catch (error) {
            console.error(`加载模板 ${templateId} 失败:`, error);
            showToast({ message: '错误：加载模板失败。', type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载模板失败。</div>`;
            state.config = null;
        }
    }
    
    // 3. 加载文档
    async function loadDocument(docId) {
        if (state.currentDocument === docId && selectors.docFormContainer.innerHTML !== '') return;
        
        // (*** 已修改 ***) 核心修复：在移除旧表单前，让"管家"记住里面的文件输入框
        selectors.docFormContainer.querySelectorAll('input[type="file"]').forEach(input => {
            // 只有当用户确实选择了文件时，才进行缓存
            if (input.files && input.files.length > 0) {
                state.dynamicInputs[input.id] = input;
            }
        });

        state.currentDocument = docId;

        document.querySelectorAll('.doc-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.docId === docId);
        });

        try {
            const response = await fetch(`/templates/${state.currentTemplate}/${docId}.html`);
            if (!response.ok) throw new Error(`无法加载 ${docId}.html`);
            const htmlContent = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            selectors.docFormContainer.innerHTML = doc.getElementById('form-snippet')?.innerHTML || '';
            selectors.previewContainer.innerHTML = doc.getElementById('preview-snippet')?.innerHTML || '';
            
            // (*** 已修改 ***) 核心修复：加载新表单后，检查"管家"有没有存货
            selectors.docFormContainer.querySelectorAll('input[type="file"]').forEach(newInput => {
                // 如果管家记住了这个ID的输入框，就用缓存的旧框替换掉新的空框
                if (state.dynamicInputs[newInput.id]) {
                    newInput.parentNode.replaceChild(state.dynamicInputs[newInput.id], newInput);
                }
            });

            setupCustomFileUploads(selectors.docFormContainer);

            if (state.config.documents[docId]?.defaults) {
                populateForm(selectors.docFormContainer, state.config.documents[docId].defaults);
            }
            
            updateAll();

            const docName = state.config.documents[docId].name;
            showToast({ message: `已生成 ${docName} 预览。`, type: 'info' });

        } catch (error) { 
            console.error(`加载文档 ${docId} 失败:`, error);
            showToast({ message: `错误：加载文档 ${docId} 失败。`, type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载文档失败。<br><pre>${error.stack}</pre></div>`;
        }
    }

    // 4. 更新所有预览
    function updateAll() {
        if (!state.currentTemplate) return;
        updateCalculatedFields();
        updatePreview();
        // --- (*** 新增 ***) ---
        // 每次更新内容后，都调用缩放函数，以确保预览大小正确
        updatePreviewScaling();
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
    function bindFormEvents() {
        selectors.mainContentArea.addEventListener('input', updateAll);
        selectors.mainContentArea.addEventListener('change', updateAll);
    }

    selectors.templateSelector.addEventListener('change', (e) => loadTemplate(e.target.value));
    selectors.documentSelector.addEventListener('click', (e) => {
        if (e.target.matches('.doc-type-btn')) loadDocument(e.target.dataset.docId);
    });
    
    selectors.previewBtn.addEventListener('click', () => {
        updateAll();
        showToast({ message: '预览已更新', type: 'success', duration: 2500 });
    });
    selectors.printBtn.addEventListener('click', () => {
        // --- (*** 已修改 ***) ---
        // 打印前，暂时移除所有预览元素的缩放，确保打印的是原始大小
        const previewEls = selectors.previewContainer.children;
        for (const el of previewEls) {
            if (el) {
                // 使用内联样式清除 transform
                el.style.transform = 'none';
            }
        }

        updateAll(); // 重新运行更新以确保内容最新
        showToast({ message: '正在准备打印...', type: 'info', duration: 2500 });
        
        setTimeout(() => {
            window.print();
            // 打印后，恢复缩放
            updatePreviewScaling();
        }, 100);
    });

    // 8. 辅助函数

    // --- (*** 已修改 ***) ---
    // 核心功能：更新预览区的缩放比例
    function updatePreviewScaling() {
        const area = selectors.previewArea;
        const container = selectors.previewContainer;

        if (!container || !area) return;

        // 获取预览容器中所有的直接子元素
        const previewEls = Array.from(container.children);
        
        // 如果没有可预览的元素，就直接返回
        if (previewEls.length === 0) return;

        // 检查是否存在占位符文本，如果是，则不进行缩放
        const placeholder = container.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.style.transform = 'none';
            return;
        }

        // 核心逻辑修改：
        // 当预览内容只有一个子元素时（例如单个证书），我们采用JS动态计算缩放。
        // 当有多个子元素时（例如学生证正反面+标题），我们则依赖CSS媒体查询进行响应式缩放，
        // 此时只需清除JS可能添加的内联transform样式即可。
        if (previewEls.length === 1) {
            const previewEl = previewEls[0];
            
            // 先重置 transform，以获取元素的原始（无缩放）尺寸
            previewEl.style.transform = 'none';

            const areaWidth = area.clientWidth;
            const areaHeight = area.clientHeight;

            const elWidth = previewEl.offsetWidth;
            const elHeight = previewEl.offsetHeight;

            // 如果元素没有尺寸，则不进行计算
            if (elWidth === 0 || elHeight === 0) return;

            // 计算宽度和高度方向上的缩放比例
            const scaleX = areaWidth / elWidth;
            const scaleY = areaHeight / elHeight;

            // 取两个比例中较小的一个，作为最终的缩放比例，以保证整个元素都能被看见
            // 同时减去一个很小的值 (0.05) 作为边距，避免元素紧贴边缘
            const scale = Math.min(scaleX, scaleY) - 0.05;

            // 应用计算出的缩放比例
            previewEl.style.transform = `scale(${scale > 0 ? scale : 1})`;
        } else {
            // 对于多元素预览（如学生证），清除JS设置的transform，让CSS来控制
            previewEls.forEach(el => {
                el.style.transform = ''; // 移除内联样式，让CSS规则生效
            });
        }
    }

    function resetUI(isTemplateLoading = false) {
        state.currentDocument = null;
        selectors.documentSelector.innerHTML = '';
        selectors.docFormContainer.innerHTML = '';
        if (!isTemplateLoading) {
            state.currentTemplate = null;
            state.config = null;
            selectors.previewContainer.innerHTML = '<div class="placeholder-text">请先选择一个模板和证件类型</div>';
            selectors.mainContentArea.classList.add('hidden');
            
            // (*** 已修改 ***) 当我们彻底切换模板时，需要清空"管家"的缓存
            state.dynamicInputs = {};

            document.querySelectorAll('#common-info-section input, #common-student-section input').forEach(input => {
                if (input.type === 'file') {
                    const newInput = input.cloneNode(true);
                    input.parentNode.replaceChild(newInput, input);
                } else {
                    input.value = '';
                }
            });
            removeTemplateCSS();
        }
        // --- (*** 新增 ***) ---
        // 重置UI时，也要确保预览缩放被重置
        updatePreviewScaling();
    }
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
        link.href = `/templates/${templateId}/style.css`;
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

    function setupCustomFileUploads(container) {
        const fileUploads = container.querySelectorAll('.custom-file-upload');
        
        fileUploads.forEach(upload => {
            const fileInput = upload.querySelector('input[type="file"]');
            const fileChosenText = upload.querySelector('.file-chosen-text');

            if (fileInput && fileChosenText) {
                fileInput.removeEventListener('change', handleFileChange);
                fileInput.addEventListener('change', handleFileChange);
            }
        });
    }

    function handleFileChange() {
        const fileInput = this;
        const parentUpload = fileInput.closest('.custom-file-upload');
        const fileChosenText = parentUpload.querySelector('.file-chosen-text');

        if (fileInput.files && fileInput.files.length > 0) {
            fileChosenText.textContent = fileInput.files[0].name;
            
            const bindKey = fileInput.dataset.bindTo;
            const isLogo = bindKey === 'logo';
            const toastMessage = isLogo ? '学校Logo已更新' : '学生照片已更新';
            showToast({ message: toastMessage, type: 'info', duration: 2500 });

        } else {
            fileChosenText.textContent = '未选择文件';
        }
    }

    // 启动应用
    initialize();
});