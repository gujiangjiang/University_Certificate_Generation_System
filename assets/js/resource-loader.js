// 资源加载器：优先加载本地资源，失败则回退到在线资源。
document.addEventListener('DOMContentLoaded', () => {

    const resources = [
        {
            // Noto Sans SC 字体
            // 修改点：路径前添加 "/"
            local: '/assets/libs/google-fonts/noto-sans-sc.css',
            online: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap'
        }
        // 未来可以添加更多需要本地回退的CSS资源
    ];

    /**
     * 加载一个CSS资源
     * @param {string} url - 资源的URL
     * @param {function} [onerror] - 加载失败时的回调函数
     */
    function loadCSS(url, onerror) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        if (onerror) {
            link.onerror = onerror;
        }
        document.head.appendChild(link);
        return link;
    }

    // 遍历所有资源并应用回退逻辑
    resources.forEach(resource => {
        const localLink = loadCSS(resource.local, () => {
            console.warn(`本地资源加载失败: ${resource.local}。正在尝试加载在线版本...`);
            // 移除失败的本地link标签
            localLink.remove();
            // 加载在线资源
            loadCSS(resource.online);
        });
    });

});