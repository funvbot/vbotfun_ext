# Vbot Fun Chrome 扩展钱包

## 项目简介

这是一个基于 Chrome 扩展的 Solana 钱包应用,主要用于配合 Vbot 使用。该钱包提供了基础的 Solana 钱包功能,包括创建钱包、导入钱包、发送交易等功能。

## 主要功能

### 1. 钱包管理
- 创建新钱包
- 导入已有钱包(支持Base58格式私钥)
- 加密存储私钥
- 自动锁定机制(1小时无操作自动锁定)

### 2. 交易功能
- 查看钱包余额
- 发送 SOL 
- 支持普通交易和 Bundle 交易
- 实时更新余额信息

### 3. 安全特性
- AES 加密保护私钥
- 密码保护机制
- 自动锁定功能
- 域名白名单验证

### 4. 设置功能
- 自定义 RPC 节点设置
- RPC 连接状态验证

## 技术架构

### 核心组件
1. **popup.js**: 主要的用户界面交互逻辑
2. **wallet.js**: 钱包核心功能实现
3. **content.js**: 与网页交互的注入脚本
4. **background.js**: 后台服务脚本
5. **settings.js**: 设置页面功能实现

### 使用的库
- Web3.js: Solana 区块链交互
- CryptoJS: 加密功能
- BS58: Base58 编解码

## 安装要求

- Chrome 浏览器
- Manifest V3 支持

## 使用说明

1. 首次使用需要在设置中配置 RPC 节点地址
2. 可以选择创建新钱包或导入已有钱包
3. 设置钱包密码进行保护
4. 可以在弹出窗口中进行转账等操作

## 安全提示

1. 请务必保管好钱包密码
2. 建议备份私钥到安全的地方
3. 不要在不信任的网站连接钱包
4. 定期检查 RPC 节点的可用性和安全性

## 开发说明

### 项目结构 