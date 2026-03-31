const API_BASE = window.location.origin;
const WS_URL = `ws://${window.location.host}`;

let ws;
let currentPage = 'home';
let currentAuction = null;
let currentBannerIndex = 0;
let countdownTimers = {};

document.addEventListener('DOMContentLoaded', function() {
  connectWebSocket();
  loadInitialData();
  initBanner();
});

function connectWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'bid_update') {
      handleBidUpdate(message.data);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleBidUpdate(data) {
  if (currentAuction && currentAuction.auction_id === data.auction_id) {
    const priceEl = document.getElementById('currentBidPrice');
    const countEl = document.getElementById('bidCount');
    
    if (priceEl) priceEl.textContent = data.price.toFixed(2);
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    
    addBidRecord(data.username, data.price, '刚刚');
  }
  
  const cardPrice = document.querySelector(`.auction-card[data-id="${data.auction_id}"] .current-price`);
  if (cardPrice) {
    cardPrice.textContent = data.price.toFixed(2);
  }
}

async function loadInitialData() {
  try {
    const [auctionsRes, categoriesRes, bannersRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/api/auctions?status=live`).then(r => r.json()),
      fetch(`${API_BASE}/api/categories`).then(r => r.json()),
      fetch(`${API_BASE}/api/banners`).then(r => r.json()),
      fetch(`${API_BASE}/api/stats`).then(r => r.json())
    ]);
    
    if (auctionsRes.success) {
      renderAuctionList(auctionsRes.data);
    }
    
    if (categoriesRes.success) {
      renderCategories(categoriesRes.data);
    }
    
    if (bannersRes.success) {
      renderBanners(bannersRes.data);
    }
    
    if (statsRes.success) {
      updateStats(statsRes.data);
    }
    
    startCountdowns();
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

function renderBanners(banners) {
  const track = document.getElementById('bannerTrack');
  const dotsContainer = document.getElementById('bannerDots');
  
  track.innerHTML = banners.map(banner => `
    <div class="banner-slide">
      <img src="${banner.image_url}" alt="${banner.title}">
      <div class="banner-content">
        <h3>${banner.title}</h3>
        <p>${banner.subtitle}</p>
      </div>
    </div>
  `).join('');
  
  dotsContainer.innerHTML = '';
  banners.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dotsContainer.appendChild(dot);
  });
}

function renderCategories(categories) {
  const container = document.querySelector('.quick-entry');
  container.innerHTML = categories.map(cat => `
    <div class="entry-item" onclick="filterByCategory('${cat.slug}')">
      <div class="entry-icon">${cat.icon}</div>
      <span>${cat.name}</span>
    </div>
  `).join('');
}

function renderAuctionList(auctions) {
  const list = document.getElementById('auctionList');
  
  list.innerHTML = auctions.map(auction => `
    <div class="auction-card" data-id="${auction.auction_id}" onclick="showDetail('${auction.auction_id}')">
      <div class="card-image">
        <img src="${auction.cover_image || ''}" alt="${auction.name}" loading="lazy">
        <div class="card-badges">
          <span class="badge badge-grade">${auction.grade}级</span>
          <span class="badge badge-live">LIVE</span>
          <span class="badge badge-trace">可溯源</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">
          <span>${auction.name}</span>
          <span class="card-countdown" id="countdown-${auction.auction_id}">${formatTime(auction.countdown)}</span>
        </div>
        <div class="card-info">
          <span class="info-item">重量: <strong>${auction.weight}</strong></span>
          <span class="info-item">产地: <strong>${auction.origin}</strong></span>
          <span class="info-item">出价: <strong>${auction.bid_count}次</strong></span>
        </div>
        <div class="card-footer">
          <div class="price-info">
            <span class="current-price">${auction.current_price.toFixed(2)}</span>
            <span class="start-price">起拍价 ¥${auction.start_price.toFixed(2)}${auction.unit}</span>
          </div>
          <button class="bid-btn" onclick="event.stopPropagation(); showBid('${auction.auction_id}')">立即出价</button>
        </div>
      </div>
    </div>
  `).join('');
  
  countdownTimers = {};
  auctions.forEach(a => {
    countdownTimers[a.auction_id] = a.countdown;
  });
}

function initBanner() {
  setInterval(() => {
    const track = document.getElementById('bannerTrack');
    const slides = track.children.length;
    if (slides === 0) return;
    
    currentBannerIndex = (currentBannerIndex + 1) % slides;
    track.style.transform = `translateX(-${currentBannerIndex * 100}%)`;
    updateBannerDots();
  }, 4000);
}

function updateBannerDots() {
  const dots = document.querySelectorAll('.banner-dots .dot');
  dots.forEach((dot, i) => {
    dot.className = 'dot' + (i === currentBannerIndex ? ' active' : '');
  });
}

function startCountdowns() {
  setInterval(() => {
    Object.keys(countdownTimers).forEach(id => {
      if (countdownTimers[id] > 0) {
        countdownTimers[id]--;
        const el = document.getElementById(`countdown-${id}`);
        if (el) {
          el.textContent = formatTime(countdownTimers[id]);
        }
      }
    });
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateStats(stats) {
  document.getElementById('todayAuctions').textContent = stats.todayAuctions;
  document.getElementById('todayDeals').textContent = stats.todayDeals;
  document.getElementById('onlineUsers').textContent = stats.onlineUsers.toLocaleString();
  
  setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`).then(r => r.json());
      if (res.success) {
        document.getElementById('onlineUsers').textContent = res.data.onlineUsers.toLocaleString();
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }, 5000);
}

async function filterByCategory(category) {
  try {
    const res = await fetch(`${API_BASE}/api/auctions?category=${category}&status=live`).then(r => r.json());
    if (res.success) {
      renderAuctionList(res.data);
    }
  } catch (error) {
    console.error('Failed to filter auctions:', error);
  }
  
  document.querySelectorAll('.entry-item').forEach(item => {
    item.style.opacity = '0.6';
  });
  event.currentTarget.style.opacity = '1';
}

async function showDetail(auctionId) {
  try {
    const res = await fetch(`${API_BASE}/api/auctions/${auctionId}`).then(r => r.json());
    if (!res.success) return;
    
    currentAuction = res.data;
    renderDetailPage(currentAuction);
    switchPage('detailPage');
  } catch (error) {
    console.error('Failed to load auction detail:', error);
  }
}

function renderDetailPage(auction) {
  const content = document.getElementById('detailContent');
  const coverImage = auction.images?.find(img => img.isCover)?.url || auction.images?.[0]?.url || '';
  
  content.innerHTML = `
    <div class="detail-images">
      <img src="${coverImage}" alt="${auction.name}" id="detailMainImage">
      <div class="image-dots">
        ${auction.images?.map((img, i) => `<span class="dot ${i === 0 ? 'active' : ''}" onclick="switchDetailImage(${i})"></span>`).join('') || ''}
      </div>
    </div>
    
    <div class="detail-section">
      <h3><span class="section-icon">&#x1F34E;</span> ${auction.name}</h3>
      <div class="card-info" style="margin-bottom: 12px;">
        <span class="info-item">批次号: <strong>${auction.auction_id}</strong></span>
        <span class="info-item">重量: <strong>${auction.weight}</strong></span>
        <span class="info-item">产地: <strong>${auction.origin}</strong></span>
      </div>
      <div class="grade-result">
        <div class="grade-badge">${auction.grade}</div>
        <div class="grade-info">
          <h4>${auction.grade_desc}</h4>
          <p>智能分级系统自动评定</p>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h3><span class="section-icon">&#x1F52C;</span> 检测数据</h3>
      <div class="test-data">
        <div class="data-item">
          <div class="data-label">糖度</div>
          <div class="data-value">${auction.testResults?.sugar || '-'}<span class="data-unit">°Brix</span></div>
          <div class="data-status">&#x2713; 达标</div>
        </div>
        <div class="data-item">
          <div class="data-label">硬度</div>
          <div class="data-value">${auction.testResults?.hardness || '-'}<span class="data-unit">kg/cm²</span></div>
          <div class="data-status">&#x2713; 达标</div>
        </div>
        <div class="data-item">
          <div class="data-label">酸度</div>
          <div class="data-value">${auction.testResults?.acidity || '-'}<span class="data-unit">%</span></div>
          <div class="data-status">&#x2713; 达标</div>
        </div>
        <div class="data-item">
          <div class="data-label">农残检测</div>
          <div class="data-value">${auction.testResults?.pesticide || '-'}</div>
          <div class="data-status">&#x2713; 安全</div>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h3><span class="section-icon">&#x1F4CD;</span> 溯源信息</h3>
      <div class="trace-list">
        ${auction.traceInfo?.map(trace => `
          <div class="trace-item">
            <div class="trace-dot">&#x2713;</div>
            <div class="trace-content">
              <h4>${trace.title}</h4>
              <p>${trace.desc}</p>
            </div>
          </div>
        `).join('') || '<p>暂无溯源信息</p>'}
      </div>
    </div>
    
    <div class="detail-section" style="background: linear-gradient(135deg, var(--accent), #FF8C5A); color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 12px; opacity: 0.8;">当前价</div>
          <div style="font-size: 28px; font-weight: 700;">¥${auction.current_price.toFixed(2)}<span style="font-size: 14px;">${auction.unit}</span></div>
        </div>
        <button class="bid-btn" style="background: white; color: var(--accent);" onclick="showBid('${auction.auction_id}')">
          参与竞价
        </button>
      </div>
      <div style="display: flex; justify-content: space-around; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);">
        <div style="text-align: center;">
          <div style="font-size: 16px; font-weight: 600;">${auction.bid_count}</div>
          <div style="font-size: 11px; opacity: 0.8;">出价次数</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 16px; font-weight: 600;">${auction.viewers}</div>
          <div style="font-size: 11px; opacity: 0.8;">围观人数</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 16px; font-weight: 600;">¥${auction.start_price.toFixed(2)}</div>
          <div style="font-size: 11px; opacity: 0.8;">起拍价</div>
        </div>
      </div>
    </div>
  `;
  
  window._detailImages = auction.images || [];
}

function switchDetailImage(index) {
  const img = document.getElementById('detailMainImage');
  if (window._detailImages[index]) {
    img.src = window._detailImages[index].url;
  }
  document.querySelectorAll('.image-dots .dot').forEach((dot, i) => {
    dot.className = 'dot' + (i === index ? 'active' : '');
  });
}

async function showBid(auctionId) {
  try {
    const [auctionRes, bidsRes] = await Promise.all([
      fetch(`${API_BASE}/api/auctions/${auctionId}`).then(r => r.json()),
      fetch(`${API_BASE}/api/auctions/${auctionId}/bids`).then(r => r.json())
    ]);
    
    if (!auctionRes.success) return;
    
    currentAuction = auctionRes.data;
    const bids = bidsRes.success ? bidsRes.data : [];
    
    renderBidPage(currentAuction, bids);
    switchPage('bidPage');
    startBidCountdown();
  } catch (error) {
    console.error('Failed to load bid page:', error);
  }
}

function renderBidPage(auction, bids) {
  const content = document.getElementById('bidContent');
  const coverImage = auction.images?.find(img => img.isCover)?.url || auction.images?.[0]?.url || '';
  
  content.innerHTML = `
    <div class="bid-product">
      <div class="bid-product-img">
        <img src="${coverImage}" alt="${auction.name}">
      </div>
      <div class="bid-product-info">
        <h3>${auction.name}</h3>
        <p>批次: ${auction.auction_id} | ${auction.grade}级</p>
        <p>${auction.weight} | ${auction.origin}</p>
      </div>
    </div>
    
    <div class="price-display">
      <div class="price-label">当前最高价</div>
      <div class="price-value" id="currentBidPrice">${auction.current_price.toFixed(2)}</div>
      <div class="price-unit">${auction.unit}</div>
      <div class="bid-stats">
        <div class="bid-stat-item">
          <div class="bid-stat-val" id="bidCount">${auction.bid_count}</div>
          <div class="bid-stat-label">出价次数</div>
        </div>
        <div class="bid-stat-item">
          <div class="bid-stat-val">${auction.viewers}</div>
          <div class="bid-stat-label">围观人数</div>
        </div>
        <div class="bid-stat-item">
          <div class="bid-stat-val" id="bidCountdown">${formatTime(countdownTimers[auction.auction_id] || 300)}</div>
          <div class="bid-stat-label">剩余时间</div>
        </div>
      </div>
    </div>
    
    <div class="bid-records">
      <h4><span class="live-dot"></span> 实时出价记录</h4>
      <div id="bidRecordsList">
        ${bids.map(bid => `
          <div class="record-item">
            <span class="record-user"><strong>${bid.username}</strong></span>
            <span class="record-price">¥${bid.price.toFixed(2)}</span>
            <span class="record-time">${formatTimeAgo(bid.created_at)}</span>
          </div>
        `).join('') || '<p style="text-align: center; color: var(--text-light); padding: 20px;">暂无出价记录</p>'}
      </div>
    </div>
    
    <div class="bid-action">
      <div class="bid-amount-display">
        <label>您的出价</label>
        <div class="bid-input-wrapper">
          <button class="quick-bid-btn" onclick="adjustBid(-0.05)">-</button>
          <input type="number" class="bid-input" id="bidInput" value="${(auction.current_price + 0.05).toFixed(2)}" step="0.05" min="${(auction.current_price + 0.05).toFixed(2)}">
          <button class="quick-bid-btn" onclick="adjustBid(0.05)">+</button>
        </div>
      </div>
      <div class="bid-presets">
        <button class="preset-btn" onclick="setBidPreset(0.05)">+0.05</button>
        <button class="preset-btn" onclick="setBidPreset(0.1)">+0.10</button>
        <button class="preset-btn" onclick="setBidPreset(0.2)">+0.20</button>
        <button class="preset-btn" onclick="setBidPreset(0.5)">+0.50</button>
      </div>
      <button class="submit-bid-btn" onclick="submitBid()">确认出价</button>
    </div>
  `;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '刚刚';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

function adjustBid(amount) {
  const input = document.getElementById('bidInput');
  let val = parseFloat(input.value) + amount;
  const min = currentAuction.current_price + 0.05;
  if (val < min) val = min;
  input.value = val.toFixed(2);
}

function setBidPreset(amount) {
  const input = document.getElementById('bidInput');
  input.value = (currentAuction.current_price + amount).toFixed(2);
}

async function submitBid() {
  const input = document.getElementById('bidInput');
  const bidPrice = parseFloat(input.value);
  
  if (bidPrice <= currentAuction.current_price) {
    alert('出价必须高于当前最高价！');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_id: currentAuction.auction_id,
        user_id: 'BUY20240089',
        username: '采购商_张明',
        price: bidPrice
      })
    }).then(r => r.json());
    
    if (res.success) {
      currentAuction.current_price = bidPrice;
      currentAuction.bid_count++;
      
      document.getElementById('currentBidPrice').textContent = bidPrice.toFixed(2);
      document.getElementById('bidCount').textContent = currentAuction.bid_count;
      
      addBidRecord('采购商_张明', bidPrice, '刚刚');
      
      showToast('出价成功！当前最高价');
    } else {
      alert(res.error || '出价失败，请重试');
    }
  } catch (error) {
    console.error('Failed to submit bid:', error);
    alert('网络错误，请重试');
  }
}

