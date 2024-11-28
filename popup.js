//引用js下载地址
//https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js
//https://unpkg.com/@solana/web3.js@1.95.4/lib/index.iife.min.js
// popup.js

// 在文件开头更新 Buffer polyfill
const Buffer = {
    from: function(data, encoding) {
        if (encoding === 'base64') {
            // base64 编码处理
            const base64 = data.replace(/[^A-Za-z0-9+/]/g, '')
                .padEnd(Math.ceil(data.length / 4) * 4, '=');
            
            try {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes;
            } catch (error) {
                console.error('Base64 解码错误:', error);
                throw error;
            }
        } else if (encoding === 'hex') {
            // hex 编码处理
            const bytes = new Uint8Array(data.length / 2);
            for (let i = 0; i < data.length; i += 2) {
                bytes[i / 2] = parseInt(data.substr(i, 2), 16);
            }
            return bytes;
        } else if (Array.isArray(data) || data instanceof Uint8Array) {
            // 数组或 Uint8Array 处理
            return new Uint8Array(data);
        } else if (typeof data === 'string') {
            // 字符串处理（默认 utf8）
            const bytes = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                bytes[i] = data.charCodeAt(i);
            }
            return bytes;
        }
        throw new Error('Unsupported encoding or data type');
    },
    alloc: function(size) {
        return new Uint8Array(size);
    }
};

let wallet = null;

// 在文件开头添加初始化检查函数
async function initializeWallet() {
  try {
    const result = await chrome.storage.local.get(['encryptedWallet', 'hasImportedWallet', 'lastActivityTime', 'sessionKey', 'rpcUrl']);

    if (!result.rpcUrl) {
      console.error('RPC 地址未设置');
      return;
    }

    const connection = new solanaWeb3.Connection(result.rpcUrl, 'confirmed');

    if (!result.encryptedWallet) {
      showSection('create-wallet-section');
      return;
    }

    const now = Date.now();
    const needRelogin = !result.lastActivityTime || (now - result.lastActivityTime >= LOCK_TIMEOUT);

    if (needRelogin || !result.sessionKey) {
      showSection('login-section');
    } else {
      try {
        // 使用会话密钥恢复钱包状态
        wallet = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(result.sessionKey));
        showSection('wallet-info');
        updateWalletInfo(connection);
        updateActivity();
      } catch (error) {
        console.error('恢复钱包状态失败:', error);
        showSection('login-section');
      }
    }
  } catch (error) {
    console.error('初始化钱包时出错:', error);
    showSection('import-section');
  }
}

// 加密函数
async function encryptWallet(secretKey, password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(Array.from(secretKey)));
  const passwordBuffer = encoder.encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    encryptionKey,
    data
  );

  return {
    encrypted: Array.from(new Uint8Array(encryptedData)),
    iv: Array.from(iv),
    salt: Array.from(salt)
  };
}

// 解函数
async function decryptWallet(encryptedData, password) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(encryptedData.salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      decryptionKey,
      new Uint8Array(encryptedData.encrypted)
    );
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    throw new Error('密码错误');
  }
}

// 在文件开头添加常量和变量
const LOCK_TIMEOUT = 60 * 60 * 1000; // 1小时的毫秒数
let lastActivityTime = Date.now();
let lockTimer = null;

// 添加活动检测函数
function updateActivity() {
  lastActivityTime = Date.now();

  // 更新存储的最后活动时间
  chrome.storage.local.set({ lastActivityTime: lastActivityTime });

  // 清除现有的定时器
  if (lockTimer) {
    clearTimeout(lockTimer);
  }

  // 设置新的定时器
  lockTimer = setTimeout(autoLockWallet, LOCK_TIMEOUT);
}

async function clearStorage() {
  try {
    await chrome.storage.local.remove(['sessionKey', 'lastActivityTime']);
    console.log('Storage items removed successfully.');
  } catch (error) {
    console.error('Error removing storage items:', error);
  }
}

