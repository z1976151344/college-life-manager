const { createRequire } = await import('module');
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/HW/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = 'C:/Users/HW/Documents/Codex/2026-10-09/https-z1976151344-github-io-college-life';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html':'text/html; charset=utf-8', '.json':'application/json', '.js':'text/javascript', '.png':'image/png', '.css':'text/css' };
const OUT = 'C:/Users/HW/AppData/Local/Temp/v6shots';
fs.mkdirSync(OUT, { recursive: true });

const seed = {
  collegeLifeExpensesV1: JSON.stringify([
    { id: '1', amount: 12, category: '正餐', subcategory: '午餐', date: '2026-10-08', note: '食堂', createdAt: '2026-10-08T10:00:00.000Z' },
    { id: '2', amount: 20, category: '非正餐', subcategory: '奶茶饮料', date: '2026-10-08', note: '奶茶', createdAt: '2026-10-08T11:00:00.000Z' },
    { id: '3', amount: 45, category: '学习成长', subcategory: '教材资料', date: '2026-10-09', note: '高数', createdAt: '2026-10-09T10:00:00.000Z' },
    { id: '4', amount: 68, category: '娱乐消费', subcategory: '游戏', date: '2026-10-09', note: '', createdAt: '2026-10-09T12:00:00.000Z' },
    { id: '5', amount: 30, category: '固定支出', subcategory: '话费', date: '2026-10-10', note: '月租', createdAt: '2026-10-10T09:00:00.000Z' },
    { id: '6', amount: 150, category: '应急支出', subcategory: '突发维修', date: '2026-10-10', note: '键盘', createdAt: '2026-10-10T10:00:00.000Z' }
  ]),
  collegeLifeBudgetSettingsV2: JSON.stringify({ living: 2000, savings: 600, study: 200, fixed: 120, entertainment: 80, unexpected: 200, nonmeal: 150, dailyDining: 35, emergencyReserve: 1000 }),
  collegeLifeAchievementsV1: JSON.stringify({
    accounting_newbie: { title: '记账新人', desc: '完成第一笔有效账目', unlockedAt: '2026-09-20T08:00:00.000Z' },
    cat_explorer: { title: '分类探索者', desc: '在真实消费中使用至少 3 个不同消费分类', unlockedAt: '2026-09-21T08:00:00.000Z' }
  }),
  collegeLifeLevelV1: JSON.stringify({ xp: 65, best: 1 }),
  collegeLifeTimelineV1: JSON.stringify([
    { id: 'first_expense', type: '记账', title: '完成第一笔有效账目', at: '2026-09-20T08:00:00.000Z' },
    { id: 'achievement:accounting_newbie', type: '成就', title: '解锁成就：记账新人', at: '2026-09-20T08:00:00.000Z' }
  ])
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((seedData) => {
  Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => ({ register: () => Promise.resolve() }) });
  if (seedData) Object.entries(seedData).forEach(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); });
}, seed);
await ctx.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname !== 'app.local') return route.abort();
  let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
  const file = path.join(ROOT, p);
  try { const b = fs.readFileSync(file); await route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: b }); }
  catch (e) { await route.fulfill({ status: 404, body: 'not found' }); }
});
const page = await ctx.newPage();
await page.goto('http://app.local/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(OUT, '01-splash.png') });
await page.waitForSelector('#splashScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(OUT, '02-home-light.png') });
await page.evaluate(() => { document.querySelectorAll('[data-theme]').forEach((b) => { if (b.getAttribute('data-theme') === 'dark') b.click(); }); });
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(OUT, '03-home-dark.png') });
await page.click('.nav-button[data-page="statsPage"]');
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(OUT, '04-stats-dark.png') });
await page.click('.nav-button[data-page="achievementPage"]');
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(OUT, '05-achievement-dark-top.png') });
await page.screenshot({ path: path.join(OUT, '06-achievement-dark-list.png'), fullPage: true });
await page.click('.nav-button[data-page="recordPage"]');
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(OUT, '07-record-dark.png') });
await browser.close();
console.log('shots saved to ' + OUT);
