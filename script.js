/**
 * Store Asset Management System - Core JavaScript Application Logic
 * Role-Based Access Control (RBAC) + Supabase Cloud Backend + LocalStorage Cache
 */

// ==========================================
// 1. SUPABASE CLIENT CONFIGURATION
// ==========================================

const SUPABASE_URL = 'https://tdnqsqltzyhfjyfsxunb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0npn9hSGloSlBf53Co4ZJw_YYhkwFfh';

let supabaseClient = null;
if (window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase client initialized successfully.');
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
  }
}

// ==========================================
// 2. ADMIN ACCOUNTS & DEFAULT SEED DATA
// ==========================================

// 3 Admin Accounts - Same permissions & role
const DEFAULT_ADMINS = [
  { username: 'admin1', name: 'System Admin 1', password: 'adminpass1', role: 'admin' },
  { username: 'admin2', name: 'System Admin 2', password: 'adminpass2', role: 'admin' },
  { username: 'admin3', name: 'System Admin 3', password: 'adminpass3', role: 'admin' }
];

const DEFAULT_STORES = [
  { code: 'STORE-01', name: 'Downtown Branch Store', password: 'pass123' },
  { code: 'STORE-02', name: 'Uptown Branch Store', password: 'pass123' },
  { code: 'HQ-MAIN', name: 'Corporate Headquarters', password: 'admin123' }
];

const SEED_ASSETS_STORE_01 = [
  {
    id: 'AST-1001',
    name: 'Daikin Inverter Split Aircon 2.5HP',
    category: 'HVAC / Aircon',
    serial: 'AC-88392-DK',
    location: 'Main Sales Floor',
    status: 'Good',
    lastMaintenance: '2026-06-15',
    purchaseDate: '2023-04-10',
    value: 1450.00,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-06-15T10:00:00.000Z'
  },
  {
    id: 'AST-1002',
    name: 'NCR Voyix Touchscreen POS Terminal',
    category: 'POS & Cashier',
    serial: 'POS-77401-NC',
    location: 'Counter 01',
    status: 'Maintenance Needed',
    lastMaintenance: '2025-11-20',
    purchaseDate: '2022-09-01',
    value: 2100.00,
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0a670fc8078a?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-07-02T14:30:00.000Z'
  },
  {
    id: 'AST-1003',
    name: 'Dell Latitude 5540 Manager Laptop',
    category: 'Laptops & IT',
    serial: 'DL-99381-LT',
    location: 'Manager Office',
    status: 'Good',
    lastMaintenance: '2026-05-10',
    purchaseDate: '2024-01-15',
    value: 1250.00,
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-05-10T09:15:00.000Z'
  },
  {
    id: 'AST-1004',
    name: 'Commercial Double-Door Display Freezer',
    category: 'Refrigeration',
    serial: 'RF-44210-FZ',
    location: 'Beverage Aisle 3',
    status: 'Good',
    lastMaintenance: '2026-07-01',
    purchaseDate: '2021-08-20',
    value: 3800.00,
    imageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-07-01T11:20:00.000Z'
  },
  {
    id: 'AST-1005',
    name: 'Ford Transit Store Delivery Van',
    category: 'Vehicles',
    serial: 'VIN-99201-VAN',
    location: 'Back Parking Bay',
    status: 'Out of Service',
    lastMaintenance: '2026-04-05',
    purchaseDate: '2020-03-12',
    value: 28500.00,
    imageUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-07-18T16:00:00.000Z'
  }
];

const SEED_LOGS_STORE_01 = [
  {
    id: 'LOG-5001',
    assetId: 'AST-1001',
    date: '2026-06-15',
    technician: 'CoolTech HVAC Solutions',
    statusBefore: 'Maintenance Needed',
    statusAfter: 'Good',
    cost: 180.00,
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
    notes: 'Replaced air filters, cleaned condenser coils, and refilled R-410A refrigerant. Unit cooling efficiently now.'
  },
  {
    id: 'LOG-5002',
    assetId: 'AST-1002',
    date: '2026-07-02',
    technician: 'In-House IT Support',
    statusBefore: 'Good',
    statusAfter: 'Maintenance Needed',
    cost: 45.00,
    imageUrl: '',
    notes: 'Thermal receipt printer paper feeder jamming intermittently. Receipt cutter replacement part ordered.'
  },
  {
    id: 'LOG-5003',
    assetId: 'AST-1005',
    date: '2026-07-18',
    technician: 'Metro Auto Service Center',
    statusBefore: 'Good',
    statusAfter: 'Out of Service',
    cost: 850.00,
    imageUrl: '',
    notes: 'Transmission fluid leak diagnosed. Vehicle towed to mechanic workshop awaiting gearbox clutch replacement.'
  }
];

const SEED_ASSETS_STORE_02 = [
  {
    id: 'AST-2001',
    name: 'La Marzocco Commercial Espresso Machine',
    category: 'Kitchen Equipment',
    serial: 'LM-3031-ESP',
    location: 'Café Corner',
    status: 'Good',
    lastMaintenance: '2026-07-12',
    purchaseDate: '2023-02-14',
    value: 6200.00,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-07-12T08:00:00.000Z'
  },
  {
    id: 'AST-2002',
    name: 'Apple iPad Pro 12.9 POS Register',
    category: 'POS & Cashier',
    serial: 'IPD-88210-AP',
    location: 'Register 2',
    status: 'Good',
    lastMaintenance: '2026-05-30',
    purchaseDate: '2023-11-10',
    value: 1199.00,
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80',
    updatedAt: '2026-05-30T13:00:00.000Z'
  }
];

const SEED_LOGS_STORE_02 = [
  {
    id: 'LOG-6001',
    assetId: 'AST-2001',
    date: '2026-07-12',
    technician: 'Barista Tech Services',
    statusBefore: 'Maintenance Needed',
    statusAfter: 'Good',
    cost: 240.00,
    imageUrl: '',
    notes: 'Descaled group heads, replaced group gaskets, and recalibrated pump pressure to 9 bars.'
  }
];

// ==========================================
// 3. STORAGE & SUPABASE SYNC LAYER
// ==========================================
const DEFAULT_NOTIFICATIONS = [
  {
    id: 'NOTIF-01',
    recipientRole: 'admin',
    recipientStoreCode: null,
    title: 'Service Log Submitted',
    message: 'STORE-01 submitted a service log for HVAC Unit (AST-1001).',
    assetId: 'AST-1001',
    storeCode: 'STORE-01',
    isRead: false,
    type: 'log',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: 'NOTIF-02',
    recipientRole: 'store',
    recipientStoreCode: 'STORE-01',
    title: 'Admin Comment Reply',
    message: 'Admin admin1 replied to your comment on POS Terminal 01 (AST-1002).',
    assetId: 'AST-1002',
    storeCode: 'STORE-01',
    isRead: false,
    type: 'reply',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  }
];

class StorageManager {
  static initStorage() {
    if (!localStorage.getItem('ams_stores')) {
      localStorage.setItem('ams_stores', JSON.stringify(DEFAULT_STORES));
    }
    // Seed Store 01 if missing locally
    if (!localStorage.getItem('ams_assets_STORE-01')) {
      localStorage.setItem('ams_assets_STORE-01', JSON.stringify(SEED_ASSETS_STORE_01));
      localStorage.setItem('ams_logs_STORE-01', JSON.stringify(SEED_LOGS_STORE_01));
    }
    // Seed Store 02 if missing locally
    if (!localStorage.getItem('ams_assets_STORE-02')) {
      localStorage.setItem('ams_assets_STORE-02', JSON.stringify(SEED_ASSETS_STORE_02));
      localStorage.setItem('ams_logs_STORE-02', JSON.stringify(SEED_LOGS_STORE_02));
    }
    // Seed HQ if missing locally
    if (!localStorage.getItem('ams_assets_HQ-MAIN')) {
      localStorage.setItem('ams_assets_HQ-MAIN', JSON.stringify([]));
      localStorage.setItem('ams_logs_HQ-MAIN', JSON.stringify([]));
    }
    // Seed Notifications if missing locally
    if (!localStorage.getItem('ams_notifications')) {
      localStorage.setItem('ams_notifications', JSON.stringify(DEFAULT_NOTIFICATIONS));
    }

    // Async sync with Supabase in background
    StorageManager.syncWithSupabase();
  }

  static async syncWithSupabase() {
    if (!supabaseClient) return;

    try {
      // 1. Sync Stores from Supabase
      const { data: remoteStores, error: storesErr } = await supabaseClient.from('stores').select('*');
      if (!storesErr && remoteStores && remoteStores.length > 0) {
        const mappedStores = remoteStores.map(s => ({
          code: s.code,
          name: s.name,
          password: s.password
        }));
        StorageManager.saveStores(mappedStores);
        if (typeof renderStoreAccountsList === 'function') renderStoreAccountsList();
        if (typeof renderAdminStoreTable === 'function') renderAdminStoreTable();
      }

      // 2. Sync Assets from Supabase for Active Store
      const activeCode = StorageManager.getActiveStoreCode();
      if (activeCode) {
        const { data: remoteAssets, error: assetsErr } = await supabaseClient.from('assets').select('*').eq('store_code', activeCode);
        if (!assetsErr && remoteAssets && remoteAssets.length > 0) {
          const mappedAssets = remoteAssets.map(a => ({
            id: a.id,
            name: a.name,
            category: a.category,
            serial: a.serial,
            status: a.status,
            location: a.location,
            lastMaintenance: a.last_maintenance,
            value: parseFloat(a.value) || 0,
            imageUrl: a.image_url,
            updatedAt: a.updated_at
          }));
          StorageManager.saveAssets(activeCode, mappedAssets, false);
          if (AppState.activeStore && AppState.activeStore.code === activeCode) {
            AppState.assets = mappedAssets;
            if (typeof refreshAppUI === 'function') refreshAppUI();
          }
        }
      }

      // 3. Sync Notifications from Supabase
      const { data: remoteNotifs, error: notifErr } = await supabaseClient.from('notifications').select('*').order('created_at', { ascending: false });
      if (!notifErr && remoteNotifs && remoteNotifs.length > 0) {
        const mappedNotifs = remoteNotifs.map(n => ({
          id: n.id,
          recipientRole: n.recipient_role,
          recipientStoreCode: n.recipient_store_code,
          title: n.title,
          message: n.message,
          assetId: n.asset_id,
          storeCode: n.store_code,
          isRead: Boolean(n.is_read),
          type: n.type,
          createdAt: n.created_at
        }));
        StorageManager.saveNotifications(mappedNotifs, false);
        if (typeof renderNotifications === 'function') renderNotifications();
      }
    } catch (e) {
      console.log('Supabase sync note:', e.message);
    }
  }

  static getStores() {
    try {
      return JSON.parse(localStorage.getItem('ams_stores')) || DEFAULT_STORES;
    } catch {
      return DEFAULT_STORES;
    }
  }

  static saveStores(stores) {
    localStorage.setItem('ams_stores', JSON.stringify(stores));
  }

