// background.js
// 定义锁定超时时间（与 popup.js 保持一致）
const LOCK_TIMEOUT = 60*60 * 1000;

// 定期检查锁定状态
async function checkLockStatus() {
  try {
    const result = await chrome.storage.local.get(['sessionKey', 'lastActivityTime']);
    const now = Date.now();
    
    // 检查是否需要锁定
    if (result.sessionKey && result.lastActivityTime && 
        (now - result.lastActivityTime >= LOCK_TIMEOUT)) {
      
      // 清除会话状态
      await chrome.storage.local.remove(['sessionKey', 'lastActivityTime']);
      
      // 通知所有标签页钱包已锁定
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'walletLocked'
        }).catch(() => {
          // 忽略发送消息失败的错误（标签页可能不支持消息）
        });
      });
    }
  } catch (error) {
    console.error('检查锁定状态失败:', error);
  }
}

// 每秒检查一次锁定状态
setInterval(checkLockStatus, 1000);

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateLastActivityTime") {
    sendResponse({ message: "成功更新最后活动时间" });
    chrome.storage.local.set({lastActivityTime: Date.now()});
    console.log('用户提交了交易，更新最后活动时间');
  }
});

// 监听标签页更新，确保新打开的页面也能收到锁定状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    checkLockStatus();
  }
});

// 监听 RPC 地址更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'rpcUrlUpdated') {
        // 可以在这里处理 RPC 地址更新后的操作
        console.log('RPC URL updated:', message.url);
    }
});
  


