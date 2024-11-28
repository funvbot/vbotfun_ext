// 添加 Buffer polyfill
const Buffer = {
  from: function (data, encoding) {
    if (encoding === 'base64') {   
      // 修复 base64 字符串，确保它是有效的 base64 格式
      // 添加缺失的填充
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
        console.error('原始数据:', data);
        console.error('处理后的 base64:', base64);
        throw new Error('Base64 解码失败: ' + error.message);
      }
    }
    throw new Error('Unsupported encoding');
  }
};

// 在文件开头添加 CryptoJS 相关函数
function aesDecrypt(encryptedData, key) {
  try {
    // 将密钥处理成16位
    const keyHex = CryptoJS.enc.Utf8.parse(key.slice(0, 16));
    
    // 解密
    const decrypted = CryptoJS.AES.decrypt(encryptedData, keyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // 将解密结果转换为字符串
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('AES解密失败:', error);
    throw error;
  }
}

// 为了完整性，也添加加密函数
function aesEncrypt(data, key) {
  try {
    // 将密钥处理成16位
    const keyHex = CryptoJS.enc.Utf8.parse(key.slice(0, 16));
    
    // 加密
    const encrypted = CryptoJS.AES.encrypt(data, keyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // 返回base64格式的加密数据
    return encrypted.toString();
  } catch (error) {
    console.error('AES加密失败:', error);
    throw error;
  }
}

// 操作网页 DOM 示例
//document.body.style.backgroundColor = "lightblue";

async function initializeConnection() {
  const result = await chrome.storage.local.get(['rpcUrl']);
  if (result.rpcUrl) {
    return new solanaWeb3.Connection(result.rpcUrl, 'confirmed');
  } else {
    console.error('RPC 地址未设置');
    throw new Error('RPC 地址未设置');
  }
}

let connection;
initializeConnection().then(conn => {
  connection = conn;
}).catch(error => {
  console.error('初始化连接失败:', error);
});

// 监听来自网页的自定义事件
window.addEventListener("sendToTransaction", async (event) => {
  console.log("接收到交易请求:", event.detail);
  try {
    updateLastActivityTime();
    const { transactionKey } = await chrome.storage.local.get(['transactionKey']);
    const txInfo= aesDecrypt(event.detail.data,transactionKey.key);
    
    if (event.detail.mode === 'anti') {
      const txid = await signAndSendBundles(txInfo);
      window.dispatchEvent(new CustomEvent("transactionResult", {
        detail: {
          success: true,
          txid: txid
        }
      }));
    } else {
      const txid = await signAndSendTransaction(txInfo);
      window.dispatchEvent(new CustomEvent("transactionResult", {
        detail: {
          success: true,
          txid: txid
        }
      }));
    }
  } catch (error) {
    console.error("交易签名失败:", error);
    window.dispatchEvent(new CustomEvent("transactionResult", {
      detail: {
        success: false,
        error: error.message
      }
    }));
  }
});

async function signAndSendTransaction(base64Transaction) {
  try {
    console.log('接收到的 base64 交易数据:', base64Transaction);

    // 1. 从 chrome.storage 获取钱包信息
    const result = await chrome.storage.local.get(['sessionKey']);
    if (!result.sessionKey) {
      throw new Error('未登录钱包');
    }

    // 2. 从会话密钥恢复钱包
    const wallet = solanaWeb3.Keypair.fromSecretKey(
      new Uint8Array(result.sessionKey)
    );

    // 3. 将 Base64 编码的交易解析为 Transaction 对象
    const transactionBuffer = Buffer.from(base64Transaction, 'base64');
    console.log('解码后的交易数据:', transactionBuffer);

    const transaction = solanaWeb3.Transaction.from(transactionBuffer);
    console.log('解析后的交易对象:', transaction);

    // 4. 使用钱包进行签名
    transaction.sign(wallet);

    // 5. 验证签名
    const isVerified = transaction.verifySignatures();
    if (!isVerified) {
      throw new Error('交易签名验证失败');
    }

    // 6. 发送交易并等待确认
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      }
    );
    console.log('交易发送中,签名:', signature);
    sendLogInfo("quickhash:"+signature);

    // 7. 等待交易确认
    const confirmation = await connection.confirmTransaction(signature);
    if (confirmation.value.err) {
      throw new Error('交易确认失败');
    }

    console.log('交易成功，签名:', signature);
    return signature;

  } catch (error) {
    console.error('交易处理失败:', error);
    throw new Error(error.message || '交易签名失败');
  }
}

