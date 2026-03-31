const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  const dbPath = path.join(__dirname, 'auction.db');
  let dbData = null;
  if (fs.existsSync(dbPath)) {
    dbData = fs.readFileSync(dbPath);
  }
  
  if (dbData) {
    db = new SQL.Database(dbData);
  } else {
    db = new SQL.Database();
  }
  
  createTables();
  seedData();
  saveDatabase();
  
  console.log('Database initialized successfully');
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      phone TEXT,
      company TEXT,
      avatar TEXT,
      is_verified INTEGER DEFAULT 0,
      balance REAL DEFAULT 0,
      deals_count INTEGER DEFAULT 0,
      active_bids INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      slug TEXT UNIQUE NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      grade TEXT NOT NULL,
      grade_desc TEXT,
      weight TEXT,
      origin TEXT,
      start_price REAL NOT NULL,
      current_price REAL NOT NULL,
      unit TEXT DEFAULT '元/斤',
      bid_count INTEGER DEFAULT 0,
      viewers INTEGER DEFAULT 0,
      countdown INTEGER DEFAULT 300,
      status TEXT DEFAULT 'live',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS auction_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      is_cover INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER UNIQUE NOT NULL,
      sugar REAL,
      hardness REAL,
      acidity REAL,
      pesticide TEXT,
      moisture REAL,
      vitamin_c REAL,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS trace_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      description TEXT,
      trace_time TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `);
  
  console.log('Tables created successfully');
}

function seedData() {
  const categoriesCheck = db.exec("SELECT COUNT(*) as cnt FROM categories");
  if (categoriesCheck.length > 0 && categoriesCheck[0].values[0][0] > 0) {
    return;
  }
  
  db.run("INSERT INTO categories (name, icon, slug) VALUES ('全部', '🍇', 'all')");
  db.run("INSERT INTO categories (name, icon, slug) VALUES ('苹果', '🍎', 'apple')");
  db.run("INSERT INTO categories (name, icon, slug) VALUES ('柑橘', '🍊', 'orange')");
  db.run("INSERT INTO categories (name, icon, slug) VALUES ('葡萄', '🍇', 'grape')");
  db.run("INSERT INTO categories (name, icon, slug) VALUES ('桃子', '🍑', 'peach')");
  
  db.run(`INSERT INTO users (user_id, username, phone, company, is_verified, balance, deals_count, active_bids, rating) 
    VALUES ('BUY20240089', '采购商_张明', '138****5678', '鲜果供应链有限公司', 1, 50000, 12, 5, 98)`);
  db.run(`INSERT INTO users (user_id, username, phone, company, is_verified, balance, deals_count, active_bids, rating) 
    VALUES ('BUY20240012', '采购商_李华', '139****1234', '华果贸易有限公司', 1, 80000, 28, 3, 96)`);
  db.run(`INSERT INTO users (user_id, username, phone, company, is_verified, balance, deals_count, active_bids, rating) 
    VALUES ('BUY20240034', '采购商_王强', '137****8765', '强盛果品批发', 1, 65000, 15, 2, 99)`);
  db.run(`INSERT INTO users (user_id, username, phone, company, is_verified, balance, deals_count, active_bids, rating) 
    VALUES ('BUY20240056', '采购商_赵丽', '136****4321', '丽达水果连锁', 1, 120000, 45, 8, 97)`);
  db.run(`INSERT INTO users (user_id, username, phone, company, is_verified, balance, deals_count, active_bids, rating) 
    VALUES ('BUY20240078', '采购商_刘伟', '135****9876', '伟达农产品', 1, 35000, 8, 1, 95)`);
  
  const appleCat = db.exec("SELECT id FROM categories WHERE slug='apple'");
  const orangeCat = db.exec("SELECT id FROM categories WHERE slug='orange'");
  const grapeCat = db.exec("SELECT id FROM categories WHERE slug='grape'");
  const peachCat = db.exec("SELECT id FROM categories WHERE slug='peach'");
  
  const appleId = appleCat[0].values[0][0];
  const orangeId = orangeCat[0].values[0][0];
  const grapeId = grapeCat[0].values[0][0];
  const peachId = peachCat[0].values[0][0];
  
  db.run(`INSERT INTO auctions (auction_id, name, category_id, grade, grade_desc, weight, origin, start_price, current_price, unit, bid_count, viewers, countdown, status, description)
    VALUES ('A2024001', '陕西红富士苹果 特级果', ${appleId}, 'A+', '特级果，果径80-85mm，色泽鲜艳，无瑕疵', '5000kg', '陕西洛川', 2.8, 3.45, '元/斤', 28, 156, 300, 'live', '产自陕西洛川核心产区，采用标准化种植管理，果实饱满圆润，色泽鲜艳，口感脆甜多汁。')`);
  
  db.run(`INSERT INTO auctions (auction_id, name, category_id, grade, grade_desc, weight, origin, start_price, current_price, unit, bid_count, viewers, countdown, status, description)
    VALUES ('A2024002', '赣南脐橙 一级精品', ${orangeId}, 'A', '一级果，果径70-75mm，皮薄多汁', '8000kg', '江西赣州', 2.2, 2.85, '元/斤', 19, 98, 480, 'live', '来自江西赣州脐橙之乡，自然成熟，果肉细嫩化渣，汁多味甜，富含维生素C。')`);
  
  db.run(`INSERT INTO auctions (auction_id, name, category_id, grade, grade_desc, weight, origin, start_price, current_price, unit, bid_count, viewers, countdown, status, description)
    VALUES ('A2024003', '阳光玫瑰葡萄 特级', ${grapeId}, 'A+', '特级果，单串500-600g，糖度18+', '2000kg', '云南宾川', 8.5, 11.2, '元/斤', 42, 235, 180, 'live', '云南宾川高原产区出品，阳光充足，昼夜温差大，果实晶莹剔透，玫瑰香味浓郁。')`);
  
  db.run(`INSERT INTO auctions (auction_id, name, category_id, grade, grade_desc, weight, origin, start_price, current_price, unit, bid_count, viewers, countdown, status, description)
    VALUES ('A2024004', '水蜜桃 优质精选', ${peachId}, 'A', '优质果，单果200-250g，果肉细腻', '3000kg', '浙江奉化', 4.5, 5.8, '元/斤', 15, 87, 600, 'live', '浙江奉化水蜜桃，中国地理标志产品，果肉柔软多汁，入口即化，甜蜜芬芳。')`);
  
  db.run(`INSERT INTO auctions (auction_id, name, category_id, grade, grade_desc, weight, origin, start_price, current_price, unit, bid_count, viewers, countdown, status, description)
    VALUES ('A2024005', '阿克苏冰糖心苹果', ${appleId}, 'A+', '特级果，果径85-90mm，冰糖心明显', '6000kg', '新疆阿克苏', 3.5, 4.2, '元/斤', 35, 189, 420, 'live', '新疆阿克苏红旗坡核心产区，昼夜温差大，糖分积累充分，切开后冰糖心清晰可见。')`);
  
  const auction1 = db.exec("SELECT id FROM auctions WHERE auction_id='A2024001'");
  const a1id = auction1[0].values[0][0];
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a1id}, 'https://images.unsplash.com/photo-1568702846914-96b305d3aa86?w=800&h=400&fit=crop', 1, 0)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a1id}, 'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=800&h=400&fit=crop', 0, 1)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a1id}, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&h=400&fit=crop', 0, 2)`);
  
  const auction2 = db.exec("SELECT id FROM auctions WHERE auction_id='A2024002'");
  const a2id = auction2[0].values[0][0];
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a2id}, 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&h=400&fit=crop', 1, 0)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a2id}, 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=800&h=400&fit=crop', 0, 1)`);
  
  const auction3 = db.exec("SELECT id FROM auctions WHERE auction_id='A2024003'");
  const a3id = auction3[0].values[0][0];
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a3id}, 'https://images.unsplash.com/photo-1596363505729-4190a9506133?w=800&h=400&fit=crop', 1, 0)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a3id}, 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&h=400&fit=crop', 0, 1)`);
  
  const auction4 = db.exec("SELECT id FROM auctions WHERE auction_id='A2024004'");
  const a4id = auction4[0].values[0][0];
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a4id}, 'https://images.unsplash.com/photo-1629828874514-c1e5103f2100?w=800&h=400&fit=crop', 1, 0)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a4id}, 'https://images.unsplash.com/photo-16475199cb55441b33be671c2397e25d?w=800&h=400&fit=crop', 0, 1)`);
  
  const auction5 = db.exec("SELECT id FROM auctions WHERE auction_id='A2024005'");
  const a5id = auction5[0].values[0][0];
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a5id}, 'https://images.unsplash.com/photo-1584306354290-cf90e8d23c3f?w=800&h=400&fit=crop', 1, 0)`);
  db.run(`INSERT INTO auction_images (auction_id, image_url, is_cover, sort_order) VALUES 
    (${a5id}, 'https://images.unsplash.com/photo-1576179635659-328be3a91d49?w=800&h=400&fit=crop', 0, 1)`);
  
  db.run(`INSERT INTO test_results (auction_id, sugar, hardness, acidity, pesticide, moisture, vitamin_c) 
    VALUES (${a1id}, 14.2, 8.5, 0.35, '未检出', 85.6, 4.2)`);
  db.run(`INSERT INTO test_results (auction_id, sugar, hardness, acidity, pesticide, moisture, vitamin_c) 
    VALUES (${a2id}, 12.8, 6.2, 0.82, '合格', 88.3, 52.5)`);
  db.run(`INSERT INTO test_results (auction_id, sugar, hardness, acidity, pesticide, moisture, vitamin_c) 
    VALUES (${a3id}, 18.6, 7.8, 0.28, '未检出', 81.2, 3.8)`);
  db.run(`INSERT INTO test_results (auction_id, sugar, hardness, acidity, pesticide, moisture, vitamin_c) 
    VALUES (${a4id}, 13.5, 5.2, 0.42, '合格', 90.1, 8.6)`);
  db.run(`INSERT INTO test_results (auction_id, sugar, hardness, acidity, pesticide, moisture, vitamin_c) 
    VALUES (${a5id}, 16.8, 7.9, 0.31, '未检出', 84.5, 4.8)`);
  
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a1id}, '种植采摘', '2024-10-15 陕西洛川果园', '10月15日', 0)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a1id}, '分级检测', '2024-10-18 智能分选中心', '10月18日', 1)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a1id}, '冷链入库', '2024-10-19 0-4°C恒温库', '10月19日', 2)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a1id}, '上架拍卖', '2024-10-22 鲜果拍平台', '10月22日', 3)`);
  
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a2id}, '种植采摘', '2024-10-20 江西赣州果园', '10月20日', 0)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a2id}, '分级检测', '2024-10-22 智能分选中心', '10月22日', 1)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a2id}, '冷链入库', '2024-10-23 0-6°C恒温库', '10月23日', 2)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a2id}, '上架拍卖', '2024-10-25 鲜果拍平台', '10月25日', 3)`);
  
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a3id}, '种植采摘', '2024-10-10 云南宾川基地', '10月10日', 0)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a3id}, '分级检测', '2024-10-12 智能分选中心', '10月12日', 1)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a3id}, '冷链入库', '2024-10-13 -1~0°C恒温库', '10月13日', 2)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a3id}, '上架拍卖', '2024-10-15 鲜果拍平台', '10月15日', 3)`);
  
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a4id}, '种植采摘', '2024-10-18 浙江奉化桃园', '10月18日', 0)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a4id}, '分级检测', '2024-10-20 智能分选中心', '10月20日', 1)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a4id}, '冷链入库', '2024-10-21 0-2°C恒温库', '10月21日', 2)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a4id}, '上架拍卖', '2024-10-23 鲜果拍平台', '10月23日', 3)`);
  
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a5id}, '种植采摘', '2024-10-25 新疆阿克苏果园', '10月25日', 0)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a5id}, '分级检测', '2024-10-28 智能分选中心', '10月28日', 1)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a5id}, '冷链入库', '2024-10-29 -1~0°C恒温库', '10月29日', 2)`);
  db.run(`INSERT INTO trace_records (auction_id, step_name, description, trace_time, sort_order) VALUES 
    (${a5id}, '上架拍卖', '2024-11-01 鲜果拍平台', '11月01日', 3)`);
  
  db.run(`INSERT INTO bids (auction_id, user_id, username, price) VALUES 
    (${a1id}, 'BUY20240012', '采购商_李华', 3.45)`);
  db.run(`INSERT INTO bids (auction_id, user_id, username, price) VALUES 
    (${a1id}, 'BUY20240034', '采购商_王强', 3.40)`);
  db.run(`INSERT INTO bids (auction_id, user_id, username, price) VALUES 
    (${a1id}, 'BUY20240089', '采购商_张明', 3.35)`);
  db.run(`INSERT INTO bids (auction_id, user_id, username, price) VALUES 
    (${a1id}, 'BUY20240056', '采购商_赵丽', 3.30)`);
  db.run(`INSERT INTO bids (auction_id, user_id, username, price) VALUES 
    (${a1id}, 'BUY20240078', '采购商_刘伟', 3.25)`);
  
  db.run(`INSERT INTO notifications (user_id, type, title, content) VALUES 
    ('BUY20240089', 'success', '竞价成功', '您已成功竞得批次 #A2024001 红富士苹果')`);
  db.run(`INSERT INTO notifications (user_id, type, title, content) VALUES 
    ('BUY20240089', 'warning', '出价提醒', '批次 #A2024005 有人出价超过您的报价')`);
  db.run(`INSERT INTO notifications (user_id, type, title, content) VALUES 
    ('BUY20240089', 'info', '新品上架', '阳光玫瑰葡萄新批次已上架，快来围观')`);
  
  db.run(`INSERT INTO banners (title, subtitle, image_url, sort_order) VALUES 
    ('优质水果 在线竞拍', '源头直供 品质保障', 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&h=300&fit=crop', 0)`);
  db.run(`INSERT INTO banners (title, subtitle, image_url, sort_order) VALUES 
    ('智能分级 溯源可查', '每批水果 全程透明', 'https://images.unsplash.com/photo-1568702846914-96b305d3aa86?w=800&h=300&fit=crop', 1)`);
  db.run(`INSERT INTO banners (title, subtitle, image_url, sort_order) VALUES 
    ('实时竞价 公平交易', '远程参与 轻松竞标', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&h=300&fit=crop', 2)`);
  
  console.log('Seed data inserted');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, 'auction.db'), buffer);
}