  static addStore(code, name, password, seedOption = 'empty') {
    const stores = StorageManager.getStores();
    const cleanCode = code.trim().toUpperCase();

    if (stores.some(s => s.code === cleanCode)) {
      return { success: false, message: `Store code "${cleanCode}" already exists.` };
    }

    const newStore = { code: cleanCode, name: name.trim(), password: password.trim() };
    stores.push(newStore);
    StorageManager.saveStores(stores);

    if (seedOption === 'seed') {
      localStorage.setItem(`ams_assets_${cleanCode}`, JSON.stringify(SEED_ASSETS_STORE_01));
      localStorage.setItem(`ams_logs_${cleanCode}`, JSON.stringify(SEED_LOGS_STORE_01));
    } else {
      localStorage.setItem(`ams_assets_${cleanCode}`, JSON.stringify([]));
      localStorage.setItem(`ams_logs_${cleanCode}`, JSON.stringify([]));
    }

    // Push to Supabase
    if (supabaseClient) {
      supabaseClient.from('stores').insert([newStore]).catch(err => console.log('Supabase store insert note:', err));
    }

    return { success: true, store: newStore };
  }

  static updateStoreCredentials(originalCode, newCode, name, password) {
    const stores = StorageManager.getStores();
    const cleanNewCode = newCode.trim().toUpperCase();

    if (originalCode !== cleanNewCode && stores.some(s => s.code === cleanNewCode)) {
      return { success: false, message: `Store code "${cleanNewCode}" already exists.` };
    }

    const idx = stores.findIndex(s => s.code === originalCode);
    if (idx === -1) return { success: false, message: 'Store not found.' };

    const updatedStore = { code: cleanNewCode, name: name.trim(), password: password.trim() };
    stores[idx] = updatedStore;

    if (originalCode !== cleanNewCode) {
      const assets = StorageManager.getAssets(originalCode);
      const logs = StorageManager.getLogs(originalCode);
      localStorage.setItem(`ams_assets_${cleanNewCode}`, JSON.stringify(assets));
      localStorage.setItem(`ams_logs_${cleanNewCode}`, JSON.stringify(logs));
      localStorage.removeItem(`ams_assets_${originalCode}`);
      localStorage.removeItem(`ams_logs_${originalCode}`);
    }

    StorageManager.saveStores(stores);

    if (supabaseClient) {
      supabaseClient.from('stores').upsert(updatedStore).catch(err => console.log('Supabase store update note:', err));
    }

    return { success: true, store: updatedStore };
  }

  static deleteStore(code) {
    let stores = StorageManager.getStores();
    stores = stores.filter(s => s.code !== code);
    StorageManager.saveStores(stores);
    localStorage.removeItem(`ams_assets_${code}`);
    localStorage.removeItem(`ams_logs_${code}`);

    if (supabaseClient) {
      supabaseClient.from('stores').delete().eq('code', code).catch(err => console.log('Supabase store delete note:', err));
    }
  }

  static getActiveStoreCode() {
    return localStorage.getItem('ams_active_store');
  }

  static setActiveStoreCode(storeCode) {
    if (storeCode) {
      localStorage.setItem('ams_active_store', storeCode);
    } else {
      localStorage.removeItem('ams_active_store');
    }
  }

  static getAssets(storeCode) {
    if (!storeCode) return [];
    try {
      return JSON.parse(localStorage.getItem(`ams_assets_${storeCode}`)) || [];
    } catch {
      return [];
    }
  }

