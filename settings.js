document.addEventListener('DOMContentLoaded', async () => {
    // 加载保存的 RPC 地址
    const result = await chrome.storage.local.get(['rpcUrl']);
    if (result.rpcUrl) {
        document.getElementById('rpc-url').value = result.rpcUrl;
    }

    // 保存设置
    document.getElementById('save-settings').addEventListener('click', async () => {
        const rpcUrl = document.getElementById('rpc-url').value.trim();
        
        if (!rpcUrl) {
            showStatus('请输入 RPC 地址', 'error');
            return;
        }

        try {
            // 验证 RPC 地址是否有效
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getHealth',
                }),
            });

            if (!response.ok) {
                throw new Error('RPC 地址无效');
            }

            // 保存设置
            await chrome.storage.local.set({ rpcUrl: rpcUrl });
            showStatus('设置已保存', 'success');

            // 通知其他页面 RPC 地址已更新
            chrome.runtime.sendMessage({
                type: 'rpcUrlUpdated',
                url: rpcUrl
            });

        } catch (error) {
            showStatus('RPC 地址无效或无法连接', 'error');
        }
    });
});

function showStatus(message, type) {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
} 