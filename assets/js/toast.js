/**
 * 全局Toast弹窗模块
 */
function showToast({
    message = '',
    type = 'info',
    duration = 4000,
    persistent = false
} = {}) {
    // 创建或获取Toast容器
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // 创建单个Toast元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // 创建消息内容
    const messageElement = document.createElement('p');
    messageElement.innerHTML = message; // 使用innerHTML以支持HTML标签
    toast.appendChild(messageElement);

    // 如果是持久性Toast，添加关闭按钮
    if (persistent) {
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close-btn';
        closeButton.innerHTML = '&times;'; // "x" 符号
        closeButton.onclick = () => {
            toast.classList.add('toast-fade-out');
            // 等待动画结束后再移除元素
            toast.addEventListener('animationend', () => toast.remove());
        };
        toast.appendChild(closeButton);
    }

    // 将Toast添加到容器中
    toastContainer.appendChild(toast);

    // 触发进入动画
    // 使用requestAnimationFrame确保元素已渲染，动画可以正确触发
    requestAnimationFrame(() => {
        toast.classList.add('toast-fade-in');
    });

    // 如果不是持久性的，则在指定时间后自动移除
    if (!persistent && duration > 0) {
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    return toast;
}