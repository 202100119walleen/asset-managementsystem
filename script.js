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

const DEFAULT_STORES = [];

const SEED_ASSETS_STORE_01 = [];
const SEED_LOGS_STORE_01 = [];
const SEED_ASSETS_STORE_02 = [];
const SEED_LOGS_STORE_02 = [];

// Supabase is single source of truth for stores and assets

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
      localStorage.setItem('ams_stores', JSON.stringify([]));
    }
    if (!localStorage.getItem('ams_notifications')) {
      localStorage.setItem('ams_notifications', JSON.stringify([]));
    }

    // Sync directly with Supabase cloud database
    StorageManager.syncWithSupabase();
  }

  static getDeletedStoreCodes() {
    try {
      return JSON.parse(localStorage.getItem('ams_deleted_stores')) || [];
    } catch {
      return [];
    }
  }

  static markStoreDeleted(code) {
    const deleted = StorageManager.getDeletedStoreCodes();
    if (!deleted.includes(code)) {
      deleted.push(code);
      localStorage.setItem('ams_deleted_stores', JSON.stringify(deleted));
    }
  }

  static async syncWithSupabase() {
    if (!supabaseClient) return;

    try {
      const deletedCodes = StorageManager.getDeletedStoreCodes();

      // Permanently enforce deletion of deleted stores in Supabase cloud database
      if (deletedCodes.length > 0) {
        supabaseClient.from('stores').delete().in('code', deletedCodes).catch(() => { });
        supabaseClient.from('assets').delete().in('store_code', deletedCodes).catch(() => { });
      }

      // 1. Sync Stores from Supabase (Filter out any deleted store codes)
      const localStores = StorageManager.getStores().filter(s => !deletedCodes.includes(s.code));
      const { data: remoteStores, error: storesErr } = await supabaseClient.from('stores').select('*');

      let mergedStores = [...localStores];

      if (!storesErr && Array.isArray(remoteStores)) {
        remoteStores.forEach(s => {
          if (deletedCodes.includes(s.code)) return;
          const idx = mergedStores.findIndex(m => m.code.toUpperCase() === s.code.toUpperCase());
          if (idx !== -1) {
            mergedStores[idx] = {
              ...mergedStores[idx],
              code: s.code,
              name: s.name,
              password: s.password
            };
          } else {
            mergedStores.push({
              code: s.code,
              name: s.name,
              password: s.password
            });
          }
        });
      }

      localStorage.setItem('ams_stores', JSON.stringify(mergedStores));

      // Restore active store session from saved active code
      let savedActiveCode = StorageManager.getActiveStoreCode();
      if (!savedActiveCode && mergedStores.length > 0) {
        savedActiveCode = mergedStores[0].code;
        StorageManager.setActiveStoreCode(savedActiveCode);
      }

      if (savedActiveCode && mergedStores.length > 0) {
        const activeObj = mergedStores.find(s => s.code.toUpperCase() === savedActiveCode.toUpperCase()) || mergedStores[0];
        AppState.activeStore = activeObj;
        StorageManager.setActiveStoreCode(activeObj.code);
        if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = activeObj.name;
      }

      if (typeof renderStoreAccountsList === 'function') renderStoreAccountsList();
      if (typeof renderAdminStoreTable === 'function') renderAdminStoreTable();
      if (typeof renderHeaderStoreSelector === 'function') renderHeaderStoreSelector();

      // 2. Sync Assets from Supabase for Active Store (Merge remote & local assets)
      const currentActiveCode = AppState.activeStore ? AppState.activeStore.code : StorageManager.getActiveStoreCode();
      if (currentActiveCode) {
        const { data: remoteAssets, error: assetsErr } = await supabaseClient.from('assets').select('*').ilike('store_code', currentActiveCode.trim());
        if (!assetsErr && Array.isArray(remoteAssets)) {
          const mappedRemote = remoteAssets.map(a => ({
            id: a.id,
            name: a.name,
            category: a.category,
            serial: a.serial,
            status: a.status,
            location: a.location,
            lastMaintenance: a.last_maintenance,
            dueDate: a.due_date || '',
            value: parseFloat(a.value) || 0,
            imageUrl: a.image_url,
            isCompleted: Boolean(a.is_completed),
            completedImageUrl: a.completed_image_url || '',
            updatedAt: a.updated_at
          }));

          const localAssets = StorageManager.getAssets(currentActiveCode);
          const mergedAssets = [...mappedRemote];

          localAssets.forEach(local => {
            if (!mergedAssets.some(m => m.id === local.id)) {
              mergedAssets.push(local);
            }
          });

          StorageManager.saveAssets(currentActiveCode, mergedAssets, true);
          if (AppState.activeStore && AppState.activeStore.code === currentActiveCode) {
            AppState.assets = mergedAssets;
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

      // 4. Sync Maintenance Logs from Supabase for Active Store
      if (activeCode) {
        const { data: remoteLogs, error: logsErr } = await supabaseClient
          .from('maintenance_logs')
          .select('*')
          .eq('store_code', activeCode)
          .order('created_at', { ascending: false });

        if (!logsErr && remoteLogs && remoteLogs.length > 0) {
          const mappedLogs = remoteLogs.map(l => ({
            id: l.id,
            assetId: l.asset_id,
            date: l.date,
            technician: l.technician,
            statusBefore: l.status_before,
            statusAfter: l.status_after,
            cost: parseFloat(l.cost) || 0,
            imageUrl: l.image_url,
            notes: l.notes
          }));

          const localLogs = StorageManager.getLogs(activeCode);
          const mergedLogs = [...mappedLogs];
          localLogs.forEach(local => {
            if (!mergedLogs.some(m => m.id === local.id)) {
              mergedLogs.push(local);
            }
          });

          StorageManager.saveLogs(activeCode, mergedLogs, false);
          if (AppState.activeStore && AppState.activeStore.code === activeCode) {
            AppState.logs = mergedLogs;
          }
        }
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
    if (supabaseClient && Array.isArray(stores) && stores.length > 0) {
      const storesToUpsert = stores.map(s => ({
        code: s.code,
        name: s.name,
        password: s.password
      }));
      supabaseClient.from('stores').upsert(storesToUpsert).then(({ error }) => {
        if (error) console.log('Supabase store save status:', error.message);
      }).catch(err => console.log('Stores upsert sync error:', err));
    }
  }

  static addStore(code, name, password, seedOption = 'empty') {
    const stores = StorageManager.getStores();
    const cleanCode = code.trim().toUpperCase();

    if (stores.some(s => s.code === cleanCode)) {
      return { success: false, message: `Store code "${cleanCode}" already exists.` };
    }

    const newStore = {
      code: cleanCode,
      name: name.trim(),
      password: password.trim(),
      isNew: true,
      createdAt: new Date().toISOString()
    };
    stores.push(newStore);
    StorageManager.saveStores(stores);

    if (seedOption === 'seed') {
      localStorage.setItem(`ams_assets_${cleanCode}`, JSON.stringify(SEED_ASSETS_STORE_01));
      localStorage.setItem(`ams_logs_${cleanCode}`, JSON.stringify(SEED_LOGS_STORE_01));
      if (supabaseClient) {
        const mappedAssets = SEED_ASSETS_STORE_01.map(a => ({
          id: a.id,
          store_code: cleanCode,
          name: a.name,
          category: a.category,
          serial: a.serial,
          status: a.status,
          location: a.location || 'Main Area',
          last_maintenance: a.lastMaintenance || null,
          due_date: a.dueDate || null,
          value: a.value || 0,
          image_url: a.imageUrl || '',
          is_completed: Boolean(a.isCompleted),
          completed_image_url: a.completedImageUrl || '',
          updated_at: new Date().toISOString()
        }));
        supabaseClient.from('assets').upsert(mappedAssets).catch(err => console.log('Seed assets sync note:', err));
      }
    } else {
      localStorage.setItem(`ams_assets_${cleanCode}`, JSON.stringify([]));
      localStorage.setItem(`ams_logs_${cleanCode}`, JSON.stringify([]));
    }

    // Add System Notification Indicator
    StorageManager.addNotification({
      recipientRole: 'admin',
      recipientStoreCode: null,
      title: 'New Store Registered',
      message: `Admin registered new store branch "${cleanCode}" (${name.trim()})`,
      assetId: '',
      storeCode: cleanCode,
      type: 'assignment'
    });

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

      if (supabaseClient) {
        supabaseClient.from('stores').delete().eq('code', originalCode).catch(err => console.log('Delete old store code note:', err));
      }
    }

    StorageManager.saveStores(stores);
    return { success: true, store: updatedStore };
  }

  static deleteStore(code) {
    StorageManager.markStoreDeleted(code);

    let stores = StorageManager.getStores();
    stores = stores.filter(s => s.code !== code);
    localStorage.setItem('ams_stores', JSON.stringify(stores));
    localStorage.removeItem(`ams_assets_${code}`);
    localStorage.removeItem(`ams_logs_${code}`);

    if (supabaseClient) {
      supabaseClient.from('stores').delete().eq('code', code).then(({ error }) => {
        if (error) console.log('Supabase store delete error:', error.message);
        else console.log(`Store "${code}" deleted from Supabase cloud database.`);
      }).catch(err => console.log('Supabase store delete catch:', err));

      supabaseClient.from('assets').delete().eq('store_code', code).catch(err => console.log('Supabase assets delete note:', err));
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
        due_date: a.dueDate || null,
        value: a.value || 0,
        image_url: a.imageUrl || '',
        is_completed: a.isCompleted ? true : false,
        completed_image_url: a.completedImageUrl || '',
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
  countTabCompleted: document.getElementById('countTabCompleted'),
  countTabOverdue: document.getElementById('countTabOverdue'),
  countTabDueToday: document.getElementById('countTabDueToday'),
  countTabDueSoon: document.getElementById('countTabDueSoon'),
  countTabScheduled: document.getElementById('countTabScheduled'),

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
  assetFormCustomCategory: document.getElementById('assetFormCustomCategory'),
  assetFormSerial: document.getElementById('assetFormSerial'),
  assetFormStatus: document.getElementById('assetFormStatus'),
  assetFormCompletion: document.getElementById('assetFormCompletion'),
  assetFormLocation: document.getElementById('assetFormLocation'),
  assetFormLastMaint: document.getElementById('assetFormLastMaint'),
  assetFormFrequency: document.getElementById('assetFormFrequency'),
  assetFormDueDate: document.getElementById('assetFormDueDate'),
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
  logFormSubmitBtn: document.getElementById('logFormSubmitBtn'),
  logFormSubmitLabel: document.getElementById('logFormSubmitLabel'),
  logFormCompletionMode: document.getElementById('logFormCompletionMode'),
  completionModeBanner: document.getElementById('completionModeBanner'),
  logFormDateLabel: document.getElementById('logFormDateLabel'),
  logFormTechnicianLabel: document.getElementById('logFormTechnicianLabel'),
  logFormPhotoLabel: document.getElementById('logFormPhotoLabel'),
  nameRequiredNotice: document.getElementById('nameRequiredNotice'),
  photoRequiredNotice: document.getElementById('photoRequiredNotice'),
  proofUploadedTick: document.getElementById('proofUploadedTick'),
  logFileUploadBtn: document.getElementById('logFileUploadBtn'),
  checklistDate: document.getElementById('checklistDate'),
  checklistDateIcon: document.getElementById('checklistDateIcon'),
  checklistName: document.getElementById('checklistName'),
  checklistNameIcon: document.getElementById('checklistNameIcon'),
  checklistPhoto: document.getElementById('checklistPhoto'),
  checklistPhotoIcon: document.getElementById('checklistPhotoIcon'),
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

  DOM.storeListContainer.innerHTML = stores.map(s => {
    const isNew = s.isNew || (s.createdAt && (new Date() - new Date(s.createdAt)) < 1000 * 60 * 60 * 24);
    const newBadge = isNew ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold font-mono tracking-wider animate-pulse">NEW</span>` : '';

    return `
      <button type="button" class="demo-login-btn p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left flex items-center justify-between text-zinc-300 transition-colors" data-code="${escapeHTML(s.code)}">
        <span class="flex items-center gap-2 overflow-hidden">
          <i class="fa-solid fa-store text-zinc-400 text-xs shrink-0"></i>
          <strong class="text-white font-mono text-xs">${escapeHTML(s.code)}</strong> 
          ${newBadge}
          <span class="text-zinc-400 text-[10px] font-normal truncate max-w-[120px]">(${escapeHTML(s.name)})</span>
        </span>
        <span class="text-[10px] text-zinc-400 font-medium shrink-0 ml-1">Select &rarr;</span>
      </button>
    `;
  }).join('');

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
  } catch (e) { }

  if (!savedSession) {
    DOM.loginSection.classList.remove('hidden');
    DOM.appSection.classList.add('hidden');
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

    let activeCode = StorageManager.getActiveStoreCode();
    let storeObj = null;
    if (activeCode && stores.length > 0) {
      storeObj = stores.find(s => s.code.toUpperCase() === activeCode.toUpperCase());
    }
    if (!storeObj && stores.length > 0) {
      storeObj = stores[0];
    }
    if (storeObj) {
      AppState.activeStore = storeObj;
      StorageManager.setActiveStoreCode(storeObj.code);
    }
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

    let storeObj = stores.find(s => s.code.toUpperCase() === savedSession.storeCode.toUpperCase()) || { code: savedSession.storeCode, name: savedSession.name };
    AppState.activeStore = storeObj;
    StorageManager.setActiveStoreCode(storeObj.code);
  }

  renderHeaderStoreSelector();

  AppState.assets = StorageManager.getAssets(AppState.activeStore.code);
  AppState.logs = StorageManager.getLogs(AppState.activeStore.code);
  if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = AppState.activeStore.name;

  DOM.loginSection.classList.add('hidden');
  DOM.appSection.classList.remove('hidden');

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
}

function closeAdminStoreManagerModal() {
  DOM.adminStoreManagerModal.classList.add('hidden');
  DOM.adminStoreManagerModal.classList.remove('flex');
}

function renderAdminStoreTable() {
  const stores = StorageManager.getStores();

  DOM.adminStoreTableBody.innerHTML = stores.map((s, idx) => {
    const isNew = s.isNew || (s.createdAt && (new Date() - new Date(s.createdAt)) < 1000 * 60 * 60 * 24);
    const newBadge = isNew ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold font-mono tracking-wider animate-pulse">NEW</span>` : '';

    return `
      <tr class="hover:bg-zinc-900/80 transition-colors border-b border-zinc-800">
        <td class="py-3 px-4 font-mono font-bold text-amber-400">
          <span class="inline-flex items-center">${escapeHTML(s.code)}${newBadge}</span>
        </td>
        <td class="py-3 px-4 text-white font-medium hidden sm:table-cell">${escapeHTML(s.name)}</td>
        <td class="py-3 px-4 font-mono text-zinc-300 hidden md:table-cell">
          <div class="inline-flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            <span id="storePwdMask_${idx}">••••••••</span>
            <span id="storePwdReal_${idx}" class="hidden text-amber-300 font-bold">${escapeHTML(s.password)}</span>
            <button type="button" onclick="toggleStorePasswordVisibility(${idx})" class="text-zinc-500 hover:text-white ml-1">
              <i id="pwdEye_${idx}" class="fa-solid fa-eye text-xs"></i>
            </button>
          </div>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-2 flex-wrap">
            <button onclick="openEditStoreModal('${escapeHTML(s.code)}')" class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg text-xs flex items-center gap-1">
              <i class="fa-solid fa-key text-[10px]"></i> <span class="hidden sm:inline">Edit</span>
            </button>
            <button onclick="confirmDeleteStore('${escapeHTML(s.code)}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs flex items-center gap-1">
              <i class="fa-solid fa-trash text-[10px]"></i> <span class="hidden sm:inline">Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
  const storeCodeAvail = document.getElementById('storeCodeAvailability');
  if (storeCodeAvail) storeCodeAvail.classList.add('hidden');
  if (DOM.newStoreCode) DOM.newStoreCode.classList.remove('border-rose-500', 'border-emerald-500');
  if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');

  DOM.storeModal.classList.remove('hidden');
  DOM.storeModal.classList.add('flex');
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
}

function closeCreateStoreModal() {
  DOM.storeModal.classList.add('hidden');
  DOM.storeModal.classList.remove('flex');
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

  if (!isEditing && result.success) {
    // Auto-select newly registered store in Admin dashboard
    AppState.activeStore = result.store;
    StorageManager.setActiveStoreCode(result.store.code);
    AppState.assets = StorageManager.getAssets(result.store.code);
    AppState.logs = StorageManager.getLogs(result.store.code);
    if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = result.store.name;
    if (DOM.activeStoreSelect) DOM.activeStoreSelect.value = result.store.code;
    refreshAppUI();
    showToast(`✅ Store created successfully. (${result.store.code} - ${result.store.name})`, 'success');
  } else {
    showToast(`Store credentials for "${result.store.code}" updated & synced!`, 'success');
  }
}

function confirmDeleteStore(storeCode) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Admin rights required.', 'error');
    return;
  }

  showConfirmModal(
    `Delete store "${storeCode}"? This will permanently remove all its assets and data from local storage and the cloud database.`,
    () => {
      StorageManager.deleteStore(storeCode);
      const remainingStores = StorageManager.getStores();
      if (remainingStores.length > 0) {
        if (!AppState.activeStore || AppState.activeStore.code === storeCode) {
          AppState.activeStore = remainingStores[0];
          StorageManager.setActiveStoreCode(remainingStores[0].code);
          AppState.assets = StorageManager.getAssets(remainingStores[0].code);
          AppState.logs = StorageManager.getLogs(remainingStores[0].code);
        }
      } else {
        AppState.activeStore = null;
        StorageManager.setActiveStoreCode(null);
        AppState.assets = [];
        AppState.logs = [];
      }

      renderStoreAccountsList();
      renderAdminStoreTable();
      renderHeaderStoreSelector();
      refreshAppUI();
      showToast(`Store "${storeCode}" deleted successfully.`, 'info');
    },
    'Delete Store',
    'fa-trash'
  );
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
    // If notification belongs to a specific store, switch active store context if needed
    if (notif.storeCode && AppState.activeStore && AppState.activeStore.code !== notif.storeCode) {
      const stores = StorageManager.getStores();
      const targetStore = stores.find(s => s.code === notif.storeCode);
      if (targetStore) {
        AppState.activeStore = targetStore;
        StorageManager.setActiveStoreCode(targetStore.code);
        AppState.assets = StorageManager.getAssets(targetStore.code);
        AppState.logs = StorageManager.getLogs(targetStore.code);
        if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = targetStore.name;
        if (DOM.activeStoreSelect) DOM.activeStoreSelect.value = targetStore.code;
        refreshAppUI();
      }
    }

    let asset = AppState.assets.find(a => a.id === notif.assetId);
    if (!asset && notif.storeCode) {
      const storeAssets = StorageManager.getAssets(notif.storeCode);
      asset = storeAssets.find(a => a.id === notif.assetId);
      if (asset) {
        const stores = StorageManager.getStores();
        const targetStore = stores.find(s => s.code === notif.storeCode);
        if (targetStore) {
          AppState.activeStore = targetStore;
          StorageManager.setActiveStoreCode(targetStore.code);
          AppState.assets = storeAssets;
          AppState.logs = StorageManager.getLogs(targetStore.code);
          if (DOM.activeStoreNameDisplay) DOM.activeStoreNameDisplay.textContent = targetStore.name;
          if (DOM.activeStoreSelect) DOM.activeStoreSelect.value = targetStore.code;
          refreshAppUI();
        }
      }
    }

    if (asset) {
      openHistoryModal(asset.id);
    }
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
      reader.onload = function (evt) {
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
window.markTaskIncomplete = markTaskIncomplete;
window.replyToComment = replyToComment;
window.deleteCommentWithUndo = deleteCommentWithUndo;
window.undoDeleteComment = undoDeleteComment;
window.handleUndoClick = handleUndoClick;
window.handleNotificationClick = handleNotificationClick;

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  switchLoginTab('store');
  renderStoreAccountsList();
  loadUserSession();
  initSupabaseRealtime();

  // Auto-switch to card view on mobile devices for better UX
  if (window.innerWidth < 768) {
    AppState.currentView = 'card';
    if (DOM.viewCardViewBtn && DOM.viewTableViewBtn) {
      DOM.viewCardViewBtn.classList.add('bg-zinc-800', 'text-white');
      DOM.viewCardViewBtn.classList.remove('text-zinc-400');
      DOM.viewTableViewBtn.classList.remove('bg-zinc-800', 'text-white');
      DOM.viewTableViewBtn.classList.add('text-zinc-400');
    }
  }
});

function getTaskDueStatus(asset) {
  // ─── RULE 1: Completed overrides EVERYTHING ───────────────────────────────
  // A task is Completed ONLY when isCompleted flag is explicitly set to true on the asset.
  if (asset.isCompleted) {
    return {
      statusKey: 'Completed',
      label: 'Completed',
      icon: '🟢',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      dotClass: 'bg-emerald-400',
      daysSubtext: 'Task Completed',
      priority: 1
    };
  }

  // ─── RULE 2: No due date → show raw asset condition, NO date-based status ──
  if (!asset.dueDate) {
    if (asset.status === 'Out of Service') {
      return {
        statusKey: 'Out of Service',
        label: 'Out of Service',
        icon: '🔴',
        badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        dotClass: 'bg-rose-400',
        daysSubtext: 'Inactive / Out of Service',
        priority: 6
      };
    }
    if (asset.status === 'Maintenance Needed') {
      return {
        statusKey: 'Maintenance Needed',
        label: 'Service Needed',
        icon: '🟡',
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
        dotClass: 'bg-amber-400',
        daysSubtext: 'Awaiting due date from Admin',
        priority: 6
      };
    }
    // Good condition, no due date = simply Operational
    return {
      statusKey: 'Good',
      label: 'Good',
      icon: '🟢',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      dotClass: 'bg-emerald-400',
      daysSubtext: 'Operational',
      priority: 6
    };
  }

  // ─── RULE 3: Due-date based statuses (only when dueDate is set) ───────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueParts = asset.dueDate.split('-');
  const due = new Date(
    parseInt(dueParts[0], 10),
    parseInt(dueParts[1], 10) - 1,
    parseInt(dueParts[2], 10)
  );
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // Priority 2: Overdue (1+ day past due date)
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      statusKey: 'Overdue',
      label: 'Overdue',
      icon: '🔴',
      badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      dotClass: 'bg-rose-400',
      daysSubtext: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
      priority: 2
    };
  }

  // Priority 3: Due Today (0 days)
  if (diffDays === 0) {
    return {
      statusKey: 'Due Today',
      label: 'Due Today',
      icon: '🟠',
      badgeClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
      dotClass: 'bg-orange-400',
      daysSubtext: 'Due Today',
      priority: 3
    };
  }

  // Priority 4: Due Soon (Custom threshold based on Maintenance Frequency: 1 Month / 30 days for Quarterly, Bi-Annually, Annually)
  let reminderThresholdDays = 7;
  if (asset.frequency === 'Quarterly' || asset.frequency === 'Bi-Annually' || asset.frequency === 'Annually' || asset.frequency === 'Yearly') {
    reminderThresholdDays = 30; // 1 Month advance reminder window!
  } else if (asset.frequency === 'Bi-Monthly') {
    reminderThresholdDays = 15;
  }

  if (diffDays <= reminderThresholdDays) {
    const isOneMonthNotice = diffDays > 7 && diffDays <= 30;
    const subtextNotice = isOneMonthNotice ? ` (1 Month Reminder)` : ` remaining`;
    return {
      statusKey: 'Due Soon',
      label: 'Due Soon',
      icon: '🟡',
      badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
      dotClass: 'bg-amber-400',
      daysSubtext: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}${subtextNotice}`,
      priority: 4
    };
  }

  // Priority 5: Scheduled (8+ days away)
  return {
    statusKey: 'Scheduled',
    label: 'Scheduled',
    icon: '🔵',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dotClass: 'bg-blue-400',
    daysSubtext: `${diffDays} days remaining`,
    priority: 5
  };
}

function getStatusBadgeHTML(asset) {
  const dueInfo = typeof asset === 'object' ? getTaskDueStatus(asset) : {
    label: asset,
    icon: '🟢',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    daysSubtext: ''
  };

  return `
    <div class="inline-flex flex-col items-start gap-0.5">
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${dueInfo.badgeClass}">
        <span class="text-[10px]">${dueInfo.icon}</span>
        <span>${escapeHTML(dueInfo.label)}</span>
      </span>
      ${dueInfo.daysSubtext ? `<span class="text-[10px] text-zinc-400 font-mono pl-0.5">${escapeHTML(dueInfo.daysSubtext)}</span>` : ''}
    </div>
  `;
}

function renderDashboardStats() {
  const assets = AppState.assets;
  const totalCount = assets.length;

  const completedAssets = assets.filter(a => getTaskDueStatus(a).statusKey === 'Completed');
  const overdueAssets = assets.filter(a => getTaskDueStatus(a).statusKey === 'Overdue');
  const dueTodayAssets = assets.filter(a => getTaskDueStatus(a).statusKey === 'Due Today');
  const dueSoonAssets = assets.filter(a => getTaskDueStatus(a).statusKey === 'Due Soon');
  const scheduledAssets = assets.filter(a => getTaskDueStatus(a).statusKey === 'Scheduled');
  const maintAssets = assets.filter(a => a.status === 'Maintenance Needed');
  const oosAssets = assets.filter(a => a.status === 'Out of Service');

  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);

  if (DOM.statTotalCount) DOM.statTotalCount.textContent = totalCount;
  if (DOM.statTotalValue) DOM.statTotalValue.textContent = `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Total`;

  const goodConditionAssets = assets.filter(a => a.status === 'Good');
  if (DOM.statGoodCount) DOM.statGoodCount.textContent = goodConditionAssets.length;
  const goodPct = totalCount > 0 ? Math.round((goodConditionAssets.length / totalCount) * 100) : 0;
  if (DOM.statGoodPct) DOM.statGoodPct.textContent = `${goodPct}% operational`;
  if (DOM.statGoodBar) DOM.statGoodBar.style.width = `${goodPct}%`;

  if (DOM.statMaintCount) DOM.statMaintCount.textContent = maintAssets.length;
  const maintPct = totalCount > 0 ? Math.round((maintAssets.length / totalCount) * 100) : 0;
  if (DOM.statMaintBar) DOM.statMaintBar.style.width = `${maintPct}%`;

  if (DOM.statOosCount) DOM.statOosCount.textContent = oosAssets.length;
  const oosPct = totalCount > 0 ? Math.round((oosAssets.length / totalCount) * 100) : 0;
  if (DOM.statOosBar) DOM.statOosBar.style.width = `${oosPct}%`;

  // Update status tab counters
  if (DOM.countTabAll) DOM.countTabAll.textContent = totalCount;
  if (DOM.countTabCompleted) DOM.countTabCompleted.textContent = completedAssets.length;
  if (DOM.countTabOverdue) DOM.countTabOverdue.textContent = overdueAssets.length;
  if (DOM.countTabDueToday) DOM.countTabDueToday.textContent = dueTodayAssets.length;
  if (DOM.countTabDueSoon) DOM.countTabDueSoon.textContent = dueSoonAssets.length;
  if (DOM.countTabScheduled) DOM.countTabScheduled.textContent = scheduledAssets.length;

  checkAndGenerateDueNotifications();
}

function checkAndGenerateDueNotifications() {
  if (!AppState.assets || AppState.assets.length === 0) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingNotifs = StorageManager.getNotifications();

  AppState.assets.forEach(asset => {
    if (!asset.dueDate || asset.isCompleted) return;

    const dueParts = asset.dueDate.split('-');
    const due = new Date(parseInt(dueParts[0], 10), parseInt(dueParts[1], 10) - 1, parseInt(dueParts[2], 10));
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isQuarterlyOrHigher = asset.frequency === 'Quarterly' || asset.frequency === 'Bi-Annually' || asset.frequency === 'Annually' || asset.frequency === 'Yearly';

    if (isQuarterlyOrHigher && diffDays <= 30 && diffDays > 0) {
      const notifTag = `1MONTH_REMINDER_${asset.id}_${asset.dueDate}`;
      const alreadyNotified = existingNotifs.some(n => n.notifTag === notifTag || (n.assetId === asset.id && n.title.includes('1-Month Maintenance Reminder')));

      if (!alreadyNotified) {
        StorageManager.addNotification({
          recipientRole: 'store',
          recipientStoreCode: AppState.activeStore ? AppState.activeStore.code : null,
          title: '⏰ 1-Month Maintenance Reminder',
          message: `Upcoming 3-month scheduled maintenance on "${asset.name}" is due in ${diffDays} days (${asset.dueDate}). Please prepare for service.`,
          assetId: asset.id,
          storeCode: AppState.activeStore ? AppState.activeStore.code : null,
          type: 'info',
          notifTag: notifTag
        });
      }
    }
  });
}

function getFilteredAssets() {
  const assets = AppState.assets.filter(asset => {
    // Search Filter
    const query = AppState.searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      asset.name.toLowerCase().includes(query) ||
      asset.serial.toLowerCase().includes(query) ||
      asset.id.toLowerCase().includes(query) ||
      (asset.location && asset.location.toLowerCase().includes(query)) ||
      asset.category.toLowerCase().includes(query);

    // Status Filter
    const dueInfo = getTaskDueStatus(asset);
    let matchesStatus = true;
    if (AppState.statusFilter !== 'ALL') {
      if (AppState.statusFilter === 'Completed') {
        matchesStatus = dueInfo.statusKey === 'Completed';
      } else if (AppState.statusFilter === 'Overdue') {
        matchesStatus = dueInfo.statusKey === 'Overdue';
      } else if (AppState.statusFilter === 'Due Today') {
        matchesStatus = dueInfo.statusKey === 'Due Today';
      } else if (AppState.statusFilter === 'Due Soon') {
        matchesStatus = dueInfo.statusKey === 'Due Soon';
      } else if (AppState.statusFilter === 'Scheduled') {
        matchesStatus = dueInfo.statusKey === 'Scheduled';
      } else {
        matchesStatus = asset.status === AppState.statusFilter;
      }
    }

    // Category Filter
    const matchesCategory = AppState.categoryFilter === 'ALL' || asset.category === AppState.categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Sort Assets strictly by Status Priority (1. Completed -> 2. Overdue -> 3. Due Today -> 4. Due Soon -> 5. Scheduled)
  return assets.sort((a, b) => {
    const statusA = getTaskDueStatus(a);
    const statusB = getTaskDueStatus(b);
    if (statusA.priority !== statusB.priority) {
      return statusA.priority - statusB.priority;
    }
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
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
    DOM.cardViewContainer.classList.remove('grid');
    DOM.cardViewContainer.classList.add('hidden');
    renderTableView(filtered);
  } else {
    DOM.tableViewContainer.classList.add('hidden');
    DOM.cardViewContainer.classList.remove('hidden');
    DOM.cardViewContainer.classList.add('grid');
    renderCardView(filtered);
  }
}

function renderTableView(assets) {
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  DOM.assetTableBody.innerHTML = assets.map(asset => {
    const statusBadge = getStatusBadgeHTML(asset);
    const thumbnail = asset.imageUrl
      ? `<img src="${asset.imageUrl}" alt="${escapeHTML(asset.name)}" onclick="openImageLightbox('${escapeHTML(asset.imageUrl)}', '${escapeHTML(asset.name)}')" class="w-10 h-10 rounded-xl object-cover bg-zinc-800 border border-zinc-700 cursor-pointer hover:border-amber-400 hover:scale-105 transition-all" title="Click to view & download image">`
      : `<div class="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500"><i class="fa-solid fa-box text-sm"></i></div>`;

    const adminActionButtons = isUserAdmin ? `
      <button onclick="openEditAssetModal('${asset.id}')" class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Edit Asset">
        <i class="fa-solid fa-pen-to-square text-xs"></i>
      </button>
      <button onclick="confirmDeleteAsset('${asset.id}')" class="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete Asset">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    ` : '';

    const dueStatusForBtn = getTaskDueStatus(asset);
    const quickCompleteBtn = (!isUserAdmin && dueStatusForBtn.statusKey !== 'Completed' && asset.dueDate) ? `
      <button onclick="markTaskCompleted('${asset.id}')" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1" title="Mark Task as Completed — requires photo proof">
        <i class="fa-solid fa-check text-[9px]"></i> Complete
      </button>
    ` : '';

    const dueDateDisplay = asset.dueDate ? `<span class="text-amber-400/90 font-medium">${asset.dueDate}</span>` : '<span class="text-zinc-600">None</span>';

    return `
      <tr class="border-b border-zinc-800/80">
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            ${thumbnail}
            <div>
              <p class="font-bold text-white leading-snug text-sm">${escapeHTML(asset.name)}</p>
              <p class="text-xs text-zinc-400 font-mono">${escapeHTML(asset.id)}</p>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 text-xs font-medium text-zinc-300 hidden md:table-cell">
          ${escapeHTML(asset.category)}
        </td>
        <td class="py-3.5 px-4 text-xs font-mono text-zinc-400 hidden sm:table-cell">
          ${escapeHTML(asset.serial)}
        </td>
        <td class="py-3.5 px-4 text-xs text-zinc-300 hidden sm:table-cell">
          <i class="fa-solid fa-location-dot text-[10px] text-zinc-500 mr-1"></i> ${escapeHTML(asset.location || 'Unassigned')}
        </td>
        <td class="py-3.5 px-4">
          ${statusBadge}
        </td>
        <td class="py-3.5 px-4 text-xs font-mono hidden md:table-cell">
          ${dueDateDisplay}
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
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
    const statusBadge = getStatusBadgeHTML(asset);
    const thumbnail = asset.imageUrl
      ? `<img src="${asset.imageUrl}" alt="${escapeHTML(asset.name)}" onclick="openImageLightbox('${escapeHTML(asset.imageUrl)}', '${escapeHTML(asset.name)}')" class="w-full h-40 object-cover bg-zinc-800 cursor-pointer hover:opacity-90 transition-opacity" title="Click to view & download image">`
      : `<div class="w-full h-40 bg-zinc-800/80 flex items-center justify-center text-zinc-600 text-3xl"><i class="fa-solid fa-box"></i></div>`;

    const adminCardActions = isUserAdmin ? `
      <button onclick="openEditAssetModal('${asset.id}')" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors" title="Edit Asset">
        <i class="fa-solid fa-pen text-xs"></i>
      </button>
      <button onclick="confirmDeleteAsset('${asset.id}')" class="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 rounded-lg transition-colors" title="Delete Asset">
        <i class="fa-solid fa-trash text-xs"></i>
      </button>
    ` : '';

    const dueStatusForCardBtn = getTaskDueStatus(asset);
    const quickCompleteBtn = (!isUserAdmin && dueStatusForCardBtn.statusKey !== 'Completed' && asset.dueDate) ? `
      <button onclick="markTaskCompleted('${asset.id}')" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1" title="Mark Task as Completed — requires photo proof">
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

function calculateNextDueDate(baseDateStr, frequency) {
  if (!frequency || frequency === 'None') return '';
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
  if (isNaN(baseDate.getTime())) return '';

  let monthsToAdd = 0;
  if (frequency === 'Monthly') monthsToAdd = 1;
  else if (frequency === 'Bi-Monthly') monthsToAdd = 2;
  else if (frequency === 'Quarterly') monthsToAdd = 3;
  else if (frequency === 'Bi-Annually') monthsToAdd = 6;
  else if (frequency === 'Annually' || frequency === 'Yearly') monthsToAdd = 12;

  if (monthsToAdd > 0) {
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

function handleFrequencyChange() {
  // Frequency changed by user; due date remains manually managed by Admin
}

function handleCategorySelectChange() {
  if (!DOM.assetFormCategory || !DOM.assetFormCustomCategory) return;
  if (DOM.assetFormCategory.value === 'Other') {
    DOM.assetFormCustomCategory.classList.remove('hidden');
    DOM.assetFormCustomCategory.focus();
  } else {
    DOM.assetFormCustomCategory.classList.add('hidden');
    DOM.assetFormCustomCategory.value = '';
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
  if (DOM.assetFormDueDate) DOM.assetFormDueDate.value = '';
  if (DOM.assetFormFrequency) DOM.assetFormFrequency.value = 'None';
  if (DOM.assetFormCompletion) DOM.assetFormCompletion.value = 'false';
  if (DOM.assetFormCategory) DOM.assetFormCategory.value = 'HVAC / Aircon';
  if (DOM.assetFormCustomCategory) {
    DOM.assetFormCustomCategory.classList.add('hidden');
    DOM.assetFormCustomCategory.value = '';
  }
  updateAssetFormPreview('');

  DOM.assetModal.classList.remove('hidden');
  DOM.assetModal.classList.add('flex');
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
  if (DOM.assetFormCategory) {
    const predefinedOpts = Array.from(DOM.assetFormCategory.options).map(o => o.value);
    if (predefinedOpts.includes(asset.category) && asset.category !== 'Other') {
      DOM.assetFormCategory.value = asset.category;
      if (DOM.assetFormCustomCategory) {
        DOM.assetFormCustomCategory.classList.add('hidden');
        DOM.assetFormCustomCategory.value = '';
      }
    } else {
      DOM.assetFormCategory.value = 'Other';
      if (DOM.assetFormCustomCategory) {
        DOM.assetFormCustomCategory.classList.remove('hidden');
        DOM.assetFormCustomCategory.value = asset.category || '';
      }
    }
  }
  DOM.assetFormSerial.value = asset.serial;
  DOM.assetFormStatus.value = asset.status;
  DOM.assetFormLocation.value = asset.location || '';
  DOM.assetFormLastMaint.value = asset.lastMaintenance || '';
  if (DOM.assetFormFrequency) DOM.assetFormFrequency.value = asset.frequency || 'None';
  if (DOM.assetFormDueDate) DOM.assetFormDueDate.value = asset.dueDate || '';
  if (DOM.assetFormCompletion) DOM.assetFormCompletion.value = asset.isCompleted ? 'true' : 'false';
  DOM.assetFormValue.value = asset.value || '';
  DOM.assetFormImage.value = asset.imageUrl || '';
  DOM.assetFormFileInput.value = '';
  DOM.assetFileLabel.textContent = 'Choose Local Device Image';

  updateAssetFormPreview(asset.imageUrl || '');
  DOM.assetModalTitle.textContent = `Edit Asset (${asset.id})`;

  DOM.assetModal.classList.remove('hidden');
  DOM.assetModal.classList.add('flex');
}

function closeAssetModal() {
  DOM.assetModal.classList.add('hidden');
  DOM.assetModal.classList.remove('flex');
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

  const assignedDueDate = DOM.assetFormDueDate ? DOM.assetFormDueDate.value : '';
  let selectedStatus = DOM.assetFormStatus.value;

  if (assignedDueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueParts = assignedDueDate.split('-');
    const due = new Date(parseInt(dueParts[0], 10), parseInt(dueParts[1], 10) - 1, parseInt(dueParts[2], 10));
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0 && selectedStatus === 'Good') {
      selectedStatus = 'Maintenance Needed';
    }
  }

  // When editing, find the existing asset record to preserve completion fields
  const existingAsset = isEditing ? AppState.assets.find(a => a.id === id) : null;

  const selectedCatOption = DOM.assetFormCategory.value;
  const customCatText = DOM.assetFormCustomCategory ? DOM.assetFormCustomCategory.value.trim() : '';
  const finalCategory = (selectedCatOption === 'Other' && customCatText) ? customCatText : selectedCatOption;

  const frequencyVal = DOM.assetFormFrequency ? DOM.assetFormFrequency.value : 'None';

  const formCompletionVal = DOM.assetFormCompletion ? (DOM.assetFormCompletion.value === 'true') : (existingAsset ? Boolean(existingAsset.isCompleted) : false);
  const finalIsCompleted = (selectedStatus === 'Maintenance Needed' || selectedStatus === 'Out of Service') ? false : formCompletionVal;

  const assetData = {
    id: isEditing ? id : `AST-${Math.floor(1000 + Math.random() * 9000)}`,
    name: DOM.assetFormName.value.trim(),
    category: finalCategory,
    serial: serialNumber,
    status: selectedStatus,
    location: DOM.assetFormLocation.value.trim() || 'Main Area',
    lastMaintenance: DOM.assetFormLastMaint.value || new Date().toISOString().split('T')[0],
    frequency: frequencyVal,
    dueDate: assignedDueDate,
    value: parseFloat(DOM.assetFormValue.value) || 0,
    imageUrl: DOM.assetFormImage.value.trim(),
    isCompleted: finalIsCompleted,
    completedImageUrl: finalIsCompleted ? (existingAsset ? (existingAsset.completedImageUrl || existingAsset.imageUrl || '') : '') : '',
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
  if (assetData.dueDate) {
    const dueInfo = getTaskDueStatus(assetData);
    StorageManager.addNotification({
      recipientRole: 'store',
      recipientStoreCode: AppState.activeStore.code,
      title: 'Task Due Date Assigned',
      message: `Admin assigned a maintenance due date of ${assetData.dueDate} (${dueInfo.daysSubtext}) for "${assetData.name}"`,
      assetId: assetData.id,
      storeCode: AppState.activeStore.code,
      type: 'assignment'
    });
  } else {
    StorageManager.addNotification({
      recipientRole: 'store',
      recipientStoreCode: AppState.activeStore.code,
      title: isEditing ? 'Asset Updated by Admin' : 'New Asset Assigned by Admin',
      message: isEditing
        ? `Admin updated record details for asset "${assetData.name}"`
        : `Admin assigned new asset "${assetData.name}" to store ${AppState.activeStore.code}`,
      assetId: assetData.id,
      storeCode: AppState.activeStore.code,
      type: 'status'
    });
  }

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

function updateCompletionChecklist() {
  if (!DOM.completionModeBanner || DOM.completionModeBanner.classList.contains('hidden')) return;

  const assetId = DOM.logFormAssetId ? DOM.logFormAssetId.value : null;
  const asset = assetId ? AppState.assets.find(a => a.id === assetId) : null;

  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  if (isUserAdmin) {
    setCheck(DOM.checklistDate, DOM.checklistDateIcon, true, 'Date Completed', 'Date Completed');
    setCheck(DOM.checklistName, DOM.checklistNameIcon, true, 'Responsible', 'Responsible');
    setCheck(DOM.checklistPhoto, DOM.checklistPhotoIcon, true, 'Proof Photo', 'Proof Photo');
    return;
  }

  const dateVal = DOM.logFormDate ? DOM.logFormDate.value : '';
  const isDateValid = Boolean(dateVal);

  const hasName = Boolean(DOM.logFormTechnician && DOM.logFormTechnician.value.trim().length > 0);
  const hasPhoto = Boolean(DOM.logFormImage && DOM.logFormImage.value.trim().length > 5);

  function setCheck(rowEl, iconEl, ok, okText, failText) {
    if (!rowEl || !iconEl) return;
    if (ok) {
      rowEl.className = 'flex items-center gap-2 text-[11px] font-medium transition-colors text-emerald-400';
      iconEl.className = 'fa-solid fa-circle-check text-[11px]';
      rowEl.querySelector('span').innerHTML = okText + ' — <span class="font-normal">✓ done</span>';
    } else {
      rowEl.className = 'flex items-center gap-2 text-[11px] font-medium transition-colors text-rose-400';
      iconEl.className = 'fa-solid fa-circle-xmark text-[11px]';
      rowEl.querySelector('span').innerHTML = failText + ' — <span class="font-normal">required</span>';
    }
  }

  setCheck(DOM.checklistDate, DOM.checklistDateIcon, isDateValid, 'Date Completed', 'Date Completed');
  setCheck(DOM.checklistName, DOM.checklistNameIcon, hasName, 'Responsible', 'Responsible');
  setCheck(DOM.checklistPhoto, DOM.checklistPhotoIcon, hasPhoto, 'Proof Photo', 'Proof Photo');
}

function activateCompletionMode() {
  const assetId = DOM.logFormAssetId ? DOM.logFormAssetId.value : null;
  const asset = assetId ? AppState.assets.find(a => a.id === assetId) : null;
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  // Switch form UI into "Task Completion" mode
  if (DOM.logFormCompletionMode) DOM.logFormCompletionMode.value = '1';
  if (DOM.completionModeBanner) DOM.completionModeBanner.classList.remove('hidden');
  if (DOM.logFormDateLabel) {
    const minNotice = asset && asset.dueDate ? ` <span class="text-amber-400 font-normal">(min: ${asset.dueDate})</span>` : '';
    DOM.logFormDateLabel.innerHTML = isUserAdmin
      ? `Date Completed <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>${minNotice}`
      : `Date Completed <span class="text-rose-400">*</span> <span class="text-emerald-400 font-normal">(required)</span>${minNotice}`;
  }
  if (DOM.logFormTechnicianLabel) {
    DOM.logFormTechnicianLabel.innerHTML = isUserAdmin
      ? 'Responsible <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>'
      : 'Responsible <span class="text-rose-400">*</span> <span class="text-emerald-400 font-normal">(required)</span>';
  }
  if (DOM.logFormTechnician) {
    DOM.logFormTechnician.placeholder = isUserAdmin ? 'e.g. Admin (admin1)' : 'e.g. Juan Santos — person responsible for completion';
    DOM.logFormTechnician.classList.add('border-emerald-500/50');
  }
  if (DOM.logFormPhotoLabel) {
    DOM.logFormPhotoLabel.innerHTML = isUserAdmin
      ? 'Proof Photo <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>'
      : 'Proof Photo <span class="text-rose-400">*</span> <span class="text-emerald-400 font-normal">(required)</span>';
  }
  if (DOM.photoRequiredNotice) {
    if (isUserAdmin) DOM.photoRequiredNotice.classList.add('hidden');
    else DOM.photoRequiredNotice.classList.remove('hidden');
  }
  if (DOM.logFormSubmitLabel) DOM.logFormSubmitLabel.textContent = 'Submit Completion';
  if (DOM.logFormSubmitBtn) {
    DOM.logFormSubmitBtn.className = 'px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5';
  }
  // Highlight the date & image fields & enforce HTML min date attribute
  if (DOM.logFormDate) {
    DOM.logFormDate.classList.add('border-emerald-500/50', 'ring-1', 'ring-emerald-500/30');
    if (asset && asset.dueDate && !isUserAdmin) {
      DOM.logFormDate.min = asset.dueDate;
    }
  }
  if (DOM.logFileUploadBtn) {
    DOM.logFileUploadBtn.classList.add('border-emerald-500/50', 'text-emerald-300');
    DOM.logFileUploadBtn.classList.remove('border-zinc-700');
  }

  updateCompletionChecklist();
}

function deactivateCompletionMode() {
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';
  if (DOM.logFormCompletionMode) DOM.logFormCompletionMode.value = '0';
  if (DOM.completionModeBanner) DOM.completionModeBanner.classList.add('hidden');
  if (DOM.logFormDateLabel) {
    DOM.logFormDateLabel.innerHTML = isUserAdmin
      ? 'Service Date <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>'
      : 'Service Date';
  }
  if (DOM.logFormTechnicianLabel) {
    DOM.logFormTechnicianLabel.innerHTML = isUserAdmin
      ? 'Responsible <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>'
      : 'Responsible';
  }
  if (DOM.logFormTechnician) {
    DOM.logFormTechnician.placeholder = 'e.g. Juan Santos — person responsible';
    DOM.logFormTechnician.classList.remove('border-emerald-500/50', 'border-rose-500', 'ring-1', 'ring-rose-500/40');
  }
  if (DOM.logFormPhotoLabel) {
    DOM.logFormPhotoLabel.innerHTML = isUserAdmin
      ? 'Service Photo / Receipt <span class="text-zinc-400 font-normal text-[11px]">(optional for Admin)</span>'
      : 'Service Photo / Receipt (Upload or Link)';
  }
  if (DOM.nameRequiredNotice) DOM.nameRequiredNotice.classList.add('hidden');
  if (DOM.photoRequiredNotice) DOM.photoRequiredNotice.classList.add('hidden');
  if (DOM.proofUploadedTick) DOM.proofUploadedTick.classList.add('hidden');
  if (DOM.logFormSubmitLabel) DOM.logFormSubmitLabel.textContent = 'Save Comment / Service Log';
  if (DOM.logFormSubmitBtn) {
    DOM.logFormSubmitBtn.className = 'px-4 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold rounded-lg flex items-center gap-1.5';
  }
  if (DOM.logFormDate) {
    DOM.logFormDate.classList.remove('border-emerald-500/50', 'ring-1', 'ring-emerald-500/30', 'border-rose-500', 'ring-rose-500/40');
    DOM.logFormDate.removeAttribute('min');
  }
  if (DOM.logFormImage) {
    DOM.logFormImage.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500/40');
  }
  if (DOM.logFileUploadBtn) {
    DOM.logFileUploadBtn.classList.remove('border-emerald-500/50', 'text-emerald-300');
    DOM.logFileUploadBtn.classList.add('border-zinc-700');
  }
}

function markTaskCompleted(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  if (!canUserAddComment(AppState.activeStore.code)) {
    showToast('Unauthorized: Only assigned Store account or Admin can mark task as completed.', 'error');
    return;
  }

  if (asset.isCompleted && asset.status === 'Good') {
    showToast('This task is already marked as completed.', 'info');
    return;
  }

  // If completion form is ALREADY open, clicking Mark Complete will directly submit the form!
  const isFormOpen = DOM.newLogForm && !DOM.newLogForm.classList.contains('hidden');
  const isCompletionMode = DOM.logFormCompletionMode && DOM.logFormCompletionMode.value === '1';

  if (isFormOpen && isCompletionMode) {
    if (typeof DOM.newLogForm.requestSubmit === 'function') {
      DOM.newLogForm.requestSubmit();
    } else {
      handleNewLogSubmit(new Event('submit'));
    }
    return;
  }

  openHistoryModal(assetId);

  // Pre-fill the service log form for completion
  setTimeout(() => {
    if (DOM.newLogForm) {
      DOM.newLogForm.classList.remove('hidden');
    }
    if (DOM.logFormNewStatus) DOM.logFormNewStatus.value = 'Good';
    if (DOM.logFormNotes && (!DOM.logFormNotes.value || DOM.logFormNotes.value.length < 5)) {
      DOM.logFormNotes.value = 'Task completed and verified. Photo proof of completed work attached below.';
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (DOM.logFormDate) {
      configureLogFormDateBounds(asset);
    }
    activateCompletionMode();
  }, 300);
}

function markTaskIncomplete(assetId) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Admin accounts can mark tasks as incomplete.', 'error');
    return;
  }

  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  asset.isCompleted = false;
  asset.completedImageUrl = '';
  asset.updatedAt = new Date().toISOString();

  StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);

  if (supabaseClient) {
    supabaseClient.from('assets').upsert([{
      id: asset.id,
      store_code: AppState.activeStore.code,
      name: asset.name,
      category: asset.category,
      serial: asset.serial,
      status: asset.status,
      location: asset.location || '',
      last_maintenance: asset.lastMaintenance || '',
      due_date: asset.dueDate || null,
      value: asset.value || 0,
      image_url: asset.imageUrl || '',
      is_completed: false,
      completed_image_url: '',
      updated_at: asset.updatedAt
    }]).catch(err => console.log('Asset completion reset sync note:', err));
  }

  StorageManager.addNotification({
    recipientRole: 'store',
    recipientStoreCode: AppState.activeStore.code,
    title: 'Task Marked as Incomplete',
    message: `Admin ${AppState.currentUser.username} updated status of "${asset.name}" to NOT COMPLETED / Pending.`,
    assetId: asset.id,
    storeCode: AppState.activeStore.code,
    type: 'status'
  });

  refreshAppUI();

  if (DOM.historyModal && !DOM.historyModal.classList.contains('hidden')) {
    openHistoryModal(asset.id);
  }

  showToast(`Task for "${asset.name}" marked as NOT COMPLETED.`, 'info');
}

function confirmDeleteAsset(assetId) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can delete assets.', 'error');
    return;
  }

  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  showConfirmModal(
    `Delete asset "${asset.name}" (${asset.serial})? This will also remove all related maintenance logs. This cannot be undone.`,
    () => {
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
    },
    'Delete Asset',
    'fa-trash'
  );
}


function canUserAddComment(storeCode) {
  if (!AppState.currentUser) return false;
  if (AppState.currentUser.role === 'admin') return true;
  if (AppState.currentUser.role === 'store' && AppState.currentUser.storeCode === storeCode) return true;
  return false;
}

function toggleNotificationDropdown(e) {
  if (e) e.stopPropagation();
  if (DOM.notifDropdown) {
    DOM.notifDropdown.classList.toggle('hidden');
    renderNotifications();
  }
}

function toggleNewLogForm(e) {
  if (e) e.stopPropagation();
  if (!canUserAddComment(AppState.activeStore ? AppState.activeStore.code : '')) {
    showToast('Unauthorized: Only Admins or assigned Store account can add comments.', 'error');
    return;
  }
  if (DOM.newLogForm) {
    const isHidden = DOM.newLogForm.classList.contains('hidden');
    if (isHidden) {
      DOM.newLogForm.classList.remove('hidden');
      deactivateCompletionMode();
      if (DOM.logFormNotes) DOM.logFormNotes.focus();
    } else {
      DOM.newLogForm.classList.add('hidden');
      deactivateCompletionMode();
    }
  }
}

function updateLogFormPreview(url) {
  if (url) {
    DOM.logFormPreviewBox.classList.remove('hidden');
    DOM.logFormPreviewBox.innerHTML = `
      <div class="relative w-full h-36 group cursor-pointer overflow-hidden rounded-lg border border-zinc-800" onclick="openImageLightbox('${escapeHTML(url)}', 'Photo Preview')">
        <img src="${url}" class="w-full h-full object-contain bg-zinc-950/90">
        <div class="absolute inset-0 bg-zinc-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span class="bg-emerald-500 text-zinc-950 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-lg">
            <i class="fa-solid fa-expand text-xs"></i> Click to View &amp; Download Image
          </span>
        </div>
      </div>
    `;
  } else {
    DOM.logFormPreviewBox.classList.add('hidden');
    DOM.logFormPreviewBox.innerHTML = '';
  }
}

function updateAssetFormPreview(url) {
  if (url) {
    if (DOM.assetFormPreviewBox) {
      DOM.assetFormPreviewBox.classList.remove('hidden');
      DOM.assetFormPreviewBox.innerHTML = `
        <div class="relative w-full h-36 group cursor-pointer overflow-hidden rounded-lg border border-zinc-800" onclick="openImageLightbox('${escapeHTML(url)}', 'Asset Photo Preview')">
          <img src="${url}" class="w-full h-full object-contain bg-zinc-950/90">
          <div class="absolute inset-0 bg-zinc-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="bg-emerald-500 text-zinc-950 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-lg">
              <i class="fa-solid fa-expand text-xs"></i> Click to View &amp; Download Image
            </span>
          </div>
        </div>
      `;
    }
  } else {
    if (DOM.assetFormPreviewBox) {
      DOM.assetFormPreviewBox.classList.add('hidden');
      DOM.assetFormPreviewBox.innerHTML = '';
    }
  }
}

function configureLogFormDateBounds(asset) {
  if (!DOM.logFormDate) return;
  DOM.logFormDate.removeAttribute('min');
  DOM.logFormDate.removeAttribute('max');
  const todayStr = new Date().toISOString().split('T')[0];
  DOM.logFormDate.value = todayStr;
}

async function openHistoryModal(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  // Dynamically sync latest maintenance logs from Supabase for shared Store & Admin thread view
  if (supabaseClient) {
    try {
      const { data: remoteLogs, error } = await supabaseClient
        .from('maintenance_logs')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false });

      if (!error && remoteLogs) {
        const mappedRemote = remoteLogs.map(l => ({
          id: l.id,
          assetId: l.asset_id,
          date: l.date,
          technician: l.technician,
          statusBefore: l.status_before,
          statusAfter: l.status_after,
          cost: parseFloat(l.cost) || 0,
          imageUrl: l.image_url,
          notes: l.notes
        }));

        const storeCode = AppState.activeStore.code;
        const currentLogs = StorageManager.getLogs(storeCode);
        const merged = [...mappedRemote];
        currentLogs.forEach(c => {
          if (c.assetId !== assetId && !merged.some(m => m.id === c.id)) {
            merged.push(c);
          }
        });

        StorageManager.saveLogs(storeCode, merged, false);
        AppState.logs = merged;
      }
    } catch (e) {
      console.log('Log sync note:', e);
    }
  }

  DOM.historyModalAssetName.textContent = asset.name;
  DOM.historyModalAssetStatus.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${asset.status === 'Good' ? 'badge-good' : asset.status === 'Maintenance Needed' ? 'badge-maintenance' : 'badge-oos'
    }`;
  DOM.historyModalAssetStatus.textContent = asset.status;
  DOM.historyModalAssetMeta.textContent = `${asset.serial} • ${asset.category} • ${asset.location || 'No Location'}`;

  // Show / hide Mark as Completed quick action banner
  const dueStatusModal = getTaskDueStatus(asset);
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  if (DOM.markCompletedBanner) {
    if (!isUserAdmin && dueStatusModal.statusKey !== 'Completed' && asset.dueDate) {
      DOM.markCompletedBanner.classList.remove('hidden');
      DOM.markCompletedBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>
          <div>
            <p class="text-xs font-bold text-emerald-300">Ready to mark as completed?</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">Attach a photo proof of the completed work before submitting.</p>
          </div>
          <button onclick="markTaskCompleted('${asset.id}')" class="ml-auto px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
            <i class="fa-solid fa-check text-[10px]"></i> Mark Complete
          </button>
        </div>
      `;
    } else if (dueStatusModal.statusKey === 'Completed') {
      DOM.markCompletedBanner.classList.remove('hidden');
      DOM.markCompletedBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
          <div class="flex-1">
            <p class="text-xs font-bold text-emerald-300">✅ Task Completed</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">Photo proof of completed work attached below (Click to view &amp; download).</p>
          </div>
          ${isUserAdmin ? `
            <button onclick="markTaskIncomplete('${asset.id}')" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5" title="Mark Task as Incomplete / Re-open">
              <i class="fa-solid fa-rotate-left text-[10px]"></i> Mark as Incomplete
            </button>
          ` : ''}
          ${asset.completedImageUrl ? `
            <div onclick="openImageLightbox('${escapeHTML(asset.completedImageUrl)}', 'Completion Proof Photo')" class="flex-shrink-0 cursor-pointer group relative" title="Click to view & download">
              <img src="${asset.completedImageUrl}" alt="Completion proof" class="w-14 h-14 object-cover rounded-lg border-2 border-emerald-500/40 group-hover:border-emerald-400 transition-colors">
              <div class="absolute inset-0 bg-zinc-950/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-download text-white text-xs"></i>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    } else if (!isUserAdmin && dueStatusModal.statusKey !== 'Completed' && !asset.dueDate) {
      DOM.markCompletedBanner.classList.remove('hidden');
      DOM.markCompletedBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-calendar-xmark text-amber-400 text-base"></i>
          <div>
            <p class="text-xs font-bold text-amber-300">No Due Date Set</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">Admin must assign a due date before this task can be marked as completed.</p>
          </div>
        </div>
      `;
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
  configureLogFormDateBounds(asset);
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
}

function closeHistoryModal() {
  DOM.historyModal.classList.add('hidden');
  DOM.historyModal.classList.remove('flex');
  // Always reset completion mode when modal closes
  deactivateCompletionMode();
  if (DOM.newLogForm) DOM.newLogForm.classList.add('hidden');
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
  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

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
      ? `<div class="mt-3 relative inline-block group">
          <img src="${log.imageUrl}" alt="Maintenance Photo" onclick="openImageLightbox('${escapeHTML(log.imageUrl)}', 'Service Log Photo — ${escapeHTML(log.date)}')" class="w-36 h-24 object-cover rounded-xl border border-zinc-700 cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all shadow-md">
          <div onclick="openImageLightbox('${escapeHTML(log.imageUrl)}', 'Service Log Photo — ${escapeHTML(log.date)}')" class="absolute bottom-1.5 right-1.5 bg-zinc-950/85 hover:bg-emerald-500 text-white hover:text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer flex items-center gap-1 transition-colors backdrop-blur-sm border border-zinc-700">
            <i class="fa-solid fa-expand text-[9px]"></i> View &amp; Download
          </div>
        </div>`
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

            <div class="flex items-center gap-2">
              <button type="button" onclick="replyToComment('${escapeHTML(log.technician || '')}')" class="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium">
                <i class="fa-solid fa-reply text-[9px]"></i> Reply
              </button>
              ${isUserAdmin ? `
                <button type="button" onclick="deleteCommentWithUndo('${escapeHTML(log.id)}')" class="text-[11px] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 font-medium ml-1" title="Delete Comment (Admin only)">
                  <i class="fa-solid fa-trash text-[9px]"></i> Delete
                </button>
              ` : ''}
            </div>
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
  const imageUrl = DOM.logFormImage.value.trim();
  const isCompletionMode = DOM.logFormCompletionMode && DOM.logFormCompletionMode.value === '1';

  // Helper function to trigger shake animation on missing input field
  function shakeField(el) {
    if (!el) return;
    el.classList.remove('field-shake');
    void el.offsetWidth; // Force reflow
    el.classList.add('field-shake', 'border-rose-500', 'ring-1', 'ring-rose-500/40');
    el.focus();
    setTimeout(() => el.classList.remove('field-shake'), 500);
  }

  const isUserAdmin = AppState.currentUser && AppState.currentUser.role === 'admin';

  // ─── UPFRONT VALIDATION (Mandatory ONLY for Store Accounts; Optional for Admin) ───
  if (!isUserAdmin) {
    // 1. Date Completed is required for Store in completion mode
    if (isCompletionMode && !serviceDate) {
      showToast('⚠️ Cannot complete task: Please set the Date Completed.', 'error');
      shakeField(DOM.logFormDate);
      return;
    }

    // 2. Proof photo is required for Store in completion mode
    if (isCompletionMode && !imageUrl) {
      showToast('⚠️ Cannot complete task: A proof photo is required. Please upload or link a photo.', 'error');
      if (DOM.photoRequiredNotice) DOM.photoRequiredNotice.classList.remove('hidden');
      if (DOM.proofUploadedTick) DOM.proofUploadedTick.classList.add('hidden');
      shakeField(DOM.logFormImage);
      return;
    }

    // 3. Name is required for Store in completion mode
    if (isCompletionMode && !DOM.logFormTechnician.value.trim()) {
      showToast('⚠️ Cannot complete task: Please enter the responsible person\'s name.', 'error');
      if (DOM.nameRequiredNotice) DOM.nameRequiredNotice.classList.remove('hidden');
      shakeField(DOM.logFormTechnician);
      return;
    }

    // 4. Service Notes & Comments are required for Store
    if (!DOM.logFormNotes || !DOM.logFormNotes.value.trim()) {
      showToast('⚠️ Cannot complete task: Please enter Service Notes / Comments describing the work.', 'error');
      shakeField(DOM.logFormNotes);
      return;
    }
  }

  const finalDate = serviceDate || new Date().toISOString().split('T')[0];
  const finalTech = DOM.logFormTechnician.value.trim() || (isUserAdmin ? `Admin (${AppState.currentUser.username})` : `Store (${AppState.currentUser.storeCode})`);
  const finalNotes = (DOM.logFormNotes && DOM.logFormNotes.value.trim()) ? DOM.logFormNotes.value.trim() : (isUserAdmin ? `Status updated to ${newStatus} by Admin.` : 'Task completed and verified.');

  const isTaskCompletedByDate = Boolean(isCompletionMode || finalDate);

  const resolvedStatusAfter = isTaskCompletedByDate ? 'Good' : newStatus;

  const logEntry = {
    id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
    assetId: asset.id,
    date: finalDate,
    technician: finalTech,
    statusBefore: asset.status,
    statusAfter: resolvedStatusAfter,
    cost: parseFloat(DOM.logFormCost.value) || 0,
    imageUrl: imageUrl,
    notes: finalNotes
  };

  AppState.logs.unshift(logEntry);
  StorageManager.saveLogs(AppState.activeStore.code, AppState.logs);

  asset.lastMaintenance = finalDate;
  asset.updatedAt = new Date().toISOString();

  // ─── Set isCompleted flag ONLY on the specifically submitted asset ────────
  if (isTaskCompletedByDate) {
    asset.isCompleted = true;
    asset.completedImageUrl = imageUrl || asset.completedImageUrl || asset.imageUrl || '';
    asset.status = 'Good';
  } else {
    asset.status = newStatus;
    if (newStatus === 'Maintenance Needed' || newStatus === 'Out of Service') {
      asset.isCompleted = false;
      asset.completedImageUrl = '';
    }
  }

  StorageManager.saveAssets(AppState.activeStore.code, AppState.assets);

  // Trigger Notification for target role
  if (AppState.currentUser.role === 'admin') {
    StorageManager.addNotification({
      recipientRole: 'store',
      recipientStoreCode: AppState.activeStore.code,
      title: isCompletionMode ? 'Task Marked as Completed' : 'New Admin Comment / Reply',
      message: isCompletionMode
        ? `Admin ${AppState.currentUser.username} marked task on "${asset.name}" as COMPLETED.`
        : `Admin ${AppState.currentUser.username} commented on "${asset.name}": "${logEntry.notes.substring(0, 60)}${logEntry.notes.length > 60 ? '...' : ''}"`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: isCompletionMode ? 'status' : 'reply'
    });
  } else {
    StorageManager.addNotification({
      recipientRole: 'admin',
      recipientStoreCode: null,
      title: isCompletionMode ? 'Store Completed Task' : 'New Service Log Submitted',
      message: isCompletionMode
        ? `Store ${AppState.activeStore.code} completed task on "${asset.name}".`
        : `Store ${AppState.activeStore.code} submitted a log for "${asset.name}": "${logEntry.notes.substring(0, 60)}${logEntry.notes.length > 60 ? '...' : ''}"`,
      assetId: asset.id,
      storeCode: AppState.activeStore.code,
      type: isCompletionMode ? 'status' : 'log'
    });
  }

  DOM.newLogForm.classList.add('hidden');
  renderTimelineLogs(asset.id);
  refreshAppUI();

  DOM.historyModalAssetStatus.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${asset.status === 'Good' ? 'badge-good' : asset.status === 'Maintenance Needed' ? 'badge-maintenance' : 'badge-oos'
    }`;
  DOM.historyModalAssetStatus.textContent = asset.status;

  // Update History Modal Completion Banner if task was marked complete
  if (isCompletionMode && DOM.markCompletedBanner) {
    DOM.markCompletedBanner.classList.remove('hidden');
    DOM.markCompletedBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>
        <div class="flex-1">
          <p class="text-xs font-bold text-emerald-300">✅ Task Completed</p>
          <p class="text-[10px] text-zinc-400 mt-0.5">Photo proof of completed work attached below (Click to view &amp; download).</p>
        </div>
        ${asset.completedImageUrl ? `<div onclick="openImageLightbox('${escapeHTML(asset.completedImageUrl)}', 'Completion Proof Photo')" class="flex-shrink-0 cursor-pointer group relative" title="Click to view & download">
          <img src="${asset.completedImageUrl}" alt="Completion proof" class="w-14 h-14 object-cover rounded-lg border-2 border-emerald-500/40 group-hover:border-emerald-400 transition-colors">
          <div class="absolute inset-0 bg-zinc-950/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <i class="fa-solid fa-download text-white text-xs"></i>
          </div>
        </div>` : ''}
      </div>
    `;
    deactivateCompletionMode();
  }

  if (isCompletionMode) {
    showToast(`✅ Maintenance task for "${asset.name}" marked as COMPLETED!`, 'success');
  } else {
    showToast('Comment / Service Log entry recorded & synced!', 'success');
  }
}

const pendingDeletedLogs = {};

function deleteCommentWithUndo(logId) {
  if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
    showToast('Unauthorized: Only Administrators can delete comments.', 'error');
    return;
  }

  const logIdx = AppState.logs.findIndex(l => l.id === logId);
  if (logIdx === -1) return;

  const targetLog = AppState.logs[logIdx];
  const assetId = targetLog.assetId;

  // Temporarily remove from active logs array so UI updates immediately
  AppState.logs.splice(logIdx, 1);
  renderTimelineLogs(assetId);

  // Schedule permanent deletion after 10 seconds
  const timeoutId = setTimeout(() => {
    delete pendingDeletedLogs[logId];
    StorageManager.saveLogs(AppState.activeStore.code, AppState.logs);
    if (supabaseClient) {
      supabaseClient.from('maintenance_logs').delete().eq('id', logId).catch(err => console.log('Log delete note:', err));
    }
  }, 10000);

  pendingDeletedLogs[logId] = {
    log: targetLog,
    originalIndex: logIdx,
    timeoutId: timeoutId
  };

  showUndoToast('Comment deleted.', logId);
}

function undoDeleteComment(logId) {
  const pending = pendingDeletedLogs[logId];
  if (!pending) return;

  // Cancel 10s permanent deletion timer
  clearTimeout(pending.timeoutId);

  // Restore log back into active logs array
  AppState.logs.splice(pending.originalIndex, 0, pending.log);
  delete pendingDeletedLogs[logId];

  // Refresh timeline UI
  renderTimelineLogs(pending.log.assetId);
  showToast('Deletion cancelled. Comment restored.', 'success');
}

function showUndoToast(message, logId) {
  const toast = document.createElement('div');
  toast.id = `undoToast_${logId}`;
  toast.className = 'toast-item pointer-events-auto bg-zinc-900 border border-amber-500/40 text-zinc-100 px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-3 text-xs min-w-[280px]';

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="fa-solid fa-trash-can text-rose-400 text-sm"></i>
      <span>${escapeHTML(message)} <strong class="text-amber-400 font-mono" id="undoTimer_${logId}">(10s)</strong></span>
    </div>
    <button type="button" onclick="handleUndoClick('${escapeHTML(logId)}')" class="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-lg text-xs transition-all shadow-sm flex items-center gap-1.5">
      <i class="fa-solid fa-rotate-left text-[10px]"></i> Undo
    </button>
  `;

  DOM.toastContainer.appendChild(toast);

  let secondsLeft = 10;
  const intervalId = setInterval(() => {
    secondsLeft--;
    const timerEl = document.getElementById(`undoTimer_${logId}`);
    if (timerEl) timerEl.textContent = `(${secondsLeft}s)`;
    if (secondsLeft <= 0) {
      clearInterval(intervalId);
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(intervalId);
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(16px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }
  }, 10000);
}

function handleUndoClick(logId) {
  const toastEl = document.getElementById(`undoToast_${logId}`);
  if (toastEl) toastEl.remove();
  undoDeleteComment(logId);
}


// ==========================================
// 8. TOAST NOTIFICATIONS & UTILITIES
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

function compressAndBase64Image(file, callback, maxWidth = 800, quality = 0.75) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      callback(compressedBase64);
    };
    img.onerror = function () {
      callback(evt.target.result);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Image Lightbox Viewer & Downloader Functions
function openImageLightbox(src, title = 'Image Preview') {
  if (!src) return;
  const modal = document.getElementById('imageLightboxModal');
  const imgEl = document.getElementById('lightboxImage');
  const titleEl = document.getElementById('lightboxTitle');
  const downloadBtn = document.getElementById('lightboxDownloadBtn');
  if (!modal || !imgEl) return;

  imgEl.src = src;
  if (titleEl) titleEl.textContent = title;

  if (downloadBtn) {
    downloadBtn.href = src;
    const isBase64 = src.startsWith('data:');
    const ext = isBase64 ? (src.includes('png') ? 'png' : 'jpg') : 'jpg';
    downloadBtn.download = `asset_photo_${Date.now()}.${ext}`;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeImageLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;


// ==========================================
// 9. CUSTOM CONFIRM MODAL HELPERS
// ==========================================

let _confirmCallback = null;

function showConfirmModal(message, onConfirm, btnLabel = 'Confirm', btnIcon = 'fa-check') {
  const modal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmModalMessage');
  const btnLabelEl = document.getElementById('confirmModalBtnLabel');
  const btnIconEl = document.getElementById('confirmModalBtnIcon');
  if (!modal || !msgEl) return;

  msgEl.textContent = message;
  if (btnLabelEl) btnLabelEl.textContent = btnLabel;
  if (btnIconEl) btnIconEl.className = `fa-solid ${btnIcon} text-xs`;

  _confirmCallback = onConfirm;
  modal.classList.remove('hidden');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.add('hidden');
  _confirmCallback = null;
}


// ==========================================
// 10. EVENT LISTENERS INITIALIZATION
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
  DOM.storeForm.addEventListener('submit', handleStoreFormSubmit);

  // Live indicator: Check store code availability as admin types
  const newStoreCodeInput = document.getElementById('newStoreCode');
  const storeCodeAvail = document.getElementById('storeCodeAvailability');
  if (newStoreCodeInput && storeCodeAvail) {
    newStoreCodeInput.addEventListener('input', () => {
      const codeVal = newStoreCodeInput.value.trim().toUpperCase();
      const originalCode = DOM.editStoreOriginalCode ? DOM.editStoreOriginalCode.value : '';

      if (!codeVal) {
        storeCodeAvail.classList.add('hidden');
        newStoreCodeInput.classList.remove('border-rose-500', 'border-emerald-500');
        return;
      }

      const stores = StorageManager.getStores();
      const isDuplicate = stores.some(s => s.code.toUpperCase() === codeVal && s.code.toUpperCase() !== originalCode.toUpperCase());

      storeCodeAvail.classList.remove('hidden');
      if (isDuplicate) {
        storeCodeAvail.className = 'mt-1.5 text-[11px] font-medium flex items-center gap-1.5 text-rose-400';
        storeCodeAvail.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <span>Store code "${codeVal}" is already registered</span>`;
        newStoreCodeInput.classList.add('border-rose-500');
        newStoreCodeInput.classList.remove('border-emerald-500');
      } else {
        storeCodeAvail.className = 'mt-1.5 text-[11px] font-medium flex items-center gap-1.5 text-emerald-400';
        storeCodeAvail.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Store code "${codeVal}" is available for registration</span>`;
        newStoreCodeInput.classList.add('border-emerald-500');
        newStoreCodeInput.classList.remove('border-rose-500');
      }
    });
  }

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
      if (DOM.userMenuDropdown) DOM.userMenuDropdown.classList.add('hidden');
      showConfirmModal(
        `Reset all data for store "${AppState.activeStore.code}" back to the original demo state? All current asset records will be replaced.`,
        () => {
          StorageManager.resetStoreData(AppState.activeStore.code);
          loadUserSession();
          showToast('Store data reset to demo defaults.', 'info');
        },
        'Reset Data',
        'fa-rotate-left'
      );
    });
  }

  // Open Add Asset Modal
  if (DOM.openAddAssetBtn) DOM.openAddAssetBtn.addEventListener('click', openAddAssetModal);
  if (DOM.emptyAddBtn) DOM.emptyAddBtn.addEventListener('click', openAddAssetModal);
  DOM.closeAssetModalBtn.addEventListener('click', closeAssetModal);
  DOM.cancelAssetModalBtn.addEventListener('click', closeAssetModal);

  // Asset Form Submit & Field Changes
  DOM.assetForm.addEventListener('submit', handleAssetFormSubmit);
  if (DOM.assetFormCategory) DOM.assetFormCategory.addEventListener('change', handleCategorySelectChange);
  if (DOM.assetFormFrequency) DOM.assetFormFrequency.addEventListener('change', handleFrequencyChange);

  // Confirm modal Cancel / Confirm buttons
  const confirmCancelBtn = document.getElementById('confirmModalCancelBtn');
  const confirmConfirmBtn = document.getElementById('confirmModalConfirmBtn');
  if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
  if (confirmConfirmBtn) {
    confirmConfirmBtn.addEventListener('click', () => {
      if (typeof _confirmCallback === 'function') _confirmCallback();
      closeConfirmModal();
    });
  }

  // Backdrop overlay click closes modals
  const lightboxModal = document.getElementById('imageLightboxModal');
  const modalsToClose = [DOM.adminStoreManagerModal, DOM.storeModal, DOM.assetModal, DOM.historyModal];
  if (lightboxModal) modalsToClose.push(lightboxModal);

  modalsToClose.forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    });
  });

  // ESC key closes any open modal or confirm dialog
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      closeImageLightbox();
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
      reader.onload = function (evt) {
        const rawBase64 = evt.target.result;
        DOM.assetFormImage.value = rawBase64;
        updateAssetFormPreview(rawBase64);
        showToast('Local image attached ✓', 'success');
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
  DOM.cancelLogFormBtn.addEventListener('click', () => {
    DOM.newLogForm.classList.add('hidden');
    deactivateCompletionMode();
  });
  DOM.newLogForm.addEventListener('submit', handleNewLogSubmit);

  // Local File Upload Listener for Maintenance Log Form
  DOM.logFormFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      DOM.logFileLabel.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function (evt) {
        const rawBase64 = evt.target.result;
        DOM.logFormImage.value = rawBase64;
        updateLogFormPreview(rawBase64);
        if (DOM.proofUploadedTick) DOM.proofUploadedTick.classList.remove('hidden');
        if (DOM.photoRequiredNotice) DOM.photoRequiredNotice.classList.add('hidden');
        if (DOM.logFormImage) DOM.logFormImage.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500/40');
        updateCompletionChecklist();
        showToast('Proof photo attached ✓', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Live watcher: image URL paste/type
  if (DOM.logFormImage) {
    DOM.logFormImage.addEventListener('input', () => {
      const hasImage = DOM.logFormImage.value.trim().length > 5;
      if (hasImage) {
        if (DOM.proofUploadedTick) DOM.proofUploadedTick.classList.remove('hidden');
        if (DOM.photoRequiredNotice) DOM.photoRequiredNotice.classList.add('hidden');
        DOM.logFormImage.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500/40');
        updateLogFormPreview(DOM.logFormImage.value.trim());
      } else {
        if (DOM.proofUploadedTick) DOM.proofUploadedTick.classList.add('hidden');
        if (DOM.logFormCompletionMode && DOM.logFormCompletionMode.value === '1') {
          if (DOM.photoRequiredNotice) DOM.photoRequiredNotice.classList.remove('hidden');
        }
      }
      updateCompletionChecklist();
    });
  }

  // Live watcher: date field
  if (DOM.logFormDate) {
    DOM.logFormDate.addEventListener('change', () => {
      if (DOM.logFormDate.value) {
        DOM.logFormDate.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500/40');
      }
      updateCompletionChecklist();
    });
  }

  // Live watcher: technician/name field
  if (DOM.logFormTechnician) {
    DOM.logFormTechnician.addEventListener('input', () => {
      if (DOM.logFormTechnician.value.trim()) {
        DOM.logFormTechnician.classList.remove('border-rose-500', 'ring-1', 'ring-rose-500/40');
        if (DOM.nameRequiredNotice) DOM.nameRequiredNotice.classList.add('hidden');
      }
      updateCompletionChecklist();
    });
  }

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
window.toggleNotificationDropdown = toggleNotificationDropdown;
window.toggleNewLogForm = toggleNewLogForm;
window.handleNotificationClick = handleNotificationClick;

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  switchLoginTab('store');
  renderStoreAccountsList();
  loadUserSession();
});
window.toggleNewLogForm = toggleNewLogForm;
window.handleNotificationClick = handleNotificationClick;

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  switchLoginTab('store');
  renderStoreAccountsList();
  loadUserSession();
});