  static saveAssets(storeCode, assets, pushToSupabase = true) {
    if (!storeCode) return;
    try {
      localStorage.setItem(`ams_assets_${storeCode}`, JSON.stringify(assets));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (pushToSupabase && supabaseClient) {
      const recordsToPush = assets.map(a => ({
        id: a.id,
        store_code: storeCode,
        name: a.name,
        category: a.category,
        serial: a.serial,
        status: a.status,
        location: a.location || '',
        last_maintenance: a.lastMaintenance || '',
        value: a.value || 0,
        image_url: a.imageUrl || '',
        updated_at: a.updatedAt || new Date().toISOString()
      }));

      supabaseClient.from('assets').upsert(recordsToPush).then(({ error }) => {
        if (error) console.log('Supabase asset push status:', error.message);
      }).catch(err => console.log('Supabase push note:', err));
    }
  }

  static getLogs(storeCode) {
    if (!storeCode) return [];
    try {
      return JSON.parse(localStorage.getItem(`ams_logs_${storeCode}`)) || [];
    } catch {
      return [];
    }
  }

  static saveLogs(storeCode, logs, pushToSupabase = true) {
    if (!storeCode) return;
    try {
      localStorage.setItem(`ams_logs_${storeCode}`, JSON.stringify(logs));
    } catch (e) {
      console.warn('LocalStorage save log error:', e);
    }

    if (pushToSupabase && supabaseClient) {
      const logsToPush = logs.map(l => ({
        id: l.id,
        asset_id: l.assetId,
        store_code: storeCode,
        date: l.date,
        technician: l.technician,
        status_before: l.statusBefore,
        status_after: l.statusAfter,
        cost: l.cost,
        image_url: l.imageUrl,
        notes: l.notes
      }));

      supabaseClient.from('maintenance_logs').upsert(logsToPush).then(({ error }) => {
        if (error) console.log('Supabase log push status:', error.message);
      }).catch(err => console.log('Supabase log push note:', err));
    }
  }

  static resetStoreData(storeCode) {
    if (storeCode === 'STORE-01') {
      localStorage.setItem('ams_assets_STORE-01', JSON.stringify(SEED_ASSETS_STORE_01));
      localStorage.setItem('ams_logs_STORE-01', JSON.stringify(SEED_LOGS_STORE_01));
    } else if (storeCode === 'STORE-02') {
      localStorage.setItem('ams_assets_STORE-02', JSON.stringify(SEED_ASSETS_STORE_02));
      localStorage.setItem('ams_logs_STORE-02', JSON.stringify(SEED_LOGS_STORE_02));
    } else {
      localStorage.setItem(`ams_assets_${storeCode}`, JSON.stringify([]));
      localStorage.setItem(`ams_logs_${storeCode}`, JSON.stringify([]));
    }
  }

  static getNotifications() {
    try {
      return JSON.parse(localStorage.getItem('ams_notifications')) || DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  }

  static saveNotifications(notifications, pushToSupabase = true) {
    try {
      localStorage.setItem('ams_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.warn('LocalStorage save notification error:', e);
    }

    if (pushToSupabase && supabaseClient) {
      const recordsToPush = notifications.map(n => ({
        id: n.id,
        recipient_role: n.recipientRole,
        recipient_store_code: n.recipientStoreCode || null,
        title: n.title,
        message: n.message,
        asset_id: n.assetId || null,
        store_code: n.storeCode || null,
        is_read: Boolean(n.isRead),
        type: n.type || 'info',
        created_at: n.createdAt || new Date().toISOString()
      }));

      supabaseClient.from('notifications').upsert(recordsToPush).then(({ error }) => {
        if (error) console.log('Supabase notification push status:', error.message);
      }).catch(err => console.log('Supabase notification push note:', err));
    }
  }

  static addNotification(notifData) {
    const notifications = StorageManager.getNotifications();
    const newNotif = {
      id: `NOTIF-${Math.floor(100000 + Math.random() * 900000)}`,
      recipientRole: notifData.recipientRole,
      recipientStoreCode: notifData.recipientStoreCode || null,
      title: notifData.title,
      message: notifData.message,
      assetId: notifData.assetId || null,
      storeCode: notifData.storeCode || null,
      isRead: false,
      type: notifData.type || 'info',
      createdAt: new Date().toISOString()
    };

    notifications.unshift(newNotif);
    StorageManager.saveNotifications(notifications, true);

    if (typeof renderNotifications === 'function') {
      renderNotifications();
    }

    return newNotif;
  }
}

// Initialize default storage on script load
StorageManager.initStorage();


// ==========================================
// 4. MAIN APPLICATION STATE & CONTROLLER
// ==========================================

const AppState = {
  loginMode: 'store', // 'store' | 'admin'
  currentUser: null, // { role: 'admin' | 'store', username?: string, storeCode?: string, name: string }
  activeStore: null,
  assets: [],
  logs: [],
  currentView: 'table', // 'table' | 'card'
  searchQuery: '',
  statusFilter: 'ALL',
  categoryFilter: 'ALL'
};

// Global DOM Selectors
const DOM = {
  // Views
  loginSection: document.getElementById('loginSection'),
  appSection: document.getElementById('appSection'),
  
  // Auth Form & Tabs
  tabStoreLogin: document.getElementById('tabStoreLogin'),
  tabAdminLogin: document.getElementById('tabAdminLogin'),
  loginForm: document.getElementById('loginForm'),
  loginLabelCode: document.getElementById('loginLabelCode'),
  loginStoreCode: document.getElementById('loginStoreCode'),
  loginPassword: document.getElementById('loginPassword'),
  loginError: document.getElementById('loginError'),
  loginErrorText: document.getElementById('loginErrorText'),
  loginSubmitBtnText: document.getElementById('loginSubmitBtnText'),
  adminAccountsSection: document.getElementById('adminAccountsSection'),
  storeAccountsSection: document.getElementById('storeAccountsSection'),
  storeListContainer: document.getElementById('storeListContainer'),

  // Header & Sidebar Elements
  roleBadge: document.getElementById('roleBadge'),
  roleDisplayName: document.getElementById('roleDisplayName'),
  activeStoreNameDisplay: document.getElementById('activeStoreNameDisplay'),
  activeStoreSelect: document.getElementById('activeStoreSelect'),
  adminManageStoresBtn: document.getElementById('adminManageStoresBtn'),
  userMenuBtn: document.getElementById('userMenuBtn'),
  userMenuDropdown: document.getElementById('userMenuDropdown'),
  dropdownUserRole: document.getElementById('dropdownUserRole'),
  dropdownUserDetail: document.getElementById('dropdownUserDetail'),
  openCreateStoreBtnHeader: document.getElementById('openCreateStoreBtnHeader'),
  resetStoreDataBtn: document.getElementById('resetStoreDataBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  openAddAssetBtn: document.getElementById('openAddAssetBtn'),

  // Admin Store Manager Modal
  adminStoreManagerModal: document.getElementById('adminStoreManagerModal'),
  closeAdminStoreManagerModalBtn: document.getElementById('closeAdminStoreManagerModalBtn'),
  adminCreateNewStoreBtn: document.getElementById('adminCreateNewStoreBtn'),
  adminStoreTableBody: document.getElementById('adminStoreTableBody'),

  // Store Credentials Form Modal
  storeModal: document.getElementById('storeModal'),
  storeModalTitle: document.getElementById('storeModalTitle'),
  storeForm: document.getElementById('storeForm'),
  editStoreOriginalCode: document.getElementById('editStoreOriginalCode'),
  newStoreCode: document.getElementById('newStoreCode'),
  newStoreName: document.getElementById('newStoreName'),
  newStorePassword: document.getElementById('newStorePassword'),
  seedOptionContainer: document.getElementById('seedOptionContainer'),
  newStoreSeedOption: document.getElementById('newStoreSeedOption'),
  storeFormError: document.getElementById('storeFormError'),
  storeFormErrorText: document.getElementById('storeFormErrorText'),
  closeStoreModalBtn: document.getElementById('closeStoreModalBtn'),
  cancelStoreModalBtn: document.getElementById('cancelStoreModalBtn'),

  // Dashboard Stats
  statTotalCount: document.getElementById('statTotalCount'),
  statTotalValue: document.getElementById('statTotalValue'),
  statGoodCount: document.getElementById('statGoodCount'),
  statGoodPct: document.getElementById('statGoodPct'),
  statGoodBar: document.getElementById('statGoodBar'),
  statMaintCount: document.getElementById('statMaintCount'),
  statMaintBar: document.getElementById('statMaintBar'),
  statOosCount: document.getElementById('statOosCount'),
  statOosBar: document.getElementById('statOosBar'),

  // Controls & Filters
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  viewTableViewBtn: document.getElementById('viewTableViewBtn'),
  viewCardViewBtn: document.getElementById('viewCardViewBtn'),
  statusTabBtns: document.querySelectorAll('.status-tab-btn'),
  countTabAll: document.getElementById('countTabAll'),
  countTabGood: document.getElementById('countTabGood'),
  countTabMaint: document.getElementById('countTabMaint'),
  countTabOos: document.getElementById('countTabOos'),

  // Containers
  tableViewContainer: document.getElementById('tableViewContainer'),
  cardViewContainer: document.getElementById('cardViewContainer'),
  assetTableBody: document.getElementById('assetTableBody'),
  emptyState: document.getElementById('emptyState'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),

  // Asset Modal
  assetModal: document.getElementById('assetModal'),
  assetModalTitle: document.getElementById('assetModalTitle'),
  assetForm: document.getElementById('assetForm'),
  assetFormId: document.getElementById('assetFormId'),
  assetFormName: document.getElementById('assetFormName'),
  assetFormCategory: document.getElementById('assetFormCategory'),
  assetFormSerial: document.getElementById('assetFormSerial'),
  assetFormStatus: document.getElementById('assetFormStatus'),
  assetFormLocation: document.getElementById('assetFormLocation'),
  assetFormLastMaint: document.getElementById('assetFormLastMaint'),
  assetFormValue: document.getElementById('assetFormValue'),
  assetFormFileInput: document.getElementById('assetFormFileInput'),
  assetFileLabel: document.getElementById('assetFileLabel'),
  assetFormImage: document.getElementById('assetFormImage'),
  assetFormPreviewBox: document.getElementById('assetFormPreviewBox'),
  closeAssetModalBtn: document.getElementById('closeAssetModalBtn'),
  cancelAssetModalBtn: document.getElementById('cancelAssetModalBtn'),

  // Maintenance History Modal
  historyModal: document.getElementById('historyModal'),
  historyModalAssetName: document.getElementById('historyModalAssetName'),
  historyModalAssetStatus: document.getElementById('historyModalAssetStatus'),
  historyModalAssetMeta: document.getElementById('historyModalAssetMeta'),
  closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
  logFormWrapper: document.getElementById('logFormWrapper'),
  markCompletedBanner: document.getElementById('markCompletedBanner'),
  markCompletedBtn: document.getElementById('markCompletedBtn'),
  toggleNewLogFormBtn: document.getElementById('toggleNewLogFormBtn'),
  logPermissionNotice: document.getElementById('logPermissionNotice'),
  newLogForm: document.getElementById('newLogForm'),
  logFormAssetId: document.getElementById('logFormAssetId'),
  logFormDate: document.getElementById('logFormDate'),
  logFormTechnician: document.getElementById('logFormTechnician'),
  logFormNewStatus: document.getElementById('logFormNewStatus'),
  logFormCost: document.getElementById('logFormCost'),
  logFormFileInput: document.getElementById('logFormFileInput'),
  logFileLabel: document.getElementById('logFileLabel'),
  logFormImage: document.getElementById('logFormImage'),
  logFormPreviewBox: document.getElementById('logFormPreviewBox'),
  logFormNotes: document.getElementById('logFormNotes'),
  cancelLogFormBtn: document.getElementById('cancelLogFormBtn'),
  timelineContainer: document.getElementById('timelineContainer'),
  emptyTimeline: document.getElementById('emptyTimeline'),

  // Toast Container
  toastContainer: document.getElementById('toastContainer'),

  // Notification Center
  notifBellBtn: document.getElementById('notifBellBtn'),
  notifBadgeCount: document.getElementById('notifBadgeCount'),
  notifDropdown: document.getElementById('notifDropdown'),
  notifListContainer: document.getElementById('notifListContainer'),
  markAllNotifsReadBtn: document.getElementById('markAllNotifsReadBtn'),
  emptyNotifState: document.getElementById('emptyNotifState')
};


// ==========================================
// 5. AUTHENTICATION & ROLE MANAGEMENT LOGIC
// ==========================================

function switchLoginTab(mode) {
  AppState.loginMode = mode;
  DOM.loginError.classList.add('hidden');
  DOM.loginForm.reset();

  // Reset password field to password type if toggled
  if (DOM.loginPassword) DOM.loginPassword.type = 'password';
  const loginPwdEyeIcon = document.getElementById('loginPwdEyeIcon');
  if (loginPwdEyeIcon) loginPwdEyeIcon.className = 'fa-solid fa-eye text-xs text-zinc-500';

  if (mode === 'store') {
    DOM.tabStoreLogin.className = 'flex-1 py-2 rounded-lg bg-zinc-800 text-white shadow-sm transition-all flex items-center justify-center gap-1.5 font-semibold';
    DOM.tabAdminLogin.className = 'flex-1 py-2 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-1.5 font-medium';
    DOM.loginLabelCode.innerHTML = `<i class="fa-solid fa-store text-zinc-400 mr-1"></i> Store Code`;
    DOM.loginStoreCode.placeholder = 'e.g. STORE-01';
    DOM.loginSubmitBtnText.textContent = 'Log In to Store Dashboard';

    if (DOM.adminAccountsSection) DOM.adminAccountsSection.classList.add('hidden');
    if (DOM.storeAccountsSection) DOM.storeAccountsSection.classList.remove('hidden');
  } else {
    DOM.tabAdminLogin.className = 'flex-1 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shadow-sm transition-all flex items-center justify-center gap-1.5';
    DOM.tabStoreLogin.className = 'flex-1 py-2 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-1.5 font-medium';
    DOM.loginLabelCode.innerHTML = `<i class="fa-solid fa-user-shield text-amber-400 mr-1"></i> Admin Username`;
    DOM.loginStoreCode.placeholder = 'e.g. admin1, admin2, admin3';
    DOM.loginSubmitBtnText.textContent = 'Access Admin Console';

    if (DOM.adminAccountsSection) DOM.adminAccountsSection.classList.remove('hidden');
    if (DOM.storeAccountsSection) DOM.storeAccountsSection.classList.add('hidden');
  }
}

function renderStoreAccountsList() {
  const stores = StorageManager.getStores();

  DOM.storeListContainer.innerHTML = stores.map(s => `
    <button type="button" class="demo-login-btn p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left flex items-center justify-between text-zinc-300 transition-colors" data-code="${escapeHTML(s.code)}">
      <span class="flex items-center gap-2">
        <i class="fa-solid fa-store text-zinc-400 text-xs"></i>
        <strong class="text-white font-mono text-xs">${escapeHTML(s.code)}</strong> 
        <span class="text-zinc-400 text-[10px] font-normal truncate max-w-[140px]">(${escapeHTML(s.name)})</span>
      </span>
      <span class="text-[10px] text-zinc-400 font-medium">Select &rarr;</span>
    </button>
  `).join('');

  DOM.storeListContainer.querySelectorAll('.demo-login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLoginTab('store');
      const code = btn.getAttribute('data-code');
      DOM.loginStoreCode.value = code;
      DOM.loginPassword.value = '';
      DOM.loginPassword.focus();
      showToast(`Selected store "${code}". Please type password to log in.`, 'info');
    });
  });
}

function handleLogin(inputCodeOrUsername, password) {
  const cleanInput = inputCodeOrUsername.trim();
  const cleanPass = password.trim();

  // 1. Check if trying Admin Login
  const matchedAdmin = DEFAULT_ADMINS.find(a => 
    a.username.toLowerCase() === cleanInput.toLowerCase() && a.password === cleanPass
  );

  if (matchedAdmin) {
    AppState.currentUser = {
      role: 'admin',
      username: matchedAdmin.username,
      name: matchedAdmin.name
    };
    localStorage.setItem('ams_user_session', JSON.stringify(AppState.currentUser));
    DOM.loginError.classList.add('hidden');
    loadUserSession();
    showToast(`Logged in as Administrator (${matchedAdmin.username})`, 'success');
    return;
  }

  // 2. Check Store Account Login
  const stores = StorageManager.getStores();
  const matchedStore = stores.find(s => 
    s.code.toUpperCase() === cleanInput.toUpperCase() && s.password === cleanPass
  );

  if (matchedStore) {
    AppState.currentUser = {
      role: 'store',
      storeCode: matchedStore.code,
      name: matchedStore.name
    };
    StorageManager.setActiveStoreCode(matchedStore.code);
    localStorage.setItem('ams_user_session', JSON.stringify(AppState.currentUser));
    DOM.loginError.classList.add('hidden');
    loadUserSession();
    showToast(`Logged in successfully to store ${matchedStore.code}`, 'success');
    return;
  }

  // Login Failed
  DOM.loginError.classList.remove('hidden');
  DOM.loginErrorText.textContent = AppState.loginMode === 'admin' 
    ? 'Invalid Admin Username or Password.' 
    : 'Invalid Store Code or Password.';
}

function handleLogout() {
  AppState.currentUser = null;
  AppState.activeStore = null;
  localStorage.removeItem('ams_user_session');
  StorageManager.setActiveStoreCode(null);

  DOM.appSection.classList.add('hidden');
  DOM.appSection.classList.remove('flex');
  DOM.loginSection.classList.remove('hidden');
  if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');
  renderStoreAccountsList();
  switchLoginTab('store');
  showToast('Logged out of session.', 'info');
}

function loadUserSession() {
  let savedSession = null;
  try {
    savedSession = JSON.parse(localStorage.getItem('ams_user_session'));
  } catch (e) {}

  if (!savedSession) {
    DOM.loginSection.classList.remove('hidden');
    DOM.appSection.classList.add('hidden');
    DOM.appSection.classList.remove('flex');
    renderStoreAccountsList();
    switchLoginTab('store');
    return;
  }

  AppState.currentUser = savedSession;
  const stores = StorageManager.getStores();

  const sidebarAdminBlock = document.getElementById('sidebarAdminBlock');

  // Configure UI based on Role
  if (savedSession.role === 'admin') {
    // Admin Role Configuration
    DOM.roleBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono';
    DOM.roleDisplayName.textContent = `ADMIN • ${savedSession.username}`;
    if (DOM.adminManageStoresBtn) DOM.adminManageStoresBtn.classList.remove('hidden');
    if (DOM.openCreateStoreBtnHeader) DOM.openCreateStoreBtnHeader.classList.remove('hidden');
    if (DOM.openAddAssetBtn) DOM.openAddAssetBtn.classList.remove('hidden');
    if (DOM.emptyAddBtn) DOM.emptyAddBtn.classList.remove('hidden');
    if (sidebarAdminBlock) sidebarAdminBlock.classList.remove('hidden');
    if (DOM.dropdownUserRole) DOM.dropdownUserRole.textContent = `Role: System Administrator`;
    if (DOM.dropdownUserDetail) DOM.dropdownUserDetail.textContent = `Account: ${savedSession.username}`;

    let activeCode = StorageManager.getActiveStoreCode() || (stores[0] ? stores[0].code : 'STORE-01');
    let storeObj = stores.find(s => s.code === activeCode) || stores[0] || { code: 'STORE-01', name: 'Downtown Branch Store' };
    AppState.activeStore = storeObj;
    StorageManager.setActiveStoreCode(storeObj.code);
  } else {
    // Store Role Configuration
    DOM.roleBadge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono';
    DOM.roleDisplayName.textContent = `STORE • ${savedSession.storeCode}`;
    if (DOM.adminManageStoresBtn) DOM.adminManageStoresBtn.classList.add('hidden');
    if (DOM.openCreateStoreBtnHeader) DOM.openCreateStoreBtnHeader.classList.add('hidden');
    if (DOM.openAddAssetBtn) DOM.openAddAssetBtn.classList.add('hidden');
    if (DOM.emptyAddBtn) DOM.emptyAddBtn.classList.add('hidden');
    if (sidebarAdminBlock) sidebarAdminBlock.classList.add('hidden');
    if (DOM.dropdownUserRole) DOM.dropdownUserRole.textContent = `Role: Store User`;
    if (DOM.dropdownUserDetail) DOM.dropdownUserDetail.textContent = `Store Code: ${savedSession.storeCode}`;

    let storeObj = stores.find(s => s.code === savedSession.storeCode) || { code: savedSession.storeCode, name: savedSession.name };
    AppState.activeStore = storeObj;
    StorageManager.setActiveStoreCode(storeObj.code);
  }

  renderHeaderStoreSelector();

  AppState.assets = StorageManager.getAssets(AppState.activeStore.code);
  AppState.logs = StorageManager.getLogs(AppState.activeStore.code);
  if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = AppState.activeStore.name;

  DOM.loginSection.classList.add('hidden');
  DOM.appSection.classList.remove('hidden');
  DOM.appSection.classList.add('flex');

  refreshAppUI();
}

function renderHeaderStoreSelector() {
  const stores = StorageManager.getStores();
  const isAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  if (DOM.activeStoreSelect) {
    if (isAdmin) {
      DOM.activeStoreSelect.disabled = false;
      DOM.activeStoreSelect.innerHTML = stores.map(s => 
        `<option value="${s.code}" ${s.code === AppState.activeStore.code ? 'selected' : ''}>${s.code} (${s.name})</option>`
      ).join('');
    } else {
      DOM.activeStoreSelect.disabled = true;
      DOM.activeStoreSelect.innerHTML = `<option value="${AppState.activeStore.code}">${AppState.activeStore.code}</option>`;
    }
  }
}


// ==========================================
// 6. ADMIN STORE MANAGEMENT CONSOLE
// ==========================================

function openAdminStoreManagerModal() {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Admin accounts can access Store Management.', 'error');
    return;
  }

