# Garmin 数据同步和分析系统

基于 GitHub Actions 的自动化系统，用于同步 Garmin 国际区的运动数据，解析 FIT 文件并存储到 SQLite 数据库中，通过 Next.js API Routes 提供数据查询和分析功能。

## ✨ 功能特性

- ✅ 每日自动同步 Garmin 国际区 FIT 文件
- ✅ 解析 FIT 文件，提取活动和分段维度的详细数据（28+ 字段）
- ✅ 计算 VDOT 跑力值（基于心率区间）
- ✅ SQLite 数据库持久化
- ✅ RESTful API 提供数据查询
- ✅ 支持定时、手动和 Webhook 三种同步触发方式

## 🚀 快速开始

### 1. 安装依赖

```bash
# Python 依赖
pip install -r scripts/requirements.txt

# Node.js 依赖
npm install
```

### 2. 配置环境变量

```bash
# 获取 Garmin 认证 token
python scripts/get_garmin_token.py

# 配置环境变量（参考 docs/.env.example）
export GARMIN_SECRET_STRING="your_token"
export MAX_HR="190"
export RESTING_HR="55"
```

### 3. 初始化数据

```bash
# 一键初始化（推荐）
npm run init:garmin:data

# 或手动测试同步
python scripts/verify_setup.py          # 验证设置
python scripts/sync_garmin.py --limit 5  # 测试同步
```

### 4. 启动 API 服务

```bash
npm run dev
```

API 将运行在 `http://localhost:3000`

## 📚 文档

- **[快速开始指南](docs/QUICKSTART.md)** - 详细的设置步骤
- **[数据初始化指南](docs/INIT_DATA.md)** - 使用 `npm run init:garmin:data` 初始化数据
- **[完整项目文档](docs/README_GARMIN.md)** - 功能和架构说明
- **[部署检查清单](docs/DEPLOYMENT_CHECKLIST.md)** - 部署验证清单
- **[实现总结](docs/IMPLEMENTATION_SUMMARY.md)** - 技术实现细节

## 🔗 API 端点

| 端点 | 说明 |
|------|------|
| `GET /api/activities` | 获取活动列表（支持分页和过滤） |
| `GET /api/activities/:id` | 获取活动详情 |
| `GET /api/activities/:id/laps` | 获取活动分段数据 |
| `GET /api/stats` | 获取统计数据 |
| `GET /api/vdot` | 获取 VDOT 历史数据 |

## 📁 项目结构

```
garmin_data/
├── .github/workflows/       # GitHub Actions 工作流
├── scripts/                 # Python 数据同步脚本
├── app/api/                 # Next.js API Routes
├── lib/                     # 数据库访问层和类型定义
├── data/                    # SQLite 数据库
└── docs/                    # 文档目录
```

## 🛠️ 技术栈

**数据同步层 (Python)**
- `garth` - Garmin 认证
- `garmin-fit-sdk` - FIT 文件解析
- `httpx` + `aiofiles` - 异步下载

**API 服务层 (TypeScript/Node.js)**
- Next.js 14+ API Routes
- `better-sqlite3` - SQLite 数据库访问
- TypeScript - 类型安全

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT

---

**需要帮助？** 查看 [文档目录](docs/) 或运行 `python scripts/verify_setup.py` 进行故障排查。
