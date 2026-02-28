// ============================================================
//  每日好消息 · Service Worker
//  功能：离线缓存 + 后台定时推送通知
// ============================================================

const CACHE_NAME = 'good-news-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=ZCOOL+XiaoWei&family=Quicksand:wght@400;500;600;700&display=swap'
];

// ---- 内置好消息数据（供后台推送使用） ----
const PUSH_NEWS = [
  { cat: "warmth", title: "比尔·盖茨宣布将捐出99%的财富", comment: "一个人的慷慨，能照亮整个大陆的未来。" },
  { cat: "warmth", title: "英国健身教练为弱势群体免费训练获大奖", comment: "力量不只在肌肉里，更在善意的行动中。" },
  { cat: "warmth", title: "旧金山金门大桥安装安全网后自杀率降低73%", comment: "一张网，兜住了多少生命的希望。" },
  { cat: "warmth", title: "退役军人完成240天超级铁人三项为慈善筹款", comment: "从海峡到珠峰，每一步都在传递勇气与希望。" },
  { cat: "warmth", title: "美国谋杀率降至历史最低水平", comment: "数字在下降，安全感在上升。世界正在变得更好。" },
  { cat: "warmth", title: "爱尔兰将艺术家基本收入保障计划永久化", comment: "当一个国家守护艺术家的梦想，整个社会的灵魂都被照亮了。" },
  { cat: "tech", title: "CRISPR首次为单个患者定制治疗方案", comment: "生命科技的温度，在于让每一个独特的生命都有被治愈的可能。" },
  { cat: "tech", title: "亨廷顿舞蹈病历史上首次被成功治疗", comment: "75%的减缓，意味着无数家庭多了几十年相守的时光。" },
  { cat: "tech", title: "可再生能源首次超越煤炭成为全球最大电力来源", comment: "清洁的阳光正在照亮全世界。" },
  { cat: "tech", title: "西北大学工程师造出世界最小起搏器", comment: "小到肉眼难见的装置，守护着最脆弱的小小心跳。" },
  { cat: "tech", title: "肺癌和胰腺癌疫苗进入临床试验阶段", comment: "从预防到治疗，人类正在赢得与癌症的这场持久战。" },
  { cat: "tech", title: "AI天气预报首次准确预测飓风路径", comment: "当科技学会读懂风云，就能为更多人撑起保护伞。" },
  { cat: "tech", title: "科学家开发出可自愈裂缝的可持续混凝土", comment: "连混凝土都学会了自我修复，这是材料科学的浪漫。" },
  { cat: "culture", title: "巴黎圣母院双塔在大火六年后重新开放", comment: "八百年的石头会说话——美好的事物终将回来。" },
  { cat: "culture", title: "Ed Sheeran创立基金会支持英国音乐教育", comment: "一把吉他改变了他的人生，现在他要传递给更多孩子。" },
  { cat: "culture", title: "大规模公共艺术项目让动物木偶穿越两万公里", comment: "当纸板变成长颈鹿，艺术就有了改变世界的力量。" },
  { cat: "culture", title: "毛利族女性在去世近百年后获牛津追授学位", comment: "迟到一个世纪的学位证，是对知识与坚韧永恒的致敬。" },
  { cat: "culture", title: "绿海龟从濒危物种名单中成功降级", comment: "当人类愿意守护，大自然就会给出最美的回答。" },
  { cat: "culture", title: "巴西亚马逊雨林火灾减少65%创历史最低", comment: "雨林在恢复呼吸，地球之肺正在被治愈。" },
  { cat: "culture", title: "研究发现唱歌课程可有效治疗产后抑郁", comment: "当妈妈们唱起歌来，旋律不仅治愈了情绪，也连接了彼此。" }
];

const CAT_EMOJIS = { warmth: '🧡', tech: '🚀', culture: '🎨' };
const CAT_LABELS = { warmth: '暖心故事', tech: '科技突破', culture: '文化艺术' };

// ============================================================
//  INSTALL - 缓存静态资源
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
//  ACTIVATE - 清理旧缓存 + 启动定时器
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );

  // 启动后台定时检查
  startPeriodicCheck();
});

// ============================================================
//  FETCH - 缓存优先策略（网络优先更新缓存）
// ============================================================
self.addEventListener('fetch', (event) => {
  // 跳过非GET请求和外部API
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 对RSS API等外部请求走网络优先
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 本地资源：缓存优先 + 后台更新
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ============================================================
//  MESSAGE - 接收来自页面的消息
// ============================================================
self.addEventListener('message', (event) => {
  const data = event.data;

  if (data.type === 'UPDATE_NOTIF_SETTINGS') {
    // 存储通知设置到 Service Worker 范围
    self._notifSettings = data.settings;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'TEST_NOTIFICATION') {
    showGoodNewsNotification();
  }
});

// ============================================================
//  PERIODIC SYNC - 后台定期检查（如果浏览器支持）
// ============================================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-good-news') {
    event.waitUntil(checkAndNotify());
  }
});

// ============================================================
//  PUSH - 接收推送事件（为将来接入服务端推送预留）
// ============================================================
self.addEventListener('push', (event) => {
  event.waitUntil(showGoodNewsNotification());
});

// ============================================================
//  NOTIFICATION CLICK - 点击通知打开页面
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // 如果已有标签页打开，聚焦它
      for (const client of clients) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      // 否则打开新标签页
      return self.clients.openWindow('./');
    })
  );
});

// ============================================================
//  后台定时检查逻辑
// ============================================================
let _checkInterval = null;

function startPeriodicCheck() {
  // 每30秒检查一次是否到了推送时间
  if (_checkInterval) clearInterval(_checkInterval);
  _checkInterval = setInterval(() => {
    checkAndNotify();
  }, 30000);

  // 也尝试注册 Periodic Background Sync（Chrome 支持）
  self.registration.periodicSync && self.registration.periodicSync.register('daily-good-news', {
    minInterval: 12 * 60 * 60 * 1000 // 12小时
  }).catch(() => { /* 不支持则忽略 */ });
}

async function checkAndNotify() {
  const settings = self._notifSettings || { hour: 8, min: 0, browserEnabled: false };
  if (!settings.browserEnabled) return;

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h !== settings.hour || m !== settings.min) return;

  // 通过 Cache API 存储今天是否已推送（避免重复）
  const todayKey = now.toDateString();
  const cache = await caches.open('good-news-state');
  const lastPushResp = await cache.match('last-push-date');
  const lastPush = lastPushResp ? await lastPushResp.text() : '';

  if (lastPush === todayKey) return; // 今天已推送

  // 标记已推送
  await cache.put('last-push-date', new Response(todayKey));

  // 发送通知
  await showGoodNewsNotification();

  // 通知页面刷新历史
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'NOTIFICATION_SENT' });
  });
}

async function showGoodNewsNotification() {
  const news = PUSH_NEWS[Math.floor(Math.random() * PUSH_NEWS.length)];
  const emoji = CAT_EMOJIS[news.cat] || '✨';
  const label = CAT_LABELS[news.cat] || '';

  return self.registration.showNotification(
    `${emoji} 每日好消息 · ${label}`,
    {
      body: `${news.title}\n\n💬 ${news.comment}`,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'daily-good-news',
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { cat: news.cat, title: news.title },
      actions: [
        { action: 'open', title: '查看更多好消息' },
        { action: 'dismiss', title: '知道了' }
      ]
    }
  );
}