// 修改自动锁定函数
function autoLockWallet() {

  // 清除会话密钥和活动时间
  clearStorage();

  // 清除输入框
  document.getElementById('password-input').value = '';
  document.getElementById('balance').textContent = '0 SOL';

  // 停止定时器
  if (lockTimer) {
    clearTimeout(lockTimer);
    lockTimer = null;
  }

  // 显示登录界面
  showSection('login-section');

  // 触发锁定事件，通知 content script
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'walletLocked'
      });
    }
  });

}

document.addEventListener('DOMContentLoaded', async () => {
  // 替换原有的检查代码，使用新的初始化函数
  await initializeWallet();

  // 登录
  document.getElementById('login-btn').addEventListener('click', async () => {
    const password = document.getElementById('password-input').value;
    try {
      const { encryptedWallet } = await chrome.storage.local.get(['encryptedWallet']);
      const secretKey = await decryptWallet(encryptedWallet, password);
      wallet = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secretKey));

      // 存储会话密钥和活动时间
      await chrome.storage.local.set({
        sessionKey: Array.from(wallet.secretKey),
        lastActivityTime: Date.now()
      });

      showSection('wallet-info');
      await updateWalletInfo();
      updateActivity();

      // 清除密码输入
      document.getElementById('password-input').value = '';

    } catch (error) {
      document.getElementById('login-error').textContent = '密码错误，请重试';
    }
  });

  // 创建钱包
  document.getElementById('createWallet').addEventListener('click', async () => {
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!password || !confirmPassword) {
      alert('请输入密码');
      return;
    }

    if (password !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }

    try {
      wallet = solanaWeb3.Keypair.generate();
      const encrypted = await encryptWallet(wallet.secretKey, password);
      await chrome.storage.local.set({
        encryptedWallet: encrypted,
        hasImportedWallet: false
      });

      // 获取私钥
      const privateKey = bs58.encode(wallet.secretKey);
      
      // 在创建私钥显示区域时添加样式
      const privateKeySection = document.createElement('div');
      privateKeySection.id = 'private-key-section';
      privateKeySection.innerHTML = `
        <h2>请保存您的私钥</h2>
        <div class="warning">
          <p>⚠️ 警告：这是您的私钥，请务必安全保存！丢失私钥将无法找回您的资产！</p>
        </div>
        <div class="private-key-container">
          <p>您的私钥：</p>
          <div class="private-key-display">
            <code id="generated-private-key" class="private-key-text">${privateKey}</code>
          </div>
        </div>
        <button id="confirm-private-key-saved">我已安全保存私钥</button>
      `;

      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .private-key-container {
          margin: 20px 0;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }

        .private-key-display {
          position: relative;
          padding: 10px;
          background-color: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 10px 0;
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-all;
          max-height: 80px;
          overflow-y: auto;
        }

        .private-key-text {
          font-family: monospace;
          font-size: 14px;
          line-height: 1.4;
          display: block;
          white-space: pre-wrap;
        }
      `;

      document.head.appendChild(style);

      // 获取主容器并添加私钥区域
      const container = document.querySelector('.container') || document.body;
      container.appendChild(privateKeySection);

      // 显示私钥提示界面
      showSection('private-key-section');
      
      // 添加确认按钮的事件监听
      document.getElementById('confirm-private-key-saved').addEventListener('click', async () => {
        showSection('wallet-info');
        await updateWalletInfo();
        updateActivity();
      });
    } catch (error) {
      console.error('创建钱包时出错:', error);
      alert('创建钱包失败，请重试');
    }
  });

  // 导入钱包
  document.getElementById('importWallet').addEventListener('click', async () => {
    try {
      const privateKey = document.getElementById('private-key').value;
      const password = document.getElementById('import-password').value;

      if (!privateKey || !password) {
        alert('请输入私钥和密码');
        return;
      }

      // 解码Base58格式的私钥
      const secretKey = bs58.decode(privateKey);
      wallet = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secretKey));

      const encrypted = await encryptWallet(wallet.secretKey, password);
      await chrome.storage.local.set({
        encryptedWallet: encrypted,
        hasImportedWallet: true  // 标记已导入钱包
      });

      showSection('wallet-info');
      await updateWalletInfo();
      updateActivity(); // 重置活动计时器
      alert('钱包导入成功！');
    } catch (error) {
      alert('导入失败：请确保私钥格式正确');
    }
  });

  // 修改手动锁定函数
  document.getElementById('lockWallet').addEventListener('click', async () => {
    // 除钱包状态
    wallet = null;

    // 停止定时器
    if (lockTimer) {
      clearTimeout(lockTimer);
      lockTimer = null;
    }

    // 清除会话密钥和活动时间
    await chrome.storage.local.remove(['sessionKey', 'lastActivityTime']);

    // 清除输入框
    document.getElementById('password-input').value = '';
    document.getElementById('balance').textContent = '0 SOL';

    // 显示登录界面
    showSection('login-section');

    // 触发定事件，通知 content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'walletLocked'
        });
      }
    });
  });

  // 添加清除钱包功能
  document.getElementById('clearWallet').addEventListener('click', async () => {
    // 第一次确认
    if (!confirm('您确定要清除钱包吗？此操作将删除所有钱包数据！')) {
      return;
    }

    // 第二次确认
    if (!confirm('请再次确认！清除钱包后将无法恢复，除非您备份了私钥！')) {
      return;
    }

    // 执行清除操作
    wallet = null;
    if (lockTimer) {
      clearTimeout(lockTimer);
      lockTimer = null;
    }

    // 清除所有存储的数据
    await chrome.storage.local.clear();

    // 清除所有输入框
    document.getElementById('password-input').value = '';
    document.getElementById('private-key').value = '';
    document.getElementById('import-password').value = '';
    document.getElementById('balance').textContent = '0 SOL';

    // 显示导入界面
    showSection('import-section');

    // 提示用户
    alert('钱包已清除！如果您有备份私钥，可以随时重新导入。');
  });

  // 界面切换按钮
  document.getElementById('showImport').addEventListener('click', () => {
    showSection('import-section');
  });

  document.getElementById('backToCreate').addEventListener('click', () => {
    showSection('create-wallet-section');
  });

  // 发送交易按钮
  document.getElementById('sendTransaction').addEventListener('click', () => {
    document.getElementById('send-form').style.display = 'block';
  });

  // 确认发送
  document.getElementById('confirmSend').addEventListener('click', async () => {
    try {
        const recipient = document.getElementById('recipient').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);

        if (!recipient || !amount) {
            alert('请输入接收地址和金额');
            return;
        }

        // 验证接收地址是否为有效的 Solana 地址
        try {
            // 尝试解码地址，如果失败则说明地址无效
            bs58.decode(recipient);
        } catch (error) {
            alert('无效的接收地址');
            return;
        }

        // 获取 RPC 连接
        const result = await chrome.storage.local.get(['rpcUrl']);
        if (!result.rpcUrl) {
            throw new Error('RPC 地址未设置');
        }
        const connection = new solanaWeb3.Connection(result.rpcUrl, 'confirmed');

        // 创建交易
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: new solanaWeb3.PublicKey(recipient),
                lamports: amount * solanaWeb3.LAMPORTS_PER_SOL
            })
        );

        // 获取最新的 blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        // 签名并发送交易
        const signature = await solanaWeb3.sendAndConfirmTransaction(
            connection,
            transaction,
            [wallet]
        );

        alert(`交易成功! 签名: ${signature}`);
        await updateWalletInfo(); // 更新余额
        
        // 清空输入框
        document.getElementById('recipient').value = '';
        document.getElementById('amount').value = '';
        
    } catch (error) {
        console.error('交易失败:', error);
        alert(`交易失败: ${error.message}`);
    }
  });

  // 添加刷新按钮
  addRefreshButton();

  // 添加活动监听器
  document.addEventListener('mousemove', updateActivity);
  document.addEventListener('keydown', updateActivity);
  document.addEventListener('click', updateActivity);

  // 初始化活动计时器
  updateActivity();

  // 添加密码输入框的回车键监听
  document.getElementById('password-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      // 阻止默认的回车键行为
      e.preventDefault();
      // 触发登录按钮点击
      document.getElementById('login-btn').click();
    }
  });

  // 添加新密码输入框的回车键监听
  document.getElementById('new-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 聚焦到确认密码输入框
      document.getElementById('confirm-password').focus();
    }
  });

  // 添加确认密码输入框的回车键监听
  document.getElementById('confirm-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 触发创建钱包按钮点击
      document.getElementById('createWallet').click();
    }
  });

  // 添加导入钱包密码输入框的回车键监听
  document.getElementById('import-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // 触发导入钱包按钮点击
      document.getElementById('importWallet').click();
    }
  });

  // 添加设置按钮点击事件
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// 显示指定区块，隐藏其他区块
function showSection(sectionId) {
  try {
    const sections = [
      'login-section', 
      'create-wallet-section', 
      'import-section', 
      'wallet-info',
      'private-key-section'  // 添加新的 section
    ];
    sections.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = id === sectionId ? 'block' : 'none';
      }
    });
  } catch (error) {
    console.error('切换界面时出错:', error);
  }
}

async function updateWalletInfo() {
  if (!wallet) return;

  try {
    // 获取 RPC 地址并创建连接
    const result = await chrome.storage.local.get(['rpcUrl']);
    if (!result.rpcUrl) {
      throw new Error('RPC 地址未设置');
    }
    
    const connection = new solanaWeb3.Connection(result.rpcUrl, 'confirmed');

    // 获取账户余额
    const balance = await connection.getBalance(wallet.publicKey);

    // 更新余额显示 (转换 lamports 到 SOL)
    const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
    document.getElementById('balance').textContent = 
      `${solBalance.toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      })} SOL`;

    // 更新钱包地址显示
    document.getElementById('wallet-address').textContent = 
      wallet.publicKey.toString();

    // 更新活动时间
    updateActivity();

    // 添加自动刷新
    setTimeout(() => updateWalletInfo(), 30000); // 每30秒刷新一次

  } catch (error) {
    console.error('获取余额失败:', error);
    document.getElementById('balance').textContent = '获取余额失败';
  }
}

// 添加手动刷余额功能
function addRefreshButton() {
  const balanceSection = document.querySelector('.balance-section');
  const refreshButton = document.createElement('button');
  refreshButton.textContent = '刷新余额';
  refreshButton.onclick = updateWalletInfo;
  balanceSection.appendChild(refreshButton);
}

// 在页面关闭或隐藏时保存最后活动时间
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    chrome.storage.local.set({ lastActivityTime: lastActivityTime });
  }
});

// 修改恢复活动时间的函数
async function restoreActivityTime() {
  const result = await chrome.storage.local.get(['lastActivityTime', 'sessionKey']);

  if (!result.encryptedWallet) {
    return;
  }

  // 只有在有会话密钥的情况下才恢复活动时间
  if (result.sessionKey && result.lastActivityTime) {
    lastActivityTime = result.lastActivityTime;

    // 检查是否需要自动锁定
    if (Date.now() - lastActivityTime >= LOCK_TIMEOUT) {
      autoLockWallet();
    } else {
      // 设置新的定时器
      const remainingTime = LOCK_TIMEOUT - (Date.now() - lastActivityTime);
      lockTimer = setTimeout(autoLockWallet, remainingTime);
    }
  } else {

    // 如果没有会话密，确保显示登录界面
    showSection('login-section');
  }
}

// 在初始化时调用
document.addEventListener('DOMContentLoaded', restoreActivityTime);

// 在页面关闭时清理会话状态
window.addEventListener('unload', () => {
  // 如果已超时，清除所有状态
  if (Date.now() - lastActivityTime >= LOCK_TIMEOUT) {
    chrome.storage.local.remove(['sessionKey', 'lastActivityTime']);
  }
});