// 发送 bundle 交易
async function signAndSendBundles(base64Transaction) {
  try {
    console.log('anti接收到的 bundle 交易数据:', base64Transaction);

    // 1. 从 chrome.storage 获取钱包信息
    const result = await chrome.storage.local.get(['sessionKey']);
    if (!result.sessionKey) {
      throw new Error('未登录钱包');
    }

    // 2. 从会话密钥恢复钱包
    const wallet = solanaWeb3.Keypair.fromSecretKey(
      new Uint8Array(result.sessionKey)
    );

    // 3. 将 Base64 编码的交易解析为 Transaction 对象
    const transactionBuffer = Buffer.from(base64Transaction, 'base64');
    console.log('解码后的交易数据:', transactionBuffer);

    const transaction = solanaWeb3.Transaction.from(transactionBuffer);
    console.log('解析后的交易对象:', transaction);

    // 4. 使用钱包进行签名
    transaction.sign(wallet);

    // 5. 验证签名
    const isVerified = transaction.verifySignatures();
    if (!isVerified) {
      throw new Error('交易签名验证失败');
    }

    // 6. 序列化交易
    const serialized = transaction.serialize(); 
    const base58bundle = bs58.encode(serialized);


    // 7. 构建请求数据
    const requestData = {
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [
        [base58bundle],
        {
          encoding: "base58"
        }
      ]
    };

    // 8. 发送请求到 Jito MEV
    const response = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    // 9. 处理响应
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Bundle 提交失败:', errorData);
      throw new Error(`Bundle 提交失败: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();

    // 10. 检查响应中是否有错误
    if (responseData.error) {
      throw new Error(`Bundle 错误: ${responseData.error.message}`);
    }


    sendLogInfo("bundlehash:"+responseData.result);
    // 11. 返回成功结果
    console.log('Bundle 提交成功:', responseData);  
    return responseData.result;

  } catch (error) {
    console.error('Bundle 处理失败:', error);
    throw new Error(error.message || 'Bundle 提交失败');
  }
}

// 监听来自网页的其他事件
window.addEventListener("sendToExtension", (event) => {
  console.log("来自网页的自定义事件:", event.detail);
});

function updateLastActivityTime() {
  // 发送消息到后台脚本
  chrome.runtime.sendMessage(
  { type: "updateLastActivityTime", data: "update" },
  (response) => {
    console.log("插件发送的消息:", response?.message);
    }
  );
}

// 添加监听来自扩展的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'walletLocked') {
    console.log('钱包已锁定');

    // 通知网页钱包已锁定
    window.dispatchEvent(new CustomEvent("walletStatusChanged", {
      detail: {
        status: 'locked',
        isConnected: false
      }
    }));

    // 清除网页上显示的钱包信息
    window.dispatchEvent(new CustomEvent("walletAddressResult", {
      detail: {
        success: false,
        error: '钱包已锁定'
      }
    }));

    window.dispatchEvent(new CustomEvent("walletBalanceResult", {
      detail: {
        success: false,
        error: '钱包已锁定'
      }
    }));

    // 通知网页更新状态
    window.dispatchEvent(new CustomEvent("walletStatusResult", {
      detail: {
        isConnected: false,
        error: '钱包已锁定'
      }
    }));
  }
});

