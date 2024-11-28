// wallet.js

// 添加允许的域名列表
const ALLOWED_DOMAINS = [
    'localhost',
    'vbot.fun'
    // 添加其他允许的域名...
];

// 获取 RPC 地址
async function getConnection() {
    const result = await chrome.storage.local.get(['rpcUrl']);
    if (result.rpcUrl) {
        return new solanaWeb3.Connection(result.rpcUrl, 'confirmed');
    } else {
        console.error('RPC 地址未设置');
    }
}

// 添加连接钱包事件监听
window.addEventListener("connectWallet", async (event) => {
    try {
        // 获取当前页面的域名
        const domain = window.location.hostname;

        // 检查域名是否在允许列表中
        if (!ALLOWED_DOMAINS.includes(domain)) {
            throw new Error('未授权的域名请求');
        }

        // 检查钱包状态
        const result = await chrome.storage.local.get(['sessionKey']);
        if (!result.sessionKey) {
            throw new Error('钱包未登录或已锁定');
        }

        // 获取连接请求中的 key
        const { key } = event.detail;
        if (!key) {
            throw new Error('缺少连接密钥');
        }

        // 存储交易密钥和域名信息
        await chrome.storage.local.set({
            transactionKey: {
                key: key,
                domain: domain,
                timestamp: Date.now()
            }
        });

        // 发送连接成功事件
        window.dispatchEvent(new CustomEvent("walletConnected", {
            detail: {
                success: true,
                message: '钱包连接成功'
            }
        }));

    } catch (error) {
        // 发送连接失败事件
        window.dispatchEvent(new CustomEvent("walletConnected", {
            detail: {
                success: false,
                error: error.message
            }
        }));
        console.error('钱包连接失败:', error);
    }
});

async function sendWalletInfo() {
    try {
        const result = await chrome.storage.local.get(['sessionKey']);
        const { transactionKey } = await chrome.storage.local.get(['transactionKey']);

        if (!result.sessionKey) {
            window.dispatchEvent(new CustomEvent("walletInfoResult", {
                detail: {
                    success: false,
                    error: '钱包已锁定'
                }
            }));
            return;
        }

        const wallet = solanaWeb3.Keypair.fromSecretKey(
            new Uint8Array(result.sessionKey)
        );

        const connection = await getConnection();
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;

        // 检查 transactionKey 是否存在且域名匹配
        const isConnected = transactionKey &&
            transactionKey.domain === window.location.hostname &&
            (Date.now() - transactionKey.timestamp) < 24 * 60 * 60 * 1000; // 24小时有效期

        if (!isConnected) {
            window.dispatchEvent(new CustomEvent("walletInfoResult", {
                detail: {
                    success: false,
                    error: '钱包未连接'
                }
            }));
            return;
        }

        window.dispatchEvent(new CustomEvent("walletInfoResult", {
            detail: {
                success: true,
                isConnected: isConnected,
                address: wallet.publicKey.toString(),
                balance: solBalance,
                lamports: balance,
                transactionKey: isConnected,
                formatted: `${solBalance.toLocaleString('zh-CN', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4
                })} SOL`
            }
        }));

    } catch (error) {
        window.dispatchEvent(new CustomEvent("walletInfoResult", {
            detail: {
                success: false,
                error: error.message || '获取钱包信息失败'
            }
        }));
    }
}

// 发送日志信息的函数
function sendLogInfo(message) {
    window.dispatchEvent(new CustomEvent("logEvent", {
        detail: {
            message: message
        }
    }));
}

// 监听请求钱包信息的事件
window.addEventListener("requestWalletInfo", sendWalletInfo);

console.log('钱包信息定时器已启动');
// 定时每5秒发送钱包信息
setInterval(sendWalletInfo, 5000); 