// (*** 文件已全面重构以支持国家->大学的二级选择逻辑 ***)
document.addEventListener('DOMContentLoaded', () => {
    // 全局状态管理对象
    const state = {
        manifest: null, // 存储加载的 manifest.json 内容
        currentCountryId: null, // 当前选择的国家ID
        currentUniversityId: null, // 当前选择的大学ID (即模板ID)
        currentDocument: null, // 当前选择的文档类型 (如录取通知书)
        config: null, // 当前模板的配置信息
        dynamicInputs: {}, // 用于缓存跨文档切换时需要保留的文件输入框
    };

    // DOM元素选择器缓存
    const selectors = {
        countrySelector: document.getElementById('country-selector'),
        universitySelector: document.getElementById('university-selector'),
        mainContentArea: document.getElementById('main-content-area'),
        documentSelector: document.getElementById('document-selector'),
        docFormContainer: document.getElementById('document-form-container'),
        previewContainer: document.getElementById('preview-container'),
        previewArea: document.querySelector('.preview-area'),
        printBtn: document.getElementById('print-btn'),
        previewBtn: document.getElementById('preview-btn'),
    };

    // 1. 初始化函数 - 应用启动入口
    async function initialize() {
        try {
            // 显示风险提示
            showToast({
                message: '<strong>风险提醒：</strong>本工具仅供学习和技术测试使用，请勿用于非法用途。使用本工具造成的任何后果由使用者自行承担。',
                type: 'warning',
                persistent: true
            });

            // 加载模板清单 (manifest.json)
            const response = await fetch('/templates/manifest.json');
            if (!response.ok) throw new Error('无法加载模板清单 manifest.json');
            state.manifest = await response.json();
            
            // 填充国家选择框
            populateCountrySelector();
            
            // 绑定所有需要的事件监听器
            bindEventListeners();
            setupCustomFileUploads(document.body);

            // 监听窗口大小变化，用于实时调整预览缩放
            window.addEventListener('resize', updatePreviewScaling);

        } catch (error) {
            console.error('初始化失败:', error);
            showToast({ message: `初始化失败: ${error.message}`, type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：${error.message}</div>`;
        }
    }

    // 2. 填充国家选择框
    function populateCountrySelector() {
        if (!state.manifest || !state.manifest.countries) return;
        
        // 清空现有选项
        selectors.countrySelector.innerHTML = '<option value="">请先选择一个国家...</option>';
        
        // 遍历清单中的国家并添加到选择框
        state.manifest.countries.forEach(country => {
            selectors.countrySelector.appendChild(new Option(country.name, country.id));
        });
    }

    // 3. 根据选择的国家填充大学选择框
    function populateUniversitySelector(countryId) {
        state.currentCountryId = countryId;
        const uniSelector = selectors.universitySelector;
        
        // 清空并禁用大学选择框
        uniSelector.innerHTML = '<option value="">请先选择一所大学...</option>';
        uniSelector.disabled = true;

        if (!countryId) {
            resetUI(false); // 如果国家被取消选择，重置UI
            return;
        }

        // 在清单中找到对应的国家
        const country = state.manifest.countries.find(c => c.id === countryId);
        if (country && country.universities) {
            // 填充大学选项
            country.universities.forEach(uni => {
                uniSelector.appendChild(new Option(uni.name, uni.id));
            });
            // 启用大学选择框
            uniSelector.disabled = false;
        }
    }
    
    // 4. 加载大学模板 (核心功能)
    async function loadUniversityTemplate(universityId) {
        if (!universityId || !state.currentCountryId) { // (*** 修改点 ***) 确保国家ID也存在
            resetUI();
            return;
        }
        state.currentUniversityId = universityId;
        resetUI(true); // 部分重置UI，保留已填写的通用信息

        try {
            // (*** 修改点 ***) 构建新的、包含国家和大学层级的路径来加载配置文件
            const configPath = `/templates/${state.currentCountryId}/${universityId}/config.json`;
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`无法加载模板配置文件： ${configPath}`);
            state.config = await response.json();

            // 填充通用大学信息和通用学生信息
            populateForm(document.body, state.config.universityInfo);
            populateForm(document.body, state.config.studentInfoDefaults);

            // 加载模板专属的CSS样式
            loadTemplateCSS(universityId);
            selectors.mainContentArea.classList.remove('hidden');

            const selectedUniversityName = selectors.universitySelector.options[selectors.universitySelector.selectedIndex].text;
            showToast({
                message: `已选择模板：${selectedUniversityName}。<br>请完善信息后选择证件类型。`,
                type: 'success'
            });

            // 根据配置文件生成可选择的文档按钮 (如学生证、在读证明等)
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
            
            // 自动加载第一个可用的文档类型
            const firstDoc = document.querySelector('.doc-type-btn');
            if(firstDoc) {
                loadDocument(firstDoc.dataset.docId);
            } else {
                updateAll(); // 如果没有可加载的文档，也刷新一次预览
            }

        } catch (error) {
            console.error(`加载模板 ${universityId} 失败:`, error);
            showToast({ message: '错误：加载模板失败。', type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载模板失败。</div>`;
            state.config = null;
        }
    }
    
    // 5. 加载具体的文档HTML片段 (表单 + 预览)
    async function loadDocument(docId) {
        // 如果点击的是当前已加载的文档，则不重复加载
        if (state.currentDocument === docId && selectors.docFormContainer.innerHTML !== '') return;
        
        // 核心修复：在移除旧表单前，缓存已选择的文件输入框，防止切换文档时丢失
        selectors.docFormContainer.querySelectorAll('input[type="file"]').forEach(input => {
            if (input.files && input.files.length > 0) {
                state.dynamicInputs[input.id] = input;
            }
        });

        state.currentDocument = docId;

        // 更新文档按钮的激活状态
        document.querySelectorAll('.doc-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.docId === docId);
        });

        try {
            // (*** 修改点 ***) 构建新的、包含国家和大学层级的路径来加载文档HTML文件
            const docPath = `/templates/${state.currentCountryId}/${state.currentUniversityId}/${docId}.html`;
            const response = await fetch(docPath);
            if (!response.ok) throw new Error(`无法加载文档： ${docPath}`);
            const htmlContent = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');

            // 将HTML中的表单片段和预览片段注入到页面相应位置
            selectors.docFormContainer.innerHTML = doc.getElementById('form-snippet')?.innerHTML || '';
            selectors.previewContainer.innerHTML = doc.getElementById('preview-snippet')?.innerHTML || '';
            
            // 核心修复：加载新表单后，检查缓存中是否有同ID的文件输入框，如有则替换
            selectors.docFormContainer.querySelectorAll('input[type="file"]').forEach(newInput => {
                if (state.dynamicInputs[newInput.id]) {
                    newInput.parentNode.replaceChild(state.dynamicInputs[newInput.id], newInput);
                }
            });

            // 为新加载的表单片段中的文件上传按钮绑定事件
            setupCustomFileUploads(selectors.docFormContainer);

            // 如果该文档有默认值，则填充表单
            if (state.config.documents[docId]?.defaults) {
                populateForm(selectors.docFormContainer, state.config.documents[docId].defaults);
            }
            
            // 全面更新预览
            updateAll();

            const docName = state.config.documents[docId].name;
            showToast({ message: `已生成 ${docName} 预览。`, type: 'info' });

        } catch (error) { 
            console.error(`加载文档 ${docId} 失败:`, error);
            showToast({ message: `错误：加载文档 ${docId} 失败。`, type: 'warning' });
            selectors.previewContainer.innerHTML = `<div class="placeholder-text">错误：加载文档失败。<br><pre>${error.stack}</pre></div>`;
        }
    }

    // 6. 绑定所有事件监听器
    function bindEventListeners() {
        // 监听国家选择框的变化
        selectors.countrySelector.addEventListener('change', (e) => {
            populateUniversitySelector(e.target.value);
            loadUniversityTemplate(null); // 清空之前的模板
        });

        // 监听大学选择框的变化
        selectors.universitySelector.addEventListener('change', (e) => {
            loadUniversityTemplate(e.target.value);
        });

        // 监听文档类型按钮的点击 (事件委托)
        selectors.documentSelector.addEventListener('click', (e) => {
            if (e.target.matches('.doc-type-btn')) {
                loadDocument(e.target.dataset.docId);
            }
        });

        // 监听整个控制面板的输入和变化事件，实时更新预览
        selectors.mainContentArea.addEventListener('input', updateAll);
        selectors.mainContentArea.addEventListener('change', updateAll);
        
        // 更新预览按钮
        selectors.previewBtn.addEventListener('click', () => {
            updateAll();
            showToast({ message: '预览已更新', type: 'success', duration: 2500 });
        });

        // 打印按钮
        selectors.printBtn.addEventListener('click', () => {
            // 打印前，暂时移除所有预览元素的缩放，确保打印的是原始大小
            const previewEls = selectors.previewContainer.children;
            for (const el of previewEls) {
                if (el) {
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
    }

    // 7. 更新所有预览的入口函数
    function updateAll() {
        if (!state.currentUniversityId) return;
        updateCalculatedFields(); // 首先更新需要计算的字段
        updatePreview(); // 然后更新所有普通字段
        updatePreviewScaling(); // 最后调整预览区的缩放
    }

    // 8. 更新预览 (将表单数据同步到预览区)
    function updatePreview() {
        const inputs = document.querySelectorAll('.control-panel [data-bind-to]');
        inputs.forEach(input => {
            const bindKey = input.dataset.bindTo;
            const previewElements = document.querySelectorAll(`[data-preview-id="${bindKey}"]`);
            
            previewElements.forEach(el => {
                if (input.type === 'file') { // 处理文件/图片
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
                } else if (input.type === 'date') { // 处理日期
                    el.textContent = formatDate(input.value);
                } else { // 处理普通文本
                    const suffix = el.dataset.suffix || '';
                    el.textContent = (input.value || '') + suffix;
                }
            });
        });
    }

    // 9. 更新需要通过计算得出的字段 (如有效期、学年等)
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
    
    // 10. 辅助函数区

    // 动态更新预览区的缩放，使其适应容器大小
    function updatePreviewScaling() {
        const area = selectors.previewArea;
        const container = selectors.previewContainer;
        if (!container || !area) return;

        const previewEls = Array.from(container.children);
        if (previewEls.length === 0) return;

        const placeholder = container.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.style.transform = 'none';
            return;
        }
        
        // 核心逻辑：当预览内容只有一个子元素（如证书），通过JS动态计算缩放
        // 当有多个子元素时（如学生证正反面），清除JS设置的样式，让CSS媒体查询来控制
        if (previewEls.length === 1) {
            const previewEl = previewEls[0];
            previewEl.style.transform = 'none'; // 先重置以获取原始尺寸
            const areaWidth = area.clientWidth;
            const areaHeight = area.clientHeight;
            const elWidth = previewEl.offsetWidth;
            const elHeight = previewEl.offsetHeight;

            if (elWidth === 0 || elHeight === 0) return;

            const scaleX = areaWidth / elWidth;
            const scaleY = areaHeight / elHeight;
            const scale = Math.min(scaleX, scaleY) - 0.05; // 取较小比例并留出边距
            previewEl.style.transform = `scale(${scale > 0 ? scale : 1})`;
        } else {
            previewEls.forEach(el => {
                el.style.transform = ''; // 清除内联transform，让CSS生效
            });
        }
    }

    // 重置UI界面
    function resetUI(isTemplateLoading = false) {
        state.currentDocument = null;
        selectors.documentSelector.innerHTML = '';
        selectors.docFormContainer.innerHTML = '';
        if (!isTemplateLoading) {
            state.currentUniversityId = null;
            state.config = null;
            selectors.previewContainer.innerHTML = '<div class="placeholder-text">请先选择一个国家和大学</div>';
            selectors.mainContentArea.classList.add('hidden');
            
            // 彻底重置时，清空文件输入框的缓存
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
        updatePreviewScaling();
    }

    // 自动填充表单
    function populateForm(container, data) {
        if (!data) return;
        for (const [key, value] of Object.entries(data)) {
            const input = container.querySelector(`#${key}`);
            if (input) {
                input.value = value;
            }
        }
    }

    // 加载模板专属CSS
    function loadTemplateCSS(universityId) { // (*** 修改点 ***) 参数名改为 universityId 更清晰
        removeTemplateCSS();
        const link = document.createElement('link');
        link.id = 'template-styles';
        link.rel = 'stylesheet';
        // (*** 修改点 ***) 构建新的、包含国家和大学层级的路径来加载CSS文件
        link.href = `/templates/${state.currentCountryId}/${universityId}/style.css`;
        document.head.appendChild(link);
    }

    // 移除模板专属CSS
    function removeTemplateCSS() {
        document.getElementById('template-styles')?.remove();
    }

    // 格式化日期
    function formatDate(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(String(date).replace(/-/g, '/'));
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 为自定义文件上传按钮绑定事件
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

    // 处理文件选择事件
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