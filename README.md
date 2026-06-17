# Picora

A local, timeline-driven photo manager — inspired by the beloved Google Picasa.

一款本地照片管理器，致敬曾经经典的 Google Picasa。

---

## 为什么做这个项目

Picasa 于 2016 年停产，它最打动人的设计是"时间的长河"——所有照片按拍摄时间排列成一条连续的时间线，用户不需要理解文件夹的概念，打开软件就能看到所有照片。

这个项目的初衷是为一位 80 多岁的老人重新找回那个体验。试过 XnView、IrfanView 等工具，但它们都是文件夹驱动的，对于不理解文件系统的老人来说太复杂了。

Picora 的目标很简单：**打开软件，看到所有照片，按时间排列，滚一滚，点一点，不想要的删掉。**

## 功能特性

- **时间轴浏览**：所有照片按拍摄日期排列，左侧时间树导航，右侧缩略图网格
- **虚拟滚动**：支持数万张照片流畅浏览，只渲染可见区域
- **智能缩略图**：首次扫描自动生成缩略图缓存（WebP 格式），后续打开秒加载
- **时间树联动**：滚动右侧照片时，左侧时间树自动高亮当前月份；点击左侧月份，右侧精准跳转
- **全屏查看**：双击照片进入全屏，左右箭头键翻页
- **安全删除**：删除操作将照片移至系统回收站，可随时恢复
- **启动自动扫描**：可选开启，每次启动时自动检测新增照片
- **跨平台**：支持 Windows 和 macOS

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端框架 | React 18 |
| 虚拟滚动 | react-window (VariableSizeList) |
| 图片处理 | sharp |
| EXIF 读取 | exifr |
| 构建工具 | Vite + TypeScript |
| 打包工具 | electron-builder |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 开发模式

```bash
# 克隆项目
git clone <repo-url>
cd picora

# 安装依赖
npm install

# 启动开发模式（同时启动 Electron 和 Vite 开发服务器）
npm run dev
```

启动后 Electron 窗口会自动打开，Vite 开发服务器运行在 `http://localhost:5173`。

### 构建安装包

```bash
# 编译主进程 + 渲染进程 + 打包
npm run build
```

安装包输出在 `dist/` 目录下。

Windows 用户会生成 `.exe` 安装文件（NSIS 一键安装），macOS 用户会生成 `.dmg` 文件。

### 单独构建

```bash
# 仅编译主进程
npm run build:main

# 仅编译渲染进程
npm run build:renderer

# 打包但不生成安装包（用于调试）
npm run pack
```

## 项目结构

```
picora/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 入口，窗口管理
│   │   ├── scanner.ts     # 文件夹递归扫描
│   │   ├── exif.ts        # EXIF 日期提取
│   │   ├── thumbnail.ts   # 缩略图生成
│   │   ├── indexer.ts     # 照片索引管理 (photos.json)
│   │   ├── config.ts      # 应用配置管理
│   │   ├── trash.ts       # 安全删除（移至回收站）
│   │   └── ipc.ts         # IPC 通信层
│   │
│   ├── preload/
│   │   └── index.ts       # contextBridge 安全 API
│   │
│   └── renderer/          # React 前端
│       ├── App.tsx         # 应用主组件
│       ├── components/     # UI 组件
│       │   ├── MainLayout.tsx    # 左右分栏主布局
│       │   ├── TimeTree.tsx      # 左侧时间树导航
│       │   ├── PhotoGrid.tsx     # 右侧虚拟滚动网格
│       │   ├── Viewer.tsx        # 全屏看图
│       │   ├── Settings.tsx      # 设置页面
│       │   └── ...
│       ├── hooks/
│       │   └── usePhotos.ts      # 照片数据管理 hook
│       └── styles/
│           └── global.css        # 全局样式
│
├── DESIGN.md              # 技术设计文档（中文）
├── package.json
├── electron-builder.yml
├── vite.config.ts
└── tsconfig.json
```

## 数据存储

应用数据存储在系统标准目录下：

- **Windows**: `%APPDATA%/picora-app/`
- **macOS**: `~/Library/Application Support/picora-app/`

包含：

- `config.json` — 用户配置（照片文件夹路径等）
- `photos.json` — 照片索引（路径、日期、缩略图状态）
- `thumbnails/` — 缩略图缓存（WebP 格式，约 10-20KB/张）

## 支持的文件格式

JPG, JPEG, PNG, HEIC, HEIF, WebP, BMP, TIFF

## 界面预览

> TODO: 添加截图

## 贡献

欢迎 Issue 和 Pull Request！如果你也想为家里的老人做一个好用的照片工具，欢迎一起参与。

## License

MIT