  renderAdminStoreTable();
  DOM.adminStoreManagerModal.classList.remove('hidden');
  DOM.adminStoreManagerModal.classList.add('flex');
  DOM.adminStoreManagerModal.style.display = 'flex';
}

function closeAdminStoreManagerModal() {
  DOM.adminStoreManagerModal.classList.add('hidden');
  DOM.adminStoreManagerModal.classList.remove('flex');
  DOM.adminStoreManagerModal.style.display = 'none';
}

function renderAdminStoreTable() {
  const stores = StorageManager.getStores();

  DOM.adminStoreTableBody.innerHTML = stores.map((s, idx) => `
    <tr class="hover:bg-zinc-900/80 transition-colors border-b border-zinc-800">
      <td class="py-3 px-4 font-mono font-bold text-amber-400">${escapeHTML(s.code)}</td>
      <td class="py-3 px-4 text-white font-medium">${escapeHTML(s.name)}</td>
      <td class="py-3 px-4 font-mono text-zinc-300">
        <div class="inline-flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
          <span id="storePwdMask_${idx}">••••••••</span>
          <span id="storePwdReal_${idx}" class="hidden text-amber-300 font-bold">${escapeHTML(s.password)}</span>
          <button type="button" onclick="toggleStorePasswordVisibility(${idx})" class="text-zinc-500 hover:text-white ml-1">
            <i id="pwdEye_${idx}" class="fa-solid fa-eye text-xs"></i>
          </button>
        </div>
      </td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditStoreModal('${escapeHTML(s.code)}')" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg text-xs flex items-center gap-1">
            <i class="fa-solid fa-key text-[10px]"></i> Edit Credentials
          </button>
          <button onclick="confirmDeleteStore('${escapeHTML(s.code)}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-1">
            <i class="fa-solid fa-trash text-[10px]"></i> Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function toggleStorePasswordVisibility(idx) {
  const maskSpan = document.getElementById(`storePwdMask_${idx}`);
  const realSpan = document.getElementById(`storePwdReal_${idx}`);
  const eyeIcon = document.getElementById(`pwdEye_${idx}`);

  if (realSpan.classList.contains('hidden')) {
    realSpan.classList.remove('hidden');
    maskSpan.classList.add('hidden');
    eyeIcon.className = 'fa-solid fa-eye-slash text-xs text-amber-400';
  } else {
    realSpan.classList.add('hidden');
    maskSpan.classList.remove('hidden');
    eyeIcon.className = 'fa-solid fa-eye text-xs text-zinc-500';
  }
}

function openCreateStoreModal() {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Admin accounts can create stores.', 'error');
    return;
  }

  DOM.storeForm.reset();
  DOM.editStoreOriginalCode.value = '';
  DOM.storeModalTitle.textContent = 'Register New Store Account (Admin Only)';
  DOM.seedOptionContainer.classList.remove('hidden');
  DOM.storeFormError.classList.add('hidden');
  if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');
  
  DOM.storeModal.classList.remove('hidden');
  DOM.storeModal.classList.add('flex');
  DOM.storeModal.style.display = 'flex';
}

function openEditStoreModal(storeCode) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Admin accounts can edit store credentials.', 'error');
    return;
  }

  const stores = StorageManager.getStores();
  const store = stores.find(s => s.code === storeCode);
  if (!store) return;

  DOM.editStoreOriginalCode.value = store.code;
  DOM.newStoreCode.value = store.code;
  DOM.newStoreName.value = store.name;
  DOM.newStorePassword.value = store.password;
  DOM.seedOptionContainer.classList.add('hidden');
  DOM.storeFormError.classList.add('hidden');
  DOM.storeModalTitle.textContent = `Edit Store Credentials (${store.code})`;

  DOM.storeModal.classList.remove('hidden');
  DOM.storeModal.classList.add('flex');
  DOM.storeModal.style.display = 'flex';
}

function closeCreateStoreModal() {
  DOM.storeModal.classList.add('hidden');
  DOM.storeModal.classList.remove('flex');
  DOM.storeModal.style.display = 'none';
}

function handleStoreFormSubmit(e) {
  e.preventDefault();

  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Admin rights required.', 'error');
    return;
  }

  const originalCode = DOM.editStoreOriginalCode.value;
  const isEditing = Boolean(originalCode);
  const code = DOM.newStoreCode.value;
  const name = DOM.newStoreName.value;
  const pass = DOM.newStorePassword.value;
  const seedOption = DOM.newStoreSeedOption.value;

  let result;
  if (isEditing) {
    result = StorageManager.updateStoreCredentials(originalCode, code, name, pass);
  } else {
    result = StorageManager.addStore(code, name, pass, seedOption);
  }

  if (!result.success) {
    DOM.storeFormErrorText.textContent = result.message;
    DOM.storeFormError.classList.remove('hidden');
    return;
  }

  DOM.storeFormError.classList.add('hidden');
  closeCreateStoreModal();

  renderStoreAccountsList();
  renderAdminStoreTable();
  renderHeaderStoreSelector();

  showToast(`Store credentials for "${result.store.code}" saved & synced to Supabase!`, 'success');
}

function confirmDeleteStore(storeCode) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Admin rights required.', 'error');
    return;
  }

  const stores = StorageManager.getStores();
  if (stores.length <= 1) {
    alert('Cannot delete the last remaining store account.');
    return;
  }

  if (confirm(`Are you sure you want to delete store account "${storeCode}"? This will delete all associated asset data.`)) {
    StorageManager.deleteStore(storeCode);
    renderStoreAccountsList();
    renderAdminStoreTable();
    renderHeaderStoreSelector();
    showToast(`Store "${storeCode}" deleted.`, 'info');
  }
}


// ==========================================
// 7. RENDERING ENGINE & COMPUTATIONS
// ==========================================

function refreshAppUI() {
  renderDashboardStats();
  renderAssetDirectory();
  renderNotifications();
}

function renderNotifications() {
  if (!DOM.notifListContainer) return;

  const notifications = StorageManager.getNotifications();
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';
  const userStoreCode = AppState.currentUser ? AppState.currentUser.storeCode : null;

  // Filter notifications relevant for current logged-in user
  const relevantNotifs = notifications.filter(n => {
    if (isUserAdmin) {
      return n.recipientRole === 'admin';
    } else {
      return n.recipientRole === 'store' && (!n.recipientStoreCode || n.recipientStoreCode === userStoreCode);
    }
  });

  const unreadCount = relevantNotifs.filter(n => !n.isRead).length;

  if (DOM.notifBadgeCount) {
    if (unreadCount > 0) {
      DOM.notifBadgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
      DOM.notifBadgeCount.classList.remove('hidden');
    } else {
      DOM.notifBadgeCount.classList.add('hidden');
    }
  }

  if (relevantNotifs.length === 0) {
    DOM.notifListContainer.innerHTML = '';
    if (DOM.emptyNotifState) DOM.emptyNotifState.classList.remove('hidden');
    return;
  }

  if (DOM.emptyNotifState) DOM.emptyNotifState.classList.add('hidden');

  DOM.notifListContainer.innerHTML = relevantNotifs.map(n => {
    const unreadBg = !n.isRead ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-amber-400' : 'hover:bg-zinc-800/50';
    const unreadDot = !n.isRead ? `<div class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>` : '';
    const timeAgo = formatTimeAgo(n.createdAt);

    let typeIcon = '<i class="fa-solid fa-bell text-amber-400 text-xs"></i>';
    if (n.type === 'log') typeIcon = '<i class="fa-solid fa-wrench text-cyan-400 text-xs"></i>';
    if (n.type === 'reply') typeIcon = '<i class="fa-solid fa-reply text-amber-400 text-xs"></i>';
    if (n.type === 'status') typeIcon = '<i class="fa-solid fa-circle-check text-emerald-400 text-xs"></i>';
    if (n.type === 'assignment') typeIcon = '<i class="fa-solid fa-box text-purple-400 text-xs"></i>';

    return `
      <div onclick="handleNotificationClick('${escapeHTML(n.id)}')" class="p-3.5 ${unreadBg} cursor-pointer transition-colors flex items-start gap-3 text-left">
        <div class="w-7 h-7 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
          ${typeIcon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-0.5">
            <h4 class="text-xs font-bold text-white truncate">${escapeHTML(n.title)}</h4>
            <span class="text-[10px] text-zinc-500 font-mono shrink-0">${timeAgo}</span>
          </div>
          <p class="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">${escapeHTML(n.message)}</p>
          <div class="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
            <span class="font-mono text-amber-400/90 font-semibold">${escapeHTML(n.storeCode || '')}</span>
            ${n.assetId ? '<span>•</span><span class="text-zinc-400 hover:text-white underline">View Asset &rarr;</span>' : ''}
          </div>
        </div>
        ${unreadDot}
      </div>
    `;
  }).join('');
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function handleNotificationClick(notifId) {
  const notifications = StorageManager.getNotifications();
  const notif = notifications.find(n => n.id === notifId);
  if (!notif) return;

  notif.isRead = true;
  StorageManager.saveNotifications(notifications);

  if (DOM.notifDropdown) DOM.notifDropdown.classList.add('hidden');
  renderNotifications();

  if (notif.assetId) {
    openHistoryModal(notif.assetId);
  }
}

function markAllNotificationsRead() {
  const notifications = StorageManager.getNotifications();
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';
  const userStoreCode = AppState.currentUser ? AppState.currentUser.storeCode : null;

  notifications.forEach(n => {
    if (isUserAdmin && n.recipientRole === 'admin') {
      n.isRead = true;
    } else if (!isUserAdmin && n.recipientRole === 'store' && (!n.recipientStoreCode || n.recipientStoreCode === userStoreCode)) {
      n.isRead = true;
    }
  });

  StorageManager.saveNotifications(notifications);
  renderNotifications();
  showToast('All notifications marked as read.', 'info');
}


// ==========================================
// 11. EVENT LISTENERS INITIALIZATION
// ==========================================

function initEventListeners() {
  // Notification Center Dropdown Toggle
  if (DOM.notifBellBtn && DOM.notifDropdown) {
    DOM.notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.notifDropdown.classList.toggle('hidden');
    });
  }

  if (DOM.markAllNotifsReadBtn) {
    DOM.markAllNotifsReadBtn.addEventListener('click', markAllNotificationsRead);
  }

  // Login Tab Switching
  DOM.tabStoreLogin.addEventListener('click', () => switchLoginTab('store'));
  DOM.tabAdminLogin.addEventListener('click', () => switchLoginTab('admin'));

  // Password Visibility Toggle for Login Form
  const toggleLoginPasswordBtn = document.getElementById('toggleLoginPasswordBtn');
  const loginPwdEyeIcon = document.getElementById('loginPwdEyeIcon');
  if (toggleLoginPasswordBtn && DOM.loginPassword && loginPwdEyeIcon) {
    toggleLoginPasswordBtn.addEventListener('click', () => {
      if (DOM.loginPassword.type === 'password') {
        DOM.loginPassword.type = 'text';
        loginPwdEyeIcon.className = 'fa-solid fa-eye-slash text-xs text-zinc-300';
      } else {
        DOM.loginPassword.type = 'password';
        loginPwdEyeIcon.className = 'fa-solid fa-eye text-xs text-zinc-500';
      }
    });
  }

  // Admin Quick Selection Buttons (Sets username, clears password, REQUIRES USER TO TYPE PASSWORD)
  document.querySelectorAll('.admin-demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLoginTab('admin');
      const user = btn.getAttribute('data-user');
      DOM.loginStoreCode.value = user;
      DOM.loginPassword.value = '';
      DOM.loginPassword.focus();
      showToast(`Selected Admin account "${user}". Please type password to log in.`, 'info');
    });
  });

  // Login Form Submit (Requires correct password)
  DOM.loginForm.addEventListener('submit', e => {
    e.preventDefault();
    handleLogin(DOM.loginStoreCode.value, DOM.loginPassword.value);
  });

  // Store Switcher Dropdown (Sidebar & Header)
  if (DOM.activeStoreSelect) {
    DOM.activeStoreSelect.addEventListener('change', e => {
      const selectedCode = e.target.value;
      const stores = StorageManager.getStores();
      const storeObj = stores.find(s => s.code === selectedCode);
      if (storeObj) {
        AppState.activeStore = storeObj;
        StorageManager.setActiveStoreCode(storeObj.code);
        AppState.assets = StorageManager.getAssets(storeObj.code);
        AppState.logs = StorageManager.getLogs(storeObj.code);
        if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = storeObj.name;
        refreshAppUI();
        showToast(`Switched active store view to ${storeObj.code}`, 'info');
      }
    });
  }

  // Admin Console & Store Modals
  if (DOM.adminManageStoresBtn) DOM.adminManageStoresBtn.addEventListener('click', openAdminStoreManagerModal);
  DOM.closeAdminStoreManagerModalBtn.addEventListener('click', closeAdminStoreManagerModal);
  DOM.adminCreateNewStoreBtn.addEventListener('click', () => {
    closeAdminStoreManagerModal();
    openCreateStoreModal();
  });
  if (DOM.openCreateStoreBtnHeader) DOM.openCreateStoreBtnHeader.addEventListener('click', openCreateStoreModal);
  DOM.closeStoreModalBtn.addEventListener('click', closeCreateStoreModal);
  DOM.cancelStoreModalBtn.addEventListener('click', closeCreateStoreModal);
  DOM.storeForm.addEventListener('submit', handleStoreFormSubmit);

  // Mobile sidebar toggle & backdrop listeners
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarNav = document.getElementById('sidebarNav');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  if (sidebarToggleBtn && sidebarNav && sidebarBackdrop) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebarNav.classList.toggle('-translate-x-full');
      sidebarBackdrop.classList.toggle('hidden');
    });

    sidebarBackdrop.addEventListener('click', () => {
      sidebarNav.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden');
    });
  }

  // Sidebar Logout Button
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', handleLogout);
  }

  // User Dropdown Menu Toggle & Outside Click Handler
  if (DOM.userMenuBtn && DOM.userMenuDropdown) {
    DOM.userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.userMenuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
      if (!DOM.userMenuBtn.contains(e.target) && !DOM.userMenuDropdown.contains(e.target)) {
        DOM.userMenuDropdown.classList.add('hidden');
      }
      if (DOM.notifBellBtn && DOM.notifDropdown && !DOM.notifBellBtn.contains(e.target) && !DOM.notifDropdown.contains(e.target)) {
        DOM.notifDropdown.classList.add('hidden');
      }
    });
  }

  // Header Actions
  if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', handleLogout);
  if (DOM.resetStoreDataBtn) {
    DOM.resetStoreDataBtn.addEventListener('click', () => {
      if (confirm(`Reset store data for ${AppState.activeStore.code} back to original demo state?`)) {
        StorageManager.resetStoreData(AppState.activeStore.code);
        loadUserSession();
        if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');
        showToast('Store data reset to demo defaults.', 'info');
      }
    });
  }

  // Open Add Asset Modal
  if (DOM.openAddAssetBtn) DOM.openAddAssetBtn.addEventListener('click', openAddAssetModal);
  if (DOM.emptyAddBtn) DOM.emptyAddBtn.addEventListener('click', openAddAssetModal);
  DOM.closeAssetModalBtn.addEventListener('click', closeAssetModal);
  DOM.cancelAssetModalBtn.addEventListener('click', closeAssetModal);

  // Asset Form Submit
  DOM.assetForm.addEventListener('submit', handleAssetFormSubmit);

  // Backdrop overlay click closes modals
  [DOM.adminStoreManagerModal, DOM.storeModal, DOM.assetModal, DOM.historyModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
      }
    });
  });

  // ESC key closes any open modal or dropdown
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAdminStoreManagerModal();
      closeCreateStoreModal();
      closeAssetModal();
      closeHistoryModal();
      if (DOM.notifDropdown) DOM.notifDropdown.classList.add('hidden');
    }
  });

  // Local File Upload Listener for Asset Form
  DOM.assetFormFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      DOM.assetFileLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Url = evt.target.result;
        DOM.assetFormImage.value = base64Url;
        updateAssetFormPreview(base64Url);
        showToast('Local image selected & encoded.', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Image URL Input Listener for Asset Form
  DOM.assetFormImage.addEventListener('input', e => {
    updateAssetFormPreview(e.target.value.trim());
  });

  // Image Preset Buttons in Asset Form
  document.querySelectorAll('.preset-img-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      DOM.assetFormImage.value = url;
      DOM.assetFileLabel.textContent = 'Choose Local Device Image';
      updateAssetFormPreview(url);
    });
  });

  // Maintenance History Modal Actions
  DOM.closeHistoryModalBtn.addEventListener('click', closeHistoryModal);
  DOM.toggleNewLogFormBtn.addEventListener('click', () => {
    DOM.newLogForm.classList.toggle('hidden');
  });
  DOM.cancelLogFormBtn.addEventListener('click', () => {
    DOM.newLogForm.classList.add('hidden');
  });
  DOM.newLogForm.addEventListener('submit', handleNewLogSubmit);

  // Local File Upload Listener for Maintenance Log Form
  DOM.logFormFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      DOM.logFileLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Url = evt.target.result;
        DOM.logFormImage.value = base64Url;
        updateLogFormPreview(base64Url);
        showToast('Service receipt image selected.', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Image URL Input Listener for Log Form
  DOM.logFormImage.addEventListener('input', e => {
    updateLogFormPreview(e.target.value.trim());
  });

  // Layout View Switcher (Table vs Card)
  DOM.viewTableViewBtn.addEventListener('click', () => {
    AppState.currentView = 'table';
    DOM.viewTableViewBtn.classList.add('bg-zinc-800', 'text-white');
    DOM.viewTableViewBtn.classList.remove('text-zinc-400');
    DOM.viewCardViewBtn.classList.remove('bg-zinc-800', 'text-white');
    DOM.viewCardViewBtn.classList.add('text-zinc-400');
    renderAssetDirectory();
  });

  DOM.viewCardViewBtn.addEventListener('click', () => {
    AppState.currentView = 'card';
    DOM.viewCardViewBtn.classList.add('bg-zinc-800', 'text-white');
    DOM.viewCardViewBtn.classList.remove('text-zinc-400');
    DOM.viewTableViewBtn.classList.remove('bg-zinc-800', 'text-white');
    DOM.viewTableViewBtn.classList.add('text-zinc-400');
    renderAssetDirectory();
  });

  // Search Input Filter
  DOM.searchInput.addEventListener('input', e => {
    AppState.searchQuery = e.target.value;
    renderAssetDirectory();
  });

  // Category Select Filter
  DOM.categoryFilter.addEventListener('change', e => {
    AppState.categoryFilter = e.target.value;
    renderAssetDirectory();
  });

  // Status Tab Chips Filter
  DOM.statusTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.statusTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.statusFilter = btn.getAttribute('data-status');
      renderAssetDirectory();
    });
  });
}

function initSupabaseRealtime() {
  if (!supabaseClient) return;

  try {
    supabaseClient
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            const notifItem = {
              id: row.id,
              recipientRole: row.recipient_role,
              recipientStoreCode: row.recipient_store_code,
              title: row.title,
              message: row.message,
              assetId: row.asset_id,
              storeCode: row.store_code,
              isRead: Boolean(row.is_read),
              createdAt: row.created_at,
              type: row.type
            };

            const notifs = StorageManager.getNotifications();
            const idx = notifs.findIndex(n => n.id === notifItem.id);
            if (idx !== -1) {
              notifs[idx] = notifItem;
            } else {
              notifs.unshift(notifItem);

              if (AppState.currentUser) {
                const isUserAdmin = AppState.currentUser.role === 'admin';
                const isTargetStore = AppState.currentUser.role === 'store' && 
                  (!notifItem.recipientStoreCode || notifItem.recipientStoreCode === AppState.currentUser.storeCode);

                if ((isUserAdmin && notifItem.recipientRole === 'admin') || isTargetStore) {
                  showToast(`🔔 ${notifItem.title}: ${notifItem.message}`, 'info');
                }
              }
            }

            StorageManager.saveNotifications(notifs, false);
            renderNotifications();
          }
        }
      )
      .subscribe();

    supabaseClient
      .channel('public:maintenance_logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_logs' },
        () => {
          if (AppState.activeStore) {
            AppState.logs = StorageManager.getLogs(AppState.activeStore.code);
            refreshAppUI();
          }
        }
      )
      .subscribe();

    supabaseClient
      .channel('public:assets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assets' },
        () => {
          if (AppState.activeStore) {
            AppState.assets = StorageManager.getAssets(AppState.activeStore.code);
            refreshAppUI();
          }
        }
      )
      .subscribe();

  } catch (err) {
    console.warn('Realtime subscription note:', err);
  }
}

// Global functions exposed for inline onclick handlers
window.openHistoryModal = openHistoryModal;
window.openEditAssetModal = openEditAssetModal;
window.confirmDeleteAsset = confirmDeleteAsset;
window.openEditStoreModal = openEditStoreModal;
window.confirmDeleteStore = confirmDeleteStore;
window.toggleStorePasswordVisibility = toggleStorePasswordVisibility;
window.markTaskCompleted = markTaskCompleted;
window.replyToComment = replyToComment;
window.handleNotificationClick = handleNotificationClick;

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  switchLoginTab('store');
  renderStoreAccountsList();
  loadUserSession();
  initSupabaseRealtime();
});

function renderDashboardStats() {
  const assets = AppState.assets;
  const totalCount = assets.length;
  
  const goodAssets = assets.filter(a => a.status === 'Good');
  const maintAssets = assets.filter(a => a.status === 'Maintenance Needed');
  const oosAssets = assets.filter(a => a.status === 'Out of Service');

  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);

  DOM.statTotalCount.textContent = totalCount;
  DOM.statTotalValue.textContent = `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Total`;

  DOM.statGoodCount.textContent = goodAssets.length;
  const goodPct = totalCount > 0 ? Math.round((goodAssets.length / totalCount) * 100) : 0;
  DOM.statGoodPct.textContent = `${goodPct}% operational`;
  DOM.statGoodBar.style.width = `${goodPct}%`;

  DOM.statMaintCount.textContent = maintAssets.length;
  const maintPct = totalCount > 0 ? Math.round((maintAssets.length / totalCount) * 100) : 0;
  DOM.statMaintBar.style.width = `${maintPct}%`;

  DOM.statOosCount.textContent = oosAssets.length;
  const oosPct = totalCount > 0 ? Math.round((oosAssets.length / totalCount) * 100) : 0;
  DOM.statOosBar.style.width = `${oosPct}%`;

  // Update status tab counters
  DOM.countTabAll.textContent = totalCount;
  DOM.countTabGood.textContent = goodAssets.length;
  DOM.countTabMaint.textContent = maintAssets.length;
  DOM.countTabOos.textContent = oosAssets.length;
}

function getFilteredAssets() {
  return AppState.assets.filter(asset => {
    // Search Filter
    const query = AppState.searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      asset.name.toLowerCase().includes(query) ||
      asset.serial.toLowerCase().includes(query) ||
      asset.id.toLowerCase().includes(query) ||
      (asset.location && asset.location.toLowerCase().includes(query)) ||
      asset.category.toLowerCase().includes(query);

    // Status Filter
    const matchesStatus = AppState.statusFilter === 'ALL' || asset.status === AppState.statusFilter;

    // Category Filter
    const matchesCategory = AppState.categoryFilter === 'ALL' || asset.category === AppState.categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });
}

function renderAssetDirectory() {
  const filtered = getFilteredAssets();

  if (filtered.length === 0) {
    DOM.tableViewContainer.classList.add('hidden');
    DOM.cardViewContainer.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');

  if (AppState.currentView === 'table') {
    DOM.tableViewContainer.classList.remove('hidden');
    DOM.cardViewContainer.classList.add('hidden');
    renderTableView(filtered);
  } else {
    DOM.tableViewContainer.classList.add('hidden');
    DOM.cardViewContainer.classList.remove('hidden');
    renderCardView(filtered);
  }
}

function renderTableView(assets) {
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  DOM.assetTableBody.innerHTML = assets.map(asset => {
    const statusBadge = getStatusBadgeHTML(asset.status);
    const thumbnail = asset.imageUrl 
      ? `<img src="${asset.imageUrl}" alt="${escapeHTML(asset.name)}" class="w-10 h-10 rounded-xl object-cover bg-zinc-800 border border-zinc-700">`
      : `<div class="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500"><i class="fa-solid fa-box text-sm"></i></div>`;

    const adminActionButtons = isUserAdmin ? `
      <button onclick="openEditAssetModal('${asset.id}')" class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Edit Asset">
        <i class="fa-solid fa-pen-to-square text-xs"></i>
      </button>
      <button onclick="confirmDeleteAsset('${asset.id}')" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete Asset">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    ` : '';

    const quickCompleteBtn = asset.status !== 'Good' ? `
      <button onclick="markTaskCompleted('${asset.id}')" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1" title="Mark Task as Completed">
        <i class="fa-solid fa-check text-[9px]"></i> Complete
      </button>
    ` : '';

    return `
      <tr class="border-b border-zinc-800/80">
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            ${thumbnail}
            <div>
              <p class="font-bold text-white leading-snug">${escapeHTML(asset.name)}</p>
              <p class="text-xs text-zinc-400 font-mono">${escapeHTML(asset.id)}</p>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 text-xs font-medium text-zinc-300">
          ${escapeHTML(asset.category)}
        </td>
        <td class="py-3.5 px-4 text-xs font-mono text-zinc-400">
          ${escapeHTML(asset.serial)}
        </td>
        <td class="py-3.5 px-4 text-xs text-zinc-300">
          <i class="fa-solid fa-location-dot text-[10px] text-zinc-500 mr-1"></i> ${escapeHTML(asset.location || 'Unassigned')}
        </td>
        <td class="py-3.5 px-4">
          ${statusBadge}
        </td>
        <td class="py-3.5 px-4 text-xs font-mono text-zinc-400">
          ${asset.lastMaintenance ? asset.lastMaintenance : '<span class="text-zinc-600">Never</span>'}
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${quickCompleteBtn}
            <button onclick="openHistoryModal('${asset.id}')" class="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1 font-medium text-xs" title="View History & Service Logs">
              <i class="fa-solid fa-comments text-xs"></i> Logs
            </button>
            ${adminActionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCardView(assets) {
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  DOM.cardViewContainer.innerHTML = assets.map(asset => {
    const statusBadge = getStatusBadgeHTML(asset.status);
    const thumbnail = asset.imageUrl 
      ? `<img src="${asset.imageUrl}" alt="${escapeHTML(asset.name)}" class="w-full h-40 object-cover bg-zinc-800">`
      : `<div class="w-full h-40 bg-zinc-800/80 flex items-center justify-center text-zinc-600 text-3xl"><i class="fa-solid fa-box"></i></div>`;

    const adminCardActions = isUserAdmin ? `
      <button onclick="openEditAssetModal('${asset.id}')" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors" title="Edit Asset">
        <i class="fa-solid fa-pen text-xs"></i>
      </button>
      <button onclick="confirmDeleteAsset('${asset.id}')" class="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg transition-colors" title="Delete Asset">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    ` : '';

    const quickCompleteBtn = asset.status !== 'Good' ? `
      <button onclick="markTaskCompleted('${asset.id}')" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1" title="Mark Task as Completed">
        <i class="fa-solid fa-check text-[9px]"></i> Complete
      </button>
    ` : '';

    return `
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-zinc-700 transition-all">
        <div class="relative">
          ${thumbnail}
          <div class="absolute top-3 right-3">
            ${statusBadge}
          </div>
          <div class="absolute bottom-3 left-3 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-300">
            ${escapeHTML(asset.serial)}
          </div>
        </div>

        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">${escapeHTML(asset.category)}</span>
              <span class="text-xs font-mono text-zinc-300 font-semibold">$${(asset.value || 0).toLocaleString()}</span>
            </div>
            <h4 class="font-bold text-white text-base leading-snug">${escapeHTML(asset.name)}</h4>
            <p class="text-xs text-zinc-400 mt-1">
              <i class="fa-solid fa-location-dot text-[10px] text-zinc-500 mr-1"></i> ${escapeHTML(asset.location || 'Unassigned')}
            </p>
          </div>

          <div class="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <div>
              <span class="block text-[10px] text-zinc-500 uppercase font-semibold">Last Serviced</span>
              <span class="font-mono">${asset.lastMaintenance ? asset.lastMaintenance : 'N/A'}</span>
            </div>

            <div class="flex items-center gap-1">
              ${quickCompleteBtn}
              <button onclick="openHistoryModal('${asset.id}')" class="px-2.5 py-1.5 bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5">
                <i class="fa-solid fa-comments text-[10px]"></i> History
              </button>
              ${adminCardActions}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function getStatusBadgeHTML(status) {
  if (status === 'Good') {
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-good"><i class="fa-solid fa-circle text-[6px]"></i> Good</span>`;
  } else if (status === 'Maintenance Needed') {
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-maintenance"><i class="fa-solid fa-wrench text-[10px]"></i> Service Needed</span>`;
  } else {
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-oos"><i class="fa-solid fa-triangle-exclamation text-[10px]"></i> Out of Service</span>`;
  }
}


// ==========================================
// 8. ASSET CRUD MODAL HANDLERS
// ==========================================

function updateAssetFormPreview(url) {
  if (url) {
    DOM.assetFormPreviewBox.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
  } else {
    DOM.assetFormPreviewBox.innerHTML = `<i class="fa-solid fa-image text-lg text-zinc-600"></i>`;
  }
}

function openAddAssetModal() {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can create assets.', 'error');
    return;
  }

  DOM.assetForm.reset();
  DOM.assetFormId.value = '';
  DOM.assetFormFileInput.value = '';
  DOM.assetFileLabel.textContent = 'Choose Local Device Image';
  DOM.assetModalTitle.textContent = 'Add New Asset';
  DOM.assetFormLastMaint.value = new Date().toISOString().split('T')[0];
  updateAssetFormPreview('');
  
  DOM.assetModal.classList.remove('hidden');
  DOM.assetModal.classList.add('flex');
  DOM.assetModal.style.display = 'flex';
}

function openEditAssetModal(assetId) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can edit assets.', 'error');
    return;
  }

  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  DOM.assetFormId.value = asset.id;
  DOM.assetFormName.value = asset.name;
  DOM.assetFormCategory.value = asset.category;
  DOM.assetFormSerial.value = asset.serial;
  DOM.assetFormStatus.value = asset.status;
  DOM.assetFormLocation.value = asset.location || '';
  DOM.assetFormLastMaint.value = asset.lastMaintenance || '';
  DOM.assetFormValue.value = asset.value || '';
  DOM.assetFormImage.value = asset.imageUrl || '';
  DOM.assetFormFileInput.value = '';
  DOM.assetFileLabel.textContent = 'Choose Local Device Image';

  updateAssetFormPreview(asset.imageUrl || '');
  DOM.assetModalTitle.textContent = `Edit Asset (${asset.id})`;

  DOM.assetModal.classList.remove('hidden');
  DOM.assetModal.classList.add('flex');
  DOM.assetModal.style.display = 'flex';
}

