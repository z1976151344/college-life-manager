const { createRequire } = await import('module');
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/HW/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Users/HW/Documents/Codex/2026-10-09/https-z1976151344-github-io-college-life';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html':'text/html; charset=utf-8', '.json':'application/json', '.js':'text/javascript', '.png':'image/png', '.css':'text/css' };

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail: detail === undefined ? '' : String(detail) });
}
async function measure(label, fn) {
  const start = Date.now();
  const extra = await fn();
  return { label, ms: Date.now() - start, ...(extra || {}) };
}

async function makeContext(browser, seed, opts) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((seedData) => {
    Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => ({ register: () => Promise.resolve() }) });
    if (seedData) {
      Object.entries(seedData).forEach(([k, v]) => {
        if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
      });
    }
  }, seed);
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'app.local') return route.abort();
    let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    const file = path.join(ROOT, p);
    try {
      const body = fs.readFileSync(file);
      await route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body });
    } catch (e) {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
  return context;
}
async function runE2e(mode) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const metrics = [];
  try {
    /* ================= A. 全新用户 ================= */
    {
      const ctx = await makeContext(browser, null);
      const page = await ctx.newPage();
      const boot = await measure('fresh_boot_to_splash_hidden', async () => {
        await page.goto('http://app.local/index.html', { waitUntil: 'domcontentloaded' });
        const snapshot = await page.evaluate(() => {
          const splash = document.getElementById('splashScreen');
          const logo = document.getElementById('splashLogo');
          return {
            splashGone: !splash,
            logoVisible: !!logo && !logo.hidden,
            logoSrc: logo ? logo.getAttribute('src') : '',
            bg: splash ? getComputedStyle(splash).backgroundColor : null
          };
        });
        if (snapshot.splashGone) {
          check('A_splash_visible_early', false, 'splash already removed when inspected');
        } else {
          check('A_splash_bg_deep_navy', snapshot.bg === 'rgb(16, 24, 32)', 'bg=' + snapshot.bg);
          check('A_splash_logo_512', snapshot.logoSrc === './icons/icon-splash-512.png', snapshot.logoSrc);
        }
        await page.waitForSelector('#splashScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
        return { splashGoneEarly: snapshot.splashGone };
      });
      metrics.push(boot);

      const home = await measure('fresh_home_render', async () => {
        await page.waitForFunction(() => {
          const el = document.querySelector('.hero-note');
          return el && /计算|超支/.test(el.textContent);
        }, null, { timeout: 5000 });
      });
      metrics.push(home);

      // 记账第 1 笔 -> accounting_newbie 解锁 + 20 XP
      await page.click('.nav-button[data-page="recordPage"]');
      await page.click('[data-category="正餐"]');
      await page.click('[data-subcategory="午餐"]');
      await page.fill('#amountInput', '12.5');
      await page.click('#expenseForm button[type="submit"]');
      await page.waitForFunction(() => document.querySelectorAll('.record-item').length >= 1, null, { timeout: 5000 });
      const xpAfter1 = await page.evaluate(() => JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}').xp || 0);
      check('A_first_expense_xp_20', xpAfter1 === 20, 'xp=' + xpAfter1);
      const unlocked1 = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        return Object.keys(saved);
      });
      check('A_newbie_unlocked', unlocked1.indexOf('accounting_newbie') !== -1, unlocked1.join(','));

      // 再记 2 笔（本周共 3 笔），选择挑战后完成 -> +15 XP，且不重复发放
      for (let i = 0; i < 2; i++) {
        await page.click('[data-category="正餐"]');
        await page.click('[data-subcategory="午餐"]');
        await page.fill('#amountInput', '8');
        await page.click('#expenseForm button[type="submit"]');
      }
      await page.waitForFunction(() => document.querySelectorAll('.record-item').length >= 3, null, { timeout: 5000 });
      const xpBeforeChallenge = await page.evaluate(() => JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}').xp || 0);
      check('A_no_dup_xp_for_2nd_expense', xpBeforeChallenge === 20, 'xp=' + xpBeforeChallenge);

      await page.click('.nav-button[data-page="achievementPage"]');
      const achRender = await measure('fresh_achievement_render', async () => {
        await page.waitForFunction(() => document.querySelectorAll('#achievementList .achievement-item').length >= 30, null, { timeout: 6000 });
      });
      metrics.push(achRender);
      const achInfo = await page.evaluate(() => ({
        total: document.querySelectorAll('#achievementList .achievement-item').length,
        unlockedCount: document.getElementById('achievementUnlockedCount').textContent,
        levelName: document.querySelector('.level-name') ? document.querySelector('.level-name').textContent : '',
        xpText: document.querySelector('.level-xp-text') ? document.querySelector('.level-xp-text').textContent : '',
        challengeVisible: !!document.querySelector('.challenge-head'),
        timelineVisible: !!document.querySelector('.timeline-row'),
        hiddenItems: document.querySelectorAll('#achievementList .achievement-item .ach-hidden-hint').length
      }));
      check('A_achievement_total_ge_30', achInfo.total >= 30, 'total=' + achInfo.total);
      check('A_level_card_renders', achInfo.levelName.length > 0 && achInfo.xpText.indexOf('经验') > -1, achInfo.levelName + '/' + achInfo.xpText);
      check('A_challenge_card_renders', achInfo.challengeVisible, '');
      check('A_timeline_card_renders', achInfo.timelineVisible, '');
      check('A_hidden_achievements_show_hint', achInfo.hiddenItems >= 3, 'hints=' + achInfo.hiddenItems);

      // 选择"记录 3 笔"挑战 -> 立即完成 +15 XP
      await page.click('[data-challenge-pick="challenge_record_3"]');
      await page.waitForTimeout(200);
      const xpAfterPick = await page.evaluate(() => JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}').xp || 0);
      check('A_challenge_completed_xp_35', xpAfterPick === 35, 'xp=' + xpAfterPick);
      const challengeDone = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('collegeLifeChallengesV1') || '{}');
        return data.completedIds && data.completedIds.challenge_record_3;
      });
      check('A_challenge_persisted_done', !!challengeDone, JSON.stringify(challengeDone));

      // 成就详情展开 5 次 -> 隐藏成就 detail_finder 解锁
      const xpBeforeDetail = await page.evaluate(() => JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}').xp || 0);
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => { document.querySelectorAll('#achievementList .achievement-item').forEach((el) => el.classList.remove('detail-open')); });
        await page.click('#achievementList .achievement-item >> nth=0 >> .achievement-item-desc');
      }
      await page.waitForTimeout(300);
      const detailAfter = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        const level = JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}');
        return { unlocked: Boolean(saved.detail_finder), xp: level.xp || 0 };
      });
      check('A_hidden_detail_finder_unlocked', detailAfter.unlocked, '');
      check('A_hidden_detail_finder_xp_20', detailAfter.xp === xpBeforeDetail + 20, 'xp=' + detailAfter.xp + ' before=' + xpBeforeDetail);
      await page.evaluate(() => { document.querySelectorAll('#achievementList .achievement-item').forEach((el) => el.classList.remove('detail-open')); });

      // 收藏已解锁徽章 -> collector 解锁 +10 XP
      await page.click('[data-achievement-favorite="accounting_newbie"]');
      await page.waitForTimeout(200);
      const collectorInfo = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        const prefs = JSON.parse(localStorage.getItem('collegeLifeAchievementPrefsV1') || '{}');
        const level = JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}');
        return { collector: Boolean(saved.collector), favorites: prefs.favorites || [], xp: level.xp || 0 };
      });
      check('A_collector_unlocked', collectorInfo.collector, '');
      check('A_favorite_saved', collectorInfo.favorites.indexOf('accounting_newbie') !== -1, JSON.stringify(collectorInfo.favorites));
      check('A_favorite_xp_10_gained', collectorInfo.xp === detailAfter.xp + 10, 'xp=' + collectorInfo.xp + ' detail=' + detailAfter.xp);

      // 周复盘 -> week_reviewer
      await page.click('.nav-button[data-page="statsPage"]');
      await page.waitForSelector('#openWeekReviewButton', { timeout: 5000 });
      const weekButtonText = await page.textContent('#openWeekReviewButton');
      await page.click('#openWeekReviewButton');
      await page.waitForSelector('#weekReviewModal:not([hidden])', { timeout: 5000 });
      await page.click('#weekReviewConfirm');
      await page.waitForTimeout(300);
      const weekReviewer = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        return Boolean(saved.week_reviewer);
      });
      check('A_week_reviewer_unlocked', weekReviewer, '');
      check('A_week_button_disabled', weekButtonText.indexOf('周复盘') !== -1, weekButtonText);

      // 统计页浏览（本月有数据）-> data_familiar
      const dataFamiliar = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        return Boolean(saved.data_familiar);
      });
      check('A_data_familiar_unlocked', dataFamiliar, '');

      // 深色主题
      await page.click('.nav-button[data-page="budgetPage"]');
      const themeButtons = await page.$$('.theme-button');
      await page.evaluate(() => {
        document.querySelectorAll('[data-theme]').forEach((b) => { if (b.getAttribute('data-theme') === 'dark') b.click(); });
      });
      await page.waitForTimeout(200);
      const darkState = await page.evaluate(() => {
        const html = document.documentElement;
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const pageVar = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
        return { attr: html.getAttribute('data-theme'), bodyBg: bodyBg, pageVar: pageVar };
      });
      check('A_dark_theme_applied', darkState.attr === 'dark' && darkState.pageVar === '#101820' && darkState.bodyBg === 'rgb(16, 24, 32)', JSON.stringify(darkState));
      await page.evaluate(() => { document.querySelectorAll('[data-theme]').forEach((b) => { if (b.getAttribute('data-theme') === 'light') b.click(); }); });

      // 备份导出 -> data_guardian（按钮在预算页的数据管理中）
      await page.click('.nav-button[data-page="budgetPage"]');
      await page.waitForSelector('#exportBackupButton', { timeout: 5000 });
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await page.click('#exportBackupButton');
      const download = await downloadPromise;
      check('A_backup_download_triggered', !!download, download ? download.suggestedFilename() : 'no download');
      await page.waitForTimeout(200);
      const guardianInfo = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        return Boolean(saved.data_guardian);
      });
      check('A_data_guardian_unlocked', guardianInfo, '');

      // 删除账目后进度反映真实数据（records_100 文本变化）
      await page.click('.nav-button[data-page="recordPage"]');
      page.on('dialog', (dialog) => dialog.accept());
      await page.click('.record-item [data-delete-id] >> nth=0');
      await page.waitForTimeout(400);
      const deleteInfo = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#achievementList .achievement-item'));
        const rec = items.find((el) => el.getAttribute('data-achievement-id') === 'records_100');
        return { recordCount: JSON.parse(localStorage.getItem('collegeLifeExpensesV1') || '[]').length, recText: rec ? rec.textContent : '' };
      });
      check('A_delete_reduces_record_count', deleteInfo.recordCount === 2, 'count=' + deleteInfo.recordCount);

      // 持久化：刷新后等级/收藏/挑战仍在
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splashScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
      const persist = await page.evaluate(() => {
        const level = JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}');
        const prefs = JSON.parse(localStorage.getItem('collegeLifeAchievementPrefsV1') || '{}');
        const challenges = JSON.parse(localStorage.getItem('collegeLifeChallengesV1') || '{}');
        return { xp: level.xp, favorites: prefs.favorites, picked: challenges.pickedId };
      });
      check('A_persist_xp_after_reload', persist.xp >= 45, 'xp=' + persist.xp);
      check('A_persist_favorites_after_reload', persist.favorites.indexOf('accounting_newbie') !== -1, JSON.stringify(persist.favorites));
      check('A_persist_challenge_after_reload', persist.picked === 'challenge_record_3', JSON.stringify(persist.picked));
      await ctx.close();
    }

    /* ================= B. 减少动态效果 ================= */
    {
      const ctx = await makeContext(browser, null, { reducedMotion: true });
      const page = await ctx.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const boot = await measure('reduced_boot', async () => {
        await page.goto('http://app.local/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(300);
        const splashGone = await page.evaluate(() => !document.getElementById('splashScreen'));
        return { splashGone };
      });
      metrics.push(boot);
      check('B_reduced_motion_no_splash', boot.splashGone, '');
      const usable = await page.evaluate(() => {
        const hero = document.querySelector('.hero-note');
        return !!hero && hero.textContent.length > 0;
      });
      check('B_reduced_motion_usable_home', usable, '');
      await ctx.close();
    }

    /* ================= C. 老用户迁移与防重复 ================= */
    {
      const seed = {
        collegeLifeExpensesV1: JSON.stringify([
          { id: '1', amount: 12, category: '正餐', subcategory: '午餐', date: '2026-10-01', note: '食堂', createdAt: '2026-10-01T10:00:00.000Z' },
          { id: '2', amount: 20, category: '非正餐', subcategory: '奶茶饮料', date: '2026-10-02', note: '奶茶', createdAt: '2026-10-02T10:00:00.000Z' },
          { id: '3', amount: 45, category: '学习成长', subcategory: '教材资料', date: '2026-10-03', note: '高数', createdAt: '2026-10-03T10:00:00.000Z' }
        ]),
        collegeLifeBudgetSettingsV2: JSON.stringify({ living: 2000, savings: 600, study: 200, fixed: 120, entertainment: 80, unexpected: 200, nonmeal: 150, dailyDining: 35, emergencyReserve: 1000 }),
        collegeLifeAchievementsV1: JSON.stringify({
          first_record: { title: '记账新人', desc: '完成第一笔有效账目', unlockedAt: '2026-09-20T08:00:00.000Z' },
          week_streak: { title: '记账达人', desc: '连续 7 个有效记账日', unlockedAt: '2026-09-21T08:00:00.000Z' }
        })
      };
      const ctx = await makeContext(browser, seed);
      const page = await ctx.newPage();
      const boot = await measure('seeded_boot', async () => {
        await page.goto('http://app.local/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#splashScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
      });
      metrics.push(boot);
      await page.waitForTimeout(400);
      const migrated = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        const level = JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}');
        return {
          hasNewbie: Boolean(saved.accounting_newbie),
          hasMaster: Boolean(saved.accounting_master),
          oldGone: !saved.first_record && !saved.week_streak,
          newbieAt: saved.accounting_newbie ? saved.accounting_newbie.unlockedAt : '',
          xp: level.xp || 0
        };
      });
      check('C_migration_old_ids_mapped', migrated.hasNewbie && migrated.hasMaster && migrated.oldGone, JSON.stringify(migrated));
      check('C_migration_keeps_unlock_time', migrated.newbieAt === '2026-09-20T08:00:00.000Z', migrated.newbieAt);

      const xp1 = migrated.xp;

      // 合并解锁提示（预算+应急储备+多分类同时达成），在首次加载的展示窗口内读取
      const toastText = await page.evaluate(() => {
        const toast = document.getElementById('achievementToast');
        return toast && !toast.hidden ? toast.textContent : '';
      });
      check('C_merged_unlock_toast', toastText.indexOf('共解锁') !== -1 || toastText.indexOf('恭喜解锁') !== -1, toastText);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splashScreen', { state: 'detached', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const xp2 = await page.evaluate(() => JSON.parse(localStorage.getItem('collegeLifeLevelV1') || '{}').xp || 0);
      check('C_no_dup_xp_after_reload', xp2 === xp1, 'xp1=' + xp1 + ' xp2=' + xp2);

      // 成就总数与等级
      const page3Info = await page.evaluate(() => {
        document.querySelector('.nav-button[data-page="achievementPage"]').click();
        return true;
      });
      await page.waitForTimeout(500);
      const achPage = await page.evaluate(() => ({
        total: document.querySelectorAll('#achievementList .achievement-item').length,
        unlockedCount: document.getElementById('achievementUnlockedCount').textContent
      }));
      check('C_seeded_total_ge_30', achPage.total >= 30, 'total=' + achPage.total);
      const seededUnlocked = parseInt(achPage.unlockedCount.split('/')[0].trim(), 10);
      check('C_seeded_unlocked_ge_8', seededUnlocked >= 8, 'unlocked=' + achPage.unlockedCount);

      // 统计页浏览（多月份趋势观察员）：模拟上月查看记录
      const trendInfo = await page.evaluate(() => {
        const events = JSON.parse(localStorage.getItem('collegeLifeEventsV1') || '{}');
        events.view_stats = events.view_stats || { count: 0, refs: {}, months: {} };
        events.view_stats.months['2026-09'] = (events.view_stats.months['2026-09'] || 0) + 1;
        localStorage.setItem('collegeLifeEventsV1', JSON.stringify(events));
        return true;
      });
      await page.click('.nav-button[data-page="statsPage"]');
      await page.waitForTimeout(400);
      const trendUnlocked = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('collegeLifeAchievementsV1') || '{}');
        return Boolean(saved.trend_observer);
      });
      check('C_trend_observer_unlocked', trendUnlocked, '');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({
    mode,
    metrics,
    checks: { total: results.length, passed, failed: failed.length },
    failures: failed,
    results
  }, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

runE2e(process.argv[2] || 'v6').catch((e) => { console.error('E2E_FATAL', e); process.exit(1); });