// API Routes
app.get('/api/auctions', (req, res) => {
  try {
    const { category, status } = req.query;
    let query = `
      SELECT a.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon,
        (SELECT image_url FROM auction_images WHERE auction_id = a.id AND is_cover = 1 LIMIT 1) as cover_image
      FROM auctions a 
      LEFT JOIN categories c ON a.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (category && category !== 'all') {
      query += ' AND c.slug = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const result = db.exec(query, params);
    const auctions = [];
    
    if (result.length > 0) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const auction = {};
        columns.forEach((col, i) => {
          auction[col] = row[i];
        });
        auctions.push(auction);
      });
    }
    
    res.json({ success: true, data: auctions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auctions/:auctionId', (req, res) => {
  try {
    const { auctionId } = req.params;
    
    const auctionResult = db.exec(
      `SELECT a.*, c.name as category_name, c.slug as category_slug 
       FROM auctions a 
       LEFT JOIN categories c ON a.category_id = c.id 
       WHERE a.auction_id = ?`,
      [auctionId]
    );
    
    if (auctionResult.length === 0 || auctionResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: 'Auction not found' });
    }
    
    const columns = auctionResult[0].columns;
    const auction = {};
    auctionResult[0].values[0].forEach((val, i) => {
      auction[columns[i]] = val;
    });
    
    const imagesResult = db.exec(
      'SELECT id, image_url, is_cover, sort_order FROM auction_images WHERE auction_id = ? ORDER BY sort_order',
      [auction.id]
    );
    auction.images = [];
    if (imagesResult.length > 0) {
      imagesResult[0].values.forEach(row => {
        auction.images.push({
          id: row[0],
          url: row[1],
          isCover: row[2],
          sortOrder: row[3]
        });
      });
    }
    
    const testResult = db.exec(
      'SELECT * FROM test_results WHERE auction_id = ?',
      [auction.id]
    );
    auction.testResults = null;
    if (testResult.length > 0 && testResult[0].values.length > 0) {
      const testCols = testResult[0].columns;
      auction.testResults = {};
      testResult[0].values[0].forEach((val, i) => {
        if (testCols[i] !== 'id' && testCols[i] !== 'auction_id') {
          auction.testResults[testCols[i]] = val;
        }
      });
    }
    
    const traceResult = db.exec(
      'SELECT step_name, description, trace_time FROM trace_records WHERE auction_id = ? ORDER BY sort_order',
      [auction.id]
    );
    auction.traceInfo = [];
    if (traceResult.length > 0) {
      traceResult[0].values.forEach(row => {
        auction.traceInfo.push({
          title: row[0],
          desc: row[1],
          time: row[2]
        });
      });
    }
    
    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auctions/:auctionId/bids', (req, res) => {
  try {
    const { auctionId } = req.params;
    const result = db.exec(
      `SELECT a.id, a.auction_id, b.user_id, b.username, b.price, b.created_at 
       FROM bids b 
       JOIN auctions a ON b.auction_id = a.id 
       WHERE a.auction_id = ? 
       ORDER BY b.created_at DESC 
       LIMIT 50`,
      [auctionId]
    );
    
    const bids = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const bid = {};
        columns.forEach((col, i) => {
          bid[col] = row[i];
        });
        bids.push(bid);
      });
    }
    
    res.json({ success: true, data: bids });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bids', (req, res) => {
  try {
    const { auction_id, user_id, username, price } = req.body;
    
    if (!auction_id || !user_id || !price) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const auctionResult = db.exec(
      'SELECT id, current_price FROM auctions WHERE auction_id = ?',
      [auction_id]
    );
    
    if (auctionResult.length === 0 || auctionResult[0].values.length === 0) {
      return res.status(404).json({ success: false, error: 'Auction not found' });
    }
    
    const auctionDbId = auctionResult[0].values[0][0];
    const currentPrice = auctionResult[0].values[0][1];
    
    if (price <= currentPrice) {
      return res.status(400).json({ success: false, error: 'Bid must be higher than current price' });
    }
    
    db.run('BEGIN TRANSACTION');
    
    db.run(
      'INSERT INTO bids (auction_id, user_id, username, price) VALUES (?, ?, ?, ?)',
      [auctionDbId, user_id, username, price]
    );
    
    db.run(
      'UPDATE auctions SET current_price = ?, bid_count = bid_count + 1, updated_at = CURRENT_TIMESTAMP WHERE auction_id = ?',
      [price, auction_id]
    );
    
    db.run('COMMIT');
    saveDatabase();
    
    broadcastBidUpdate({
      auction_id,
      user_id,
      username,
      price,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Bid placed successfully', data: { price } });
  } catch (error) {
    db.run('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM categories ORDER BY id');
    const categories = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const cat = {};
        columns.forEach((col, i) => {
          cat[col] = row[i];
        });
        categories.push(cat);
      });
    }
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/banners', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order');
    const banners = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const banner = {};
        columns.forEach((col, i) => {
          banner[col] = row[i];
        });
        banners.push(banner);
      });
    }
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const todayAuctions = db.exec("SELECT COUNT(*) FROM auctions WHERE status = 'live'");
    const todayDeals = db.exec("SELECT COUNT(DISTINCT auction_id) FROM bids");
    const onlineUsers = db.exec("SELECT COUNT(*) FROM users");
    
    res.json({
      success: true,
      data: {
        todayAuctions: todayAuctions[0]?.values[0][0] || 0,
        todayDeals: todayDeals[0]?.values[0][0] || 0,
        onlineUsers: Math.floor(Math.random() * 500) + 2000
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const result = db.exec(
      'SELECT id, user_id, username, phone, company, avatar, is_verified, balance, deals_count, active_bids, rating FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const columns = result[0].columns;
    const user = {};
    result[0].values[0].forEach((val, i) => {
      user[columns[i]] = val[i];
    });
    
    const notifications = db.exec(
      'SELECT id, type, title, content, is_read, created_at FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    
    user.notifications = [];
    if (notifications.length > 0) {
      const notifCols = notifications[0].columns;
      notifications[0].values.forEach(row => {
        const notif = {};
        notifCols.forEach((col, i) => {
          notif[col] = row[i];
        });
        user.notifications.push(notif);
      });
    }
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications', (req, res) => {
  try {
    const { userId } = req.query;
    const result = db.exec(
      'SELECT id, type, title, content, is_read, created_at FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 20',
      [userId || 'BUY20240089']
    );
    
    const notifications = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      result[0].values.forEach(row => {
        const notif = {};
        columns.forEach((col, i) => {
          notif[col] = row[i];
        });
        notifications.push(notif);
      });
    }
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket for real-time updates
function broadcastBidUpdate(data) {
  const message = JSON.stringify({
    type: 'bid_update',
    data
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastAuctionUpdate(data) {
  const message = JSON.stringify({
    type: 'auction_update',
    data
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

setInterval(() => {
  const result = db.exec("SELECT auction_id, current_price, bid_count, countdown FROM auctions WHERE status = 'live'");
  if (result.length > 0) {
    const columns = result[0].columns;
    result[0].values.forEach(row => {
      const auction = {};
      columns.forEach((col, i) => {
        auction[col] = row[i];
      });
      
      if (auction.countdown > 0) {
        db.run('UPDATE auctions SET countdown = countdown - 1 WHERE auction_id = ?', [auction.auction_id]);
      }
    });
    saveDatabase();
  }
}, 1000);

setInterval(() => {
  const result = db.exec("SELECT auction_id, current_price, bid_count FROM auctions WHERE status = 'live' ORDER BY RANDOM() LIMIT 1");
  if (result.length > 0 && result[0].values.length > 0) {
    const auctionId = result[0].values[0][0];
    let currentPrice = result[0].values[0][1];
    let bidCount = result[0].values[0][2];
    
    const increment = [0.05, 0.1, 0.15, 0.2][Math.floor(Math.random() * 4)];
    const newPrice = currentPrice + increment;
    const users = ['采购商_李华', '采购商_王强', '采购商_赵丽', '采购商_刘伟', '采购商_陈静'];
    const userIds = ['BUY20240012', 'BUY20240034', 'BUY20240056', 'BUY20240078', 'BUY20240090'];
    const randomIndex = Math.floor(Math.random() * users.length);
    
    db.run(
      'UPDATE auctions SET current_price = ?, bid_count = bid_count + 1 WHERE auction_id = ?',
      [newPrice, auctionId]
    );
    
    const auctionResult = db.exec('SELECT id FROM auctions WHERE auction_id = ?', [auctionId]);
    if (auctionResult.length > 0) {
      const auctionDbId = auctionResult[0].values[0][0];
      db.run(
        'INSERT INTO bids (auction_id, user_id, username, price) VALUES (?, ?, ?, ?)',
        [auctionDbId, userIds[randomIndex], users[randomIndex], newPrice]
      );
    }
    
    saveDatabase();
    
    broadcastBidUpdate({
      auction_id: auctionId,
      user_id: userIds[randomIndex],
      username: users[randomIndex],
      price: newPrice,
      timestamp: new Date().toISOString()
    });
  }
}, 10000);

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