function closeAssetModal() {
  DOM.assetModal.classList.add('hidden');
  DOM.assetModal.classList.remove('flex');
  DOM.assetModal.style.display = 'none';
}

function handleAssetFormSubmit(e) {
  e.preventDefault();

  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can manage asset records.', 'error');
    return;
  }

  const id = DOM.assetFormId.value;
  const isEditing = Boolean(id);

  const userSerial = DOM.assetFormSerial.value.trim();
  const serialNumber = userSerial || `SN-${Math.floor(1000 + Math.random() * 9000)}`;

  const assetData = {
    id: isEditing ? id : `AST-${Math.floor(1000 + Math.random() * 9000)}`,
    name: DOM.assetFormName.value.trim(),
    category: DOM.assetFormCategory.value,
    serial: serialNumber,
    status: DOM.assetFormStatus.value,
    location: DOM.assetFormLocation.value.trim() || 'Main Area',
    lastMaintenance: DOM.assetFormLastMaint.value || new Date().toISOString().split('T')[0],
    value: parseFloat(DOM.assetFormValue.value) || 0,
    imageUrl: DOM.assetFormImage.value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (isEditing) {
    const idx = AppState.assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      AppState.assets[idx] = { ...AppState.assets[idx], ...assetData };
    }
    showToast(`Asset "${assetData.name}" updated successfully!`, 'success');
  } else {
    AppState.assets.unshift(assetData);
    showToast(`Asset "${assetData.name}" added successfully!`, 'success');
  }

  StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);

  // Trigger Notification for Store
  StorageManager.addNotification({
    recipientRole: 'store',
    recipientStoreCode: AppState.activeStore.code,
    title: isEditing ? 'Asset Updated by Admin' : 'New Asset Assigned by Admin',
    message: isEditing 
      ? `Admin updated details/status for "${assetData.name}" (${assetData.serial}) to ${assetData.status}.`
      : `Admin created and assigned new asset "${assetData.name}" (${assetData.serial}) to store ${AppState.activeStore.code}.`,
    assetId: assetData.id,
    storeCode: AppState.activeStore.code,
    type: isEditing ? 'status' : 'assignment'
  });

  AppState.searchQuery = '';
  AppState.statusFilter = 'ALL';
  AppState.categoryFilter = 'ALL';

  if (DOM.searchInput) DOM.searchInput.value = '';
  if (DOM.categoryFilter) DOM.categoryFilter.value = 'ALL';
  DOM.statusTabBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-status') === 'ALL') btn.classList.add('active');
  });

  closeAssetModal();
  refreshAppUI();
}