function addBidRecord(user, price, time) {
  const list = document.getElementById('bidRecordsList');
  if (!list) return;
  
  const emptyMsg = list.querySelector('p');
  if (emptyMsg) emptyMsg.remove();
  
  const item = document.createElement('div');
  item.className = 'record-item';
  item.innerHTML = `
    <span class="record-user"><strong>${user}</strong></span>
    <span class="record-price">¥${price.toFixed(2)}</span>
    <span class="record-time">${time}</span>
  `;
  list.insertBefore(item, list.firstChild);
}

function startBidCountdown() {
  if (!currentAuction) return;
  
  const updateBidCountdown = () => {
    const el = document.getElementById('bidCountdown');
    if (el && countdownTimers[currentAuction.auction_id] > 0) {
      el.textContent = formatTime(countdownTimers[currentAuction.auction_id]);
    }
    if (countdownTimers[currentAuction.auction_id] > 0) {
      setTimeout(updateBidCountdown, 1000);
    }
  };
  updateBidCountdown();
}

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
}

function goBack() {
  switchPage('homePage');
  currentPage = 'home';
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  if (tab === 'home' || tab === 'auction') {
    switchPage('homePage');
  }
  
  if (tab === 'auction') {
    setTimeout(() => {
      document.querySelector('.section-header')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
  
  currentPage = tab;
}

async function showNotifications() {
  try {
    const res = await fetch(`${API_BASE}/api/notifications?userId=BUY20240089`).then(r => r.json());
    if (res.success) {
      renderNotifications(res.data);
    }
  } catch (error) {
    console.error('Failed to load notifications:', error);
  }
  document.getElementById('notificationModal').classList.add('active');
}

function renderNotifications(notifications) {
  const body = document.querySelector('#notificationModal .modal-body');
  body.innerHTML = notifications.map(notif => `
    <div class="notification-item">
      <div class="notif-icon ${notif.type === 'success' ? 'success' : notif.type === 'warning' ? 'warning' : 'info'}">
        ${notif.type === 'success' ? '&#x2713;' : notif.type === 'warning' ? '&#x1F514;' : '&#x1F4E6;'}
      </div>
      <div class="notif-content">
        <p class="notif-title">${notif.title}</p>
        <p class="notif-desc">${notif.content}</p>
        <span class="notif-time">${formatTimeAgo(notif.created_at)}</span>
      </div>
    </div>
  `).join('') || '<p style="text-align: center; color: var(--text-light); padding: 20px;">暂无通知</p>';
}

async function showProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/users/BUY20240089`).then(r => r.json());
    if (res.success) {
      renderProfile(res.data);
    }
  } catch (error) {
    console.error('Failed to load user profile:', error);
  }
  document.getElementById('profileModal').classList.add('active');
}

function renderProfile(user) {
  const body = document.querySelector('#profileModal .modal-body');
  body.innerHTML = `
    <div class="profile-header-card">
      <div class="avatar">&#x1F464;</div>
      <div class="user-info">
        <h4>${user.username}</h4>
        <p class="user-id">ID: ${user.user_id}</p>
        <span class="user-badge">${user.is_verified ? '认证采购商' : '普通用户'}</span>
      </div>
    </div>
    <div class="profile-stats">
      <div class="p-stat">
        <span class="p-stat-val">${user.deals_count}</span>
        <span class="p-stat-label">成交</span>
      </div>
      <div class="p-stat">
        <span class="p-stat-val">${user.active_bids}</span>
        <span class="p-stat-label">竞价中</span>
      </div>
      <div class="p-stat">
        <span class="p-stat-val">${user.rating}%</span>
        <span class="p-stat-label">好评率</span>
      </div>
    </div>
    <div class="profile-menu">
      <div class="menu-item">
        <span>&#x1F4CB;</span>
        <span>我的订单</span>
        <span class="arrow">&gt;</span>
      </div>
      <div class="menu-item">
        <span>&#x1F4B0;</span>
        <span>资金管理 (¥${user.balance?.toLocaleString() || 0})</span>
        <span class="arrow">&gt;</span>
      </div>
      <div class="menu-item">
        <span>&#x1F4E6;</span>
        <span>物流跟踪</span>
        <span class="arrow">&gt;</span>
      </div>
      <div class="menu-item">
        <span>&#x2699;&#xFE0F;</span>
        <span>设置</span>
        <span class="arrow">&gt;</span>
      </div>
    </div>
  `;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function shareAuction() {
  if (navigator.share && currentAuction) {
    navigator.share({
      title: currentAuction.name,
      text: `快来参与${currentAuction.name}的拍卖！`,
      url: window.location.href
    });
  } else {
    showToast('链接已复制到剪贴板');
  }
}

function showToast(message) {
  const toast = document.getElementById('bidSuccessToast');
  toast.querySelector('.toast-text').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
