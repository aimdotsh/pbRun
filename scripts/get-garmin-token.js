#!/usr/bin/env node
/**
 * Get Garmin authentication token
 *
 * Note: This is a simplified version. For production use, consider using the Python
 * version (get_garmin_token.py) which uses the official garth library.
 *
 * This tool requires manual OAuth flow completion.
 */

const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('═'.repeat(60));
  log('Garmin Authentication Token Generator', 'bright');
  console.log('═'.repeat(60) + '\n');

  log('⚠️  重要提示:', 'yellow');
  log('JavaScript 版本的 token 获取工具需要手动完成 OAuth 流程。', 'yellow');
  log('推荐使用 Python 版本: python scripts/get_garmin_token.py\n', 'cyan');

  log('如果你已经有 token，可以从以下位置获取:', 'cyan');
  log('  1. 使用 Python garth 库:', 'cyan');
  log('     python -c "import garth; garth.login(\'email\', \'password\'); print(garth.client.dumps())"\n', 'bright');

  log('  2. 从现有的 running_page 项目:', 'cyan');
  log('     如果你使用过 running_page，token 可能存储在:', 'bright');
  log('     ~/.garth\n', 'bright');

  log('  3. 使用 Python 脚本 (推荐):', 'cyan');
  log('     python scripts/get_garmin_token.py\n', 'bright');

  const hasToken = await askQuestion('你是否已经有 GARMIN_SECRET_STRING token? (y/N): ');

  if (hasToken.toLowerCase() === 'y' || hasToken.toLowerCase() === 'yes') {
    log('\n请将 token 添加到 .env 文件:', 'green');
    log('GARMIN_SECRET_STRING=your_token_here', 'bright');
    log('\n或导出为环境变量:', 'green');
    log('export GARMIN_SECRET_STRING="your_token_here"', 'bright');
  } else {
    log('\n请使用以下方法之一获取 token:\n', 'yellow');

    log('方法 1: 使用 Python 脚本 (最简单):', 'cyan');
    log('  pip install garth', 'bright');
    log('  python scripts/get_garmin_token.py', 'bright');

    log('\n方法 2: 使用 Python garth 库:', 'cyan');
    log('  python -c "', 'bright');
    log('import garth', 'bright');
    log('from getpass import getpass', 'bright');
    log('email = input(\'Email: \')', 'bright');
    log('password = getpass(\'Password: \')', 'bright');
    log('garth.login(email, password)', 'bright');
    log('print(garth.client.dumps())', 'bright');
    log('"', 'bright');

    log('\n方法 3: 手动从浏览器获取 (高级):', 'cyan');
    log('  1. 访问 https://connect.garmin.com', 'bright');
    log('  2. 登录你的账户', 'bright');
    log('  3. 打开浏览器开发者工具 (F12)', 'bright');
    log('  4. 在 Network 标签中查找 API 请求', 'bright');
    log('  5. 复制 Authorization header 中的 Bearer token', 'bright');
    log('  注意: 此方法获取的 token 可能不完整\n', 'yellow');
  }

  log('\n获取 token 后，请按以下步骤配置:', 'green');
  log('  1. 编辑 .env 文件', 'cyan');
  log('  2. 添加: GARMIN_SECRET_STRING=your_token', 'cyan');
  log('  3. 运行: npm run init:garmin:data', 'cyan');

  console.log('');
}

main().catch(error => {
  log(`\nError: ${error.message}`, 'red');
  process.exit(1);
});