function confirmDeleteAsset(assetId) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can delete assets.', 'error');
    return;
  }

  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  if (confirm(`Are you sure you want to delete asset "${asset.name}" (${asset.serial})?`)) {
    AppState.assets = AppState.assets.filter(a => a.id !== assetId);
    AppState.logs = AppState.logs.filter(l => l.assetId !== assetId);

    StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);
    StorageManager.saveLogs(AppState.activeStore.code, AppState.logs);

    if (supabaseClient) {
      supabaseClient.from('assets').delete().eq('id', assetId).then(({ error }) => {
        if (error) console.log('Supabase asset delete status:', error.message);
      }).catch(err => console.log('Supabase asset delete note:', err));
    }

    refreshAppUI();
    showToast(`Asset ${assetId} deleted.`, 'info');
  }
}


// ==========================================
// 9. MAINTENANCE LOG & COMMENT AUTHORIZATION
// ==========================================

function canUserAddComment(storeCode) {
  if (!AppState.currentUser) return false;
  if (AppState.currentUser.role === 'admin') return true;
  if (AppState.currentUser.role === 'store' && AppState.currentUser.storeCode === storeCode) return true;
  return false;
}

function updateLogFormPreview(url) {
  if (url) {
    DOM.logFormPreviewBox.classList.remove('hidden');
    DOM.logFormPreviewBox.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
  } else {
    DOM.logFormPreviewBox.classList.add('hidden');
    DOM.logFormPreviewBox.innerHTML = '';
  }
}

