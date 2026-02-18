# 🏃 pbRun - 跑步数据分析

**专业的跑步数据分析工具，助力跑者实现 PB**

支持 Garmin 和 COROS 高驰数据源，通过专业的跑力（VDOT）分析、心率区间分布、配速趋势等多维度数据，为跑者提供科学的训练建议和数据洞察。

<div align="center">
[![GitHub License](https://img.shields.io/github/license/xuandao/pbRun)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)

[在线演示](https://pbrun.vercel.app) · [快速开始](#快速开始) · [配置说明](#配置说明)

</div>

---

## ✨ 新增功能

### 🔥 多数据源支持

- **Garmin Connect** - 支持 Garmin 国际区账号
- **COROS 高驰** - 新增 COROS 手表数据同步支持

### ⚙️ 设置页面

全新的设置页面（`/settings`）支持：
- 数据源配置（Garmin / COROS）
- Garmin Token 自动获取
- 实时同步进度显示
- 首次同步自动清理旧数据
- 心率参数配置

### 📊 趋势图表彩色样式

活动趋势图采用彩色配色方案：
- 🔴 心率 - 红色
- 🔵 配速 - 蓝色
- 🟢 步频 - 绿色
- 🟣 步幅 - 紫色

---

## 快速开始

### 前置要求

- Node.js 18+
- Garmin 国际区账号 或 COROS 账号
- GitHub 账号
- Vercel 账号（可选，用于部署）

### 1. Fork 并克隆仓库

```bash
# 将 YOUR_USERNAME 替换为你的 GitHub 用户名
git clone git@github.com:YOUR_USERNAME/pbRun.git
cd pbRun
npm install
```

> **macOS 用户**：若 `npm install` 时 better-sqlite3 编译报错，请先设置 SDK 路径：
> ```bash
> SDKROOT=$(xcrun --sdk macosx --show-sdk-path) npm install
> ```

### 2. 本地开发

```bash
npm run dev
# 访问 http://localhost:3000
```

首次访问会跳转到设置页面，配置数据源后即可同步数据。

---

## 配置说明

### 方式一：设置页面配置（开发环境/Self-host）

> ⚠️ **注意**：设置页面仅在本地开发环境或 Self-host 部署时可用。Vercel/GitHub Actions 用户请使用环境变量配置。

启动开发服务器后，访问 http://localhost:3000/settings 进行配置：

#### Garmin 配置

1. 点击「获取 Token」按钮
2. 输入 Garmin 邮箱和密码
3. 自动获取并保存 Token
4. 点击「同步数据」开始同步

#### COROS 配置

1. 输入 COROS 账号（手机号或邮箱）
2. 输入 COROS 密码
3. 点击「保存设置」
4. 点击「同步数据」开始同步

#### 心率参数

- **最大心率**：用于计算心率区间和 VDOT
- **静息心率**：用于计算心率储备和 VDOT

### 方式二：环境变量配置

> **Vercel / GitHub Actions 用户**请使用此方式配置。

在项目根目录创建 `.env` 文件，或在 Vercel/GitHub Actions 中配置环境变量：

```bash
# 数据源配置（二选一，或同时配置）
GARMIN_SECRET_STRING="your_garmin_token_here"    # Garmin Token
COROS_ACCOUNT="your_coros_account"                # COROS 账号
COROS_PASSWORD="your_coros_password"              # COROS 密码

# 心率参数（用于 VDOT 计算）
MAX_HR=190
RESTING_HR=55

# 设置页面控制（可选）
ENABLE_SETTINGS_PAGE=true   # Self-host 部署时启用设置页面
```

> 💡 **提示**：`ENABLE_SETTINGS_PAGE` 默认在开发环境自动启用，生产环境需手动设置为 `true` 才能访问设置页面。

#### 获取 Garmin Token

```bash
python3 scripts/get_garmin_token.py
```

---

## GitHub Actions 自动同步

### 配置 Secrets

进入仓库 **Settings > Secrets and variables > Actions**，添加以下 Secrets：

#### Garmin 数据源

| Secret | 说明 | 必填 |
|--------|------|------|
| `GARMIN_SECRET_STRING` | Garmin Token | ✅ |
| `MAX_HR` | 最大心率 | ❌ |
| `RESTING_HR` | 静息心率 | ❌ |

#### COROS 数据源

| Secret | 说明 | 必填 |
|--------|------|------|
| `COROS_ACCOUNT` | COROS 账号（手机号/邮箱） | ✅ |
| `COROS_PASSWORD` | COROS 密码 | ✅ |
| `MAX_HR` | 最大心率 | ❌ |
| `RESTING_HR` | 静息心率 | ❌ |

### 更新 GitHub Actions 工作流

修改 `.github/workflows/sync_garmin_data.yml` 以支持 COROS：

```yaml
name: Sync Running Data

on:
  schedule:
    - cron: '0 */8 * * *'      # 每 8 小时同步一次
  workflow_dispatch:           # 手动触发
  push:
    branches: [main]
    paths-ignore:
      - 'app/data/activities.db'

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Restore database cache
        uses: actions/cache@v4
        with:
          path: app/data/activities.db
          key: running-db-${{ github.sha }}
          restore-keys: running-db-

      - name: Sync Garmin data
        if: ${{ secrets.GARMIN_SECRET_STRING != '' }}
        env:
          GARMIN_SECRET_STRING: ${{ secrets.GARMIN_SECRET_STRING }}
          MAX_HR: ${{ secrets.MAX_HR }}
          RESTING_HR: ${{ secrets.RESTING_HR }}
        run: node scripts/sync-garmin.js

      - name: Sync COROS data
        if: ${{ secrets.COROS_ACCOUNT != '' }}
        env:
          COROS_ACCOUNT: ${{ secrets.COROS_ACCOUNT }}
          COROS_PASSWORD: ${{ secrets.COROS_PASSWORD }}
          MAX_HR: ${{ secrets.MAX_HR }}
          RESTING_HR: ${{ secrets.RESTING_HR }}
        run: node scripts/sync-coros.js

      - name: Update stats cache
        env:
          MAX_HR: ${{ secrets.MAX_HR }}
          RESTING_HR: ${{ secrets.RESTING_HR }}
        run: node scripts/preprocess-stats-cache.js --mode full --clear

      - name: Commit and push
        run: |
          git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add app/data/activities.db
          git diff --staged --quiet || git commit -m "chore: update running data $(date +%Y-%m-%d)"
          git push
```

---

## 部署到 Vercel

> ⚠️ **注意**：Vercel 部署后设置页面不可用，请通过环境变量配置数据源。

### 快速部署

1. Fork 本仓库
2. 登录 [Vercel](https://vercel.com)
3. 导入你 Fork 的仓库
4. 自动检测 Next.js 项目，一键部署
5. 配置环境变量（可选）

### 环境变量配置

在 Vercel 项目设置中添加环境变量：

| 变量名 | 说明 |
|--------|------|
| `GARMIN_SECRET_STRING` | Garmin Token |
| `COROS_ACCOUNT` | COROS 账号 |
| `COROS_PASSWORD` | COROS 密码 |
| `MAX_HR` | 最大心率 |
| `RESTING_HR` | 静息心率 |

---

## 功能特性

- ✅ **多数据源** - 支持 Garmin 和 COROS
- ✅ **活动列表** - 查看所有跑步记录，支持按月份筛选
- ✅ **活动详情** - 详细的配速、心率、海拔数据和分段信息
- ✅ **统计分析** - 月度/年度里程、跑量、个人记录
- ✅ **跑力分析** - VDOT 趋势图，追踪训练效果
- ✅ **心率区间** - 分析有氧/无氧训练占比
- ✅ **配速分布** - 识别舒适配速区间
- ✅ **训练建议** - 基于 Daniels 训练法的配速建议
- ✅ **设置页面** - 可视化配置（仅开发环境/Self-host）

---

## 项目结构

```
pbRun/
├── app/                    # Next.js 应用
│   ├── api/               # API 路由
│   │   ├── settings/      # 设置 API
│   │   ├── sync/          # 同步 API
│   │   └── garmin/        # Garmin Token API
│   ├── settings/          # 设置页面
│   ├── list/              # 活动列表页面
│   ├── analysis/          # 数据分析页面
│   ├── stats/             # 统计页面
│   └── lib/               # 工具库
├── scripts/               # 数据同步脚本
│   ├── sync-garmin.js     # Garmin 同步
│   ├── sync-coros.js      # COROS 同步
│   ├── coros-client.js    # COROS API 客户端
│   ├── fit-parser.js      # FIT 文件解析
│   └── db-manager.js      # 数据库操作
├── .github/workflows/     # GitHub Actions
└── app/data/              # SQLite 数据库
```

---

## 常见问题

### Q: 设置页面什么时候可用？

A: 设置页面仅在以下环境可用：
- 本地开发环境（`npm run dev`）
- Self-host 部署（设置 `ENABLE_SETTINGS_PAGE=true`）

Vercel 和 GitHub Actions 用户请使用环境变量/Secrets 配置。

### Q: 如何同时使用 Garmin 和 COROS？

A: 同时配置两个数据源的环境变量，数据会自动合并，通过 `source` 字段区分来源。

### Q: COROS 同步失败怎么办？

A: 
1. 确认账号密码正确
2. 确认使用的是 COROS 国际版账号（非国区）
3. 查看控制台错误日志

### Q: 首次同步提示清理旧数据？

A: 项目可能自带演示数据，首次同步时会自动清理无来源数据。Self-host 用户可在设置页面重置。

### Q: Self-host 部署如何启用设置页面？

A: 设置环境变量 `ENABLE_SETTINGS_PAGE=true`，即可访问 `/settings` 页面。

---

## 开源协议

[MIT License](LICENSE)

---

## 致谢

- [yihong0618/running_page](https://github.com/yihong0618/running_page) - 项目参考
- [Jack Daniels' Running Formula](https://www.amazon.com/Daniels-Running-Formula-Jack-Tupper/dp/1450431836) - VDOT 理论基础
- [Garmin Connect](https://connect.garmin.com/) - Garmin 数据来源
- [COROS](https://coros.com/) - COROS 数据来源
- [Next.js](https://nextjs.org/) - Web 框架
- [Vercel](https://vercel.com/) - 部署平台
