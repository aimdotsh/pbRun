import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// 配置文件所在目录即项目根（next.config.ts 位于项目根）；编译后可能在 .next 下，需取实际项目根
const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = configDir.endsWith(".next")
  ? path.resolve(configDir, "..")
  : configDir;

const nextConfig: NextConfig = {
  // 将 app/data/activities.db 打入 API 的 serverless 包，否则 Vercel 部署后找不到库文件
  outputFileTracingIncludes: {
    "/api/*": ["./app/data/activities.db"],
  },
};

export default nextConfig;