function openHistoryModal(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  DOM.historyModalAssetName.textContent = asset.name;
  DOM.historyModalAssetStatus.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    asset.status === 'Good' ? 'badge-good' : asset.status === 'Maintenance Needed' ? 'badge-maintenance' : 'badge-oos'
  }`;
  DOM.historyModalAssetStatus.textContent = asset.status;
  DOM.historyModalAssetMeta.textContent = `${asset.serial} • ${asset.category} • ${asset.location || 'No Location'}`;

  // Show / hide Mark as Completed quick action banner
  if (DOM.markCompletedBanner) {
    if (asset.status !== 'Good') {
      DOM.markCompletedBanner.classList.remove('hidden');
      if (DOM.markCompletedBtn) {
        DOM.markCompletedBtn.onclick = () => markTaskCompleted(asset.id);
      }
    } else {
      DOM.markCompletedBanner.classList.add('hidden');
    }
  }

  const isAuthorizedToComment = canUserAddComment(AppState.activeStore.code);

  if (isAuthorizedToComment) {
    DOM.toggleNewLogFormBtn.classList.remove('hidden');
    DOM.logPermissionNotice.classList.add('hidden');
  } else {
    DOM.toggleNewLogFormBtn.classList.add('hidden');
    DOM.logPermissionNotice.classList.remove('hidden');
    DOM.newLogForm.classList.add('hidden');
  }

  DOM.newLogForm.classList.add('hidden');
  DOM.logFormAssetId.value = asset.id;
  DOM.logFormDate.value = new Date().toISOString().split('T')[0];
  DOM.logFormNewStatus.value = asset.status;
  DOM.logFormTechnician.value = AppState.currentUser.role === 'admin' ? `Admin (${AppState.currentUser.username})` : `Store (${AppState.currentUser.storeCode})`;
  DOM.logFormCost.value = '';
  DOM.logFormImage.value = '';
  DOM.logFormFileInput.value = '';
  DOM.logFileLabel.textContent = 'Upload Local Photo';
  updateLogFormPreview('');
  DOM.logFormNotes.value = '';

  renderTimelineLogs(asset.id);
  DOM.historyModal.classList.remove('hidden');
  DOM.historyModal.classList.add('flex');
  DOM.historyModal.style.display = 'flex';
}

function closeHistoryModal() {
  DOM.historyModal.classList.add('hidden');
  DOM.historyModal.classList.remove('flex');
  DOM.historyModal.style.display = 'none';
}

function markTaskCompleted(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  const previousStatus = asset.status;
  const todayStr = new Date().toISOString().split('T')[0];
  const authorName = AppState.currentUser.role === 'admin' 
    ? `Admin (${AppState.currentUser.username})` 
    : `Store (${AppState.currentUser.storeCode})`;

  asset.status = 'Good';
  asset.lastMaintenance = todayStr;
  asset.updatedAt = new Date().toISOString();

  const completionLog = {
    id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
    assetId: asset.id,
    date: todayStr,
    technician: authorName,
    statusBefore: previousStatus,
    statusAfter: 'Good',
    cost: 0,
    imageUrl: '',
    notes: `Task marked as COMPLETED by ${authorName}. Maintenance/service resolved and asset restored to Good operational condition.`
  };

  AppState.logs.unshift(completionLog);
  StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);
  StorageManager.saveLogs(AppState.activeStore.code, AppState.logs);

  // Trigger Notification for completion
  if (AppState.currentUser.role === 'admin') {
    StorageManager.addNotification({
      recipientRole: 'store',
      recipientStoreCode: AppState.activeStore.code,
      title: 'Task Marked as Completed',
      message: `Admin ${AppState.currentUser.username} marked maintenance task on "${asset.name}" as COMPLETED.`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: 'status'
    });
  } else {
    StorageManager.addNotification({
      recipientRole: 'admin',
      recipientStoreCode: null,
      title: 'Store Completed Maintenance Task',
      message: `Store ${AppState.activeStore.code} marked maintenance task on "${asset.name}" as COMPLETED.`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: 'status'
    });
  }

  refreshAppUI();

  if (DOM.historyModal && !DOM.historyModal.classList.contains('hidden') && DOM.logFormAssetId.value === assetId) {
    DOM.historyModalAssetStatus.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold badge-good`;
    DOM.historyModalAssetStatus.textContent = 'Good';
    if (DOM.markCompletedBanner) {
      DOM.markCompletedBanner.classList.add('hidden');
    }
    renderTimelineLogs(asset.id);
  }

  showToast(`Maintenance task for "${asset.name}" marked as COMPLETED!`, 'success');
}

function replyToComment(author) {
  if (!canUserAddComment(AppState.activeStore.code)) {
    showToast('Unauthorized: Only Admins or assigned Store can reply.', 'error');
    return;
  }

  DOM.newLogForm.classList.remove('hidden');
  DOM.logFormNotes.value = `@${author}: `;
  DOM.logFormNotes.focus();
}

function renderTimelineLogs(assetId) {
  const logs = AppState.logs.filter(l => l.assetId === assetId).sort((a, b) => new Date(b.date) - new Date(a.date));

  if (logs.length === 0) {
    DOM.timelineContainer.innerHTML = '';
    DOM.emptyTimeline.classList.remove('hidden');
    return;
  }

  DOM.emptyTimeline.classList.add('hidden');

  DOM.timelineContainer.innerHTML = logs.map(log => {
    let dotClass = 'good';
    if (log.statusAfter === 'Maintenance Needed') dotClass = 'maint';
    if (log.statusAfter === 'Out of Service') dotClass = 'oos';

    const isCompleted = log.statusAfter === 'Good' && log.statusBefore !== 'Good';
    const isCompletedBadge = isCompleted 
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><i class="fa-solid fa-check text-[9px]"></i> COMPLETED</span>`
      : '';

    const isAuthorAdmin = (log.technician || '').toLowerCase().includes('admin');
    const isAuthorStore = (log.technician || '').toLowerCase().includes('store');

    const roleBadge = isAuthorAdmin 
      ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] font-bold">ADMIN</span>`
      : isAuthorStore 
      ? `<span class="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[9px] font-bold">STORE</span>`
      : '';

    const photoImg = log.imageUrl 
      ? `<div class="mt-3"><img src="${log.imageUrl}" alt="Maintenance Photo" class="w-32 h-20 object-cover rounded-lg border border-zinc-700"></div>`
      : '';

    return `
      <div class="relative pl-2">
        <div class="timeline-dot ${dotClass}"></div>
        <div class="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-white font-mono">${log.date}</span>
              ${isCompletedBadge}
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
              Cost: $${(log.cost || 0).toFixed(2)}
            </span>
          </div>

          <div class="text-xs text-zinc-300 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-zinc-400">Author / Tech:</span>
              <strong class="text-zinc-200">${escapeHTML(log.technician || 'N/A')}</strong>
              ${roleBadge}
            </div>

            <button type="button" onclick="replyToComment('${escapeHTML(log.technician || '')}')" class="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium">
              <i class="fa-solid fa-reply text-[9px]"></i> Reply
            </button>
          </div>

          <div class="text-xs text-zinc-300 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 mt-2 whitespace-pre-line leading-relaxed">
            ${escapeHTML(log.notes)}
          </div>

          ${photoImg}

          <div class="text-[10px] text-zinc-500 pt-1 flex items-center gap-1.5">
            <span>Status change:</span>
            <span class="text-zinc-400 font-semibold">${log.statusBefore || 'N/A'}</span>
            <i class="fa-solid fa-arrow-right text-[8px]"></i>
            <span class="text-zinc-200 font-semibold">${log.statusAfter}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleNewLogSubmit(e) {
  e.preventDefault();

  if (!canUserAddComment(AppState.activeStore.code)) {
    showToast('Unauthorized: Only Admins or the assigned Store account can add comments.', 'error');
    return;
  }

  const assetId = DOM.logFormAssetId.value;
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  const newStatus = DOM.logFormNewStatus.value;
  const serviceDate = DOM.logFormDate.value;

  const logEntry = {
    id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
    assetId: asset.id,
    date: serviceDate,
    technician: DOM.logFormTechnician.value.trim() || (AppState.currentUser.role === 'admin' ? `Admin (${AppState.currentUser.username})` : `Store (${AppState.currentUser.storeCode})`),
    statusBefore: asset.status,
    statusAfter: newStatus,
    cost: parseFloat(DOM.logFormCost.value) || 0,
    imageUrl: DOM.logFormImage.value.trim(),
    notes: DOM.logFormNotes.value.trim()
  };

  AppState.logs.unshift(logEntry);
  StorageManager.saveLogs(AppState.activeStore.code, AppState.logs);

  asset.status = newStatus;
  asset.lastMaintenance = serviceDate;
  asset.updatedAt = new Date().toISOString();
  StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);

  // Trigger Notification for target role
  if (AppState.currentUser.role === 'admin') {
    StorageManager.addNotification({
      recipientRole: 'store',
      recipientStoreCode: AppState.activeStore.code,
      title: 'New Admin Comment / Reply',
      message: `Admin ${AppState.currentUser.username} commented on "${asset.name}": "${logEntry.notes.substring(0, 60)}${logEntry.notes.length > 60 ? '...' : ''}"`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: 'reply'
    });
  } else {
    StorageManager.addNotification({
      recipientRole: 'admin',
      recipientStoreCode: null,
      title: 'New Service Log Submitted',
      message: `Store ${AppState.activeStore.code} submitted a log for "${asset.name}": "${logEntry.notes.substring(0, 60)}${logEntry.notes.length > 60 ? '...' : ''}"`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: 'log'
    });
  }

  DOM.newLogForm.classList.add('hidden');
  renderTimelineLogs(asset.id);
  refreshAppUI();

  DOM.historyModalAssetStatus.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    asset.status === 'Good' ? 'badge-good' : asset.status === 'Maintenance Needed' ? 'badge-maintenance' : 'badge-oos'
  }`;
  DOM.historyModalAssetStatus.textContent = asset.status;

  showToast('Comment / Service Log entry recorded & synced!', 'success');
}


// ==========================================
// 10. TOAST NOTIFICATIONS & UTILITIES
// ==========================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  let iconClass = 'fa-circle-info text-zinc-400';
  let borderClass = 'border-zinc-700';

  if (type === 'success') {
    iconClass = 'fa-circle-check text-emerald-400';
    borderClass = 'border-emerald-500/20';
  } else if (type === 'error') {
    iconClass = 'fa-circle-exclamation text-rose-400';
    borderClass = 'border-rose-500/20';
  }

  toast.className = `toast-item pointer-events-auto bg-zinc-900 border ${borderClass} text-zinc-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs min-w-[240px]`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass} text-base"></i>
    <span class="flex-1">${escapeHTML(message)}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(16px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}


// ==========================================
// 11. EVENT LISTENERS INITIALIZATION
// ==========================================

function initEventListeners() {
  // Login Tab Switching
  DOM.tabStoreLogin.addEventListener('click', () => switchLoginTab('store'));
  DOM.tabAdminLogin.addEventListener('click', () => switchLoginTab('admin'));

  // Password Visibility Toggle for Login Form
  const toggleLoginPasswordBtn = document.getElementById('toggleLoginPasswordBtn');
  const loginPwdEyeIcon = document.getElementById('loginPwdEyeIcon');
  if (toggleLoginPasswordBtn && DOM.loginPassword && loginPwdEyeIcon) {
    toggleLoginPasswordBtn.addEventListener('click', () => {
      if (DOM.loginPassword.type === 'password') {
        DOM.loginPassword.type = 'text';
        loginPwdEyeIcon.className = 'fa-solid fa-eye-slash text-xs text-zinc-300';
      } else {
        DOM.loginPassword.type = 'password';
        loginPwdEyeIcon.className = 'fa-solid fa-eye text-xs text-zinc-500';
      }
    });
  }

  // Admin Quick Selection Buttons (Sets username, clears password, REQUIRES USER TO TYPE PASSWORD)
  document.querySelectorAll('.admin-demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLoginTab('admin');
      const user = btn.getAttribute('data-user');
      DOM.loginStoreCode.value = user;
      DOM.loginPassword.value = '';
      DOM.loginPassword.focus();
      showToast(`Selected Admin account "${user}". Please type password to log in.`, 'info');
    });
  });

  // Login Form Submit (Requires correct password)
  DOM.loginForm.addEventListener('submit', e => {
    e.preventDefault();
    handleLogin(DOM.loginStoreCode.value, DOM.loginPassword.value);
  });

  // Store Switcher Dropdown (Sidebar & Header)
  if (DOM.activeStoreSelect) {
    DOM.activeStoreSelect.addEventListener('change', e => {
      const selectedCode = e.target.value;
      const stores = StorageManager.getStores();
      const storeObj = stores.find(s => s.code === selectedCode);
      if (storeObj) {
        AppState.activeStore = storeObj;
        StorageManager.setActiveStoreCode(storeObj.code);
        AppState.assets = StorageManager.getAssets(storeObj.code);
        AppState.logs = StorageManager.getLogs(storeObj.code);
        if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = storeObj.name;
        refreshAppUI();
        showToast(`Switched active store view to ${storeObj.code}`, 'info');
      }
    });
  }

  // Admin Console & Store Modals
  if (DOM.adminManageStoresBtn) DOM.adminManageStoresBtn.addEventListener('click', openAdminStoreManagerModal);
  DOM.closeAdminStoreManagerModalBtn.addEventListener('click', closeAdminStoreManagerModal);
  DOM.adminCreateNewStoreBtn.addEventListener('click', () => {
    closeAdminStoreManagerModal();
    openCreateStoreModal();
  });
  if (DOM.openCreateStoreBtnHeader) DOM.openCreateStoreBtnHeader.addEventListener('click', openCreateStoreModal);
  DOM.closeStoreModalBtn.addEventListener('click', closeCreateStoreModal);
  DOM.cancelStoreModalBtn.addEventListener('click', closeCreateStoreModal);
  DOM.storeForm.addEventListener('submit', handleStoreFormSubmit);

  // Mobile sidebar toggle & backdrop listeners
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarNav = document.getElementById('sidebarNav');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  if (sidebarToggleBtn && sidebarNav && sidebarBackdrop) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebarNav.classList.toggle('-translate-x-full');
      sidebarBackdrop.classList.toggle('hidden');
    });

    sidebarBackdrop.addEventListener('click', () => {
      sidebarNav.classList.add('-translate-x-full');
      sidebarBackdrop.classList.add('hidden');
    });
  }

  // Sidebar Logout Button
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', handleLogout);
  }

  // User Dropdown Menu Toggle
  if (DOM.userMenuBtn && DOM.userMenuDropdown) {
    DOM.userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.userMenuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
      if (!DOM.userMenuBtn.contains(e.target) && !DOM.userMenuDropdown.contains(e.target)) {
        DOM.userMenuDropdown.classList.add('hidden');
      }
    });
  }

  // Header Actions
  if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', handleLogout);
  if (DOM.resetStoreDataBtn) {
    DOM.resetStoreDataBtn.addEventListener('click', () => {
      if (confirm(`Reset store data for ${AppState.activeStore.code} back to original demo state?`)) {
        StorageManager.resetStoreData(AppState.activeStore.code);
        loadUserSession();
        if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');
        showToast('Store data reset to demo defaults.', 'info');
      }
    });
  }

  // Open Add Asset Modal
  if (DOM.openAddAssetBtn) DOM.openAddAssetBtn.addEventListener('click', openAddAssetModal);
  if (DOM.emptyAddBtn) DOM.emptyAddBtn.addEventListener('click', openAddAssetModal);
  DOM.closeAssetModalBtn.addEventListener('click', closeAssetModal);
  DOM.cancelAssetModalBtn.addEventListener('click', closeAssetModal);

  // Asset Form Submit
  DOM.assetForm.addEventListener('submit', handleAssetFormSubmit);

  // Backdrop overlay click closes modals
  [DOM.adminStoreManagerModal, DOM.storeModal, DOM.assetModal, DOM.historyModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
      }
    });
  });

  // ESC key closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAdminStoreManagerModal();
      closeCreateStoreModal();
      closeAssetModal();
      closeHistoryModal();
    }
  });

  // Local File Upload Listener for Asset Form
  DOM.assetFormFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      DOM.assetFileLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Url = evt.target.result;
        DOM.assetFormImage.value = base64Url;
        updateAssetFormPreview(base64Url);
        showToast('Local image selected & encoded.', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Image URL Input Listener for Asset Form
  DOM.assetFormImage.addEventListener('input', e => {
    updateAssetFormPreview(e.target.value.trim());
  });

  // Image Preset Buttons in Asset Form
  document.querySelectorAll('.preset-img-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      DOM.assetFormImage.value = url;
      DOM.assetFileLabel.textContent = 'Choose Local Device Image';
      updateAssetFormPreview(url);
    });
  });

  // Maintenance History Modal Actions
  DOM.closeHistoryModalBtn.addEventListener('click', closeHistoryModal);
  DOM.toggleNewLogFormBtn.addEventListener('click', () => {
    DOM.newLogForm.classList.toggle('hidden');
  });
  DOM.cancelLogFormBtn.addEventListener('click', () => {
    DOM.newLogForm.classList.add('hidden');
  });
  DOM.newLogForm.addEventListener('submit', handleNewLogSubmit);

  // Local File Upload Listener for Maintenance Log Form
  DOM.logFormFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      DOM.logFileLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Url = evt.target.result;
        DOM.logFormImage.value = base64Url;
        updateLogFormPreview(base64Url);
        showToast('Service receipt image selected.', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Image URL Input Listener for Log Form
  DOM.logFormImage.addEventListener('input', e => {
    updateLogFormPreview(e.target.value.trim());
  });

  // Layout View Switcher (Table vs Card)
  DOM.viewTableViewBtn.addEventListener('click', () => {
    AppState.currentView = 'table';
    DOM.viewTableViewBtn.classList.add('bg-zinc-800', 'text-white');
    DOM.viewTableViewBtn.classList.remove('text-zinc-400');
    DOM.viewCardViewBtn.classList.remove('bg-zinc-800', 'text-white');
    DOM.viewCardViewBtn.classList.add('text-zinc-400');
    renderAssetDirectory();
  });

  DOM.viewCardViewBtn.addEventListener('click', () => {
    AppState.currentView = 'card';
    DOM.viewCardViewBtn.classList.add('bg-zinc-800', 'text-white');
    DOM.viewCardViewBtn.classList.remove('text-zinc-400');
    DOM.viewTableViewBtn.classList.remove('bg-zinc-800', 'text-white');
    DOM.viewTableViewBtn.classList.add('text-zinc-400');
    renderAssetDirectory();
  });

  // Search Input Filter
  DOM.searchInput.addEventListener('input', e => {
    AppState.searchQuery = e.target.value;
    renderAssetDirectory();
  });

  // Category Select Filter
  DOM.categoryFilter.addEventListener('change', e => {
    AppState.categoryFilter = e.target.value;
    renderAssetDirectory();
  });

  // Status Tab Chips Filter
  DOM.statusTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.statusTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.statusFilter = btn.getAttribute('data-status');
      renderAssetDirectory();
    });
  });
}

// Global functions exposed for inline onclick handlers
window.openHistoryModal = openHistoryModal;
window.openEditAssetModal = openEditAssetModal;
window.confirmDeleteAsset = confirmDeleteAsset;
window.openEditStoreModal = openEditStoreModal;
window.confirmDeleteStore = confirmDeleteStore;
window.toggleStorePasswordVisibility = toggleStorePasswordVisibility;
window.markTaskCompleted = markTaskCompleted;
window.replyToComment = replyToComment;

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  switchLoginTab('store');
  renderStoreAccountsList();
  loadUserSession();
});
