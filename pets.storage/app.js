let currentUser = null;
let currentProfile = null;
let currentAuthMode = 'signin';
let activeCategory = 'all';
let modStatusFilter = 'all';
let loadedPosts = [];
let allProfiles = [];
let activeModalPostId = null;

// Global App Settings (Synced with public.app_settings)
let appSettings = {
  maintenance_mode: false,
  allow_public_posts: true,
  max_upload_mb: 50,
  announcement_banner: ''
};

const LOCAL_STORAGE_USERS_KEY = 'marblevet_users_db';
const LOCAL_STORAGE_PROFILES_KEY = 'marblevet_profiles';
const LOCAL_STORAGE_POSTS_KEY = 'marblevet_posts_db';
const LOCAL_STORAGE_COMMENTS_KEY = 'marblevet_comments_db';
const LOCAL_STORAGE_PRIVACY_KEY = 'marblevet_privacy_consent';
const LOCAL_STORAGE_SETTINGS_KEY = 'marblevet_app_settings';
const STORAGE_BUCKET_NAME = 'pet-attachments';

// Allowed MIME types and file extensions for upload validation
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav', 'audio/x-m4a', 'audio/x-wav',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip'
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'mp3', 'm4a', 'wav', 'pdf', 'docx', 'doc', 'zip'];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

async function initApp() {
  if (supabaseClient) {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) showToast(error.message, 'error');

      if (session && session.user) {
        currentUser = session.user;
        localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
        await proceedAfterAuth(currentUser);
        return;
      }
    } catch (err) {
      console.error('Session retrieval error:', err);
    }
  }

  const savedUser = localStorage.getItem('marblevet_session');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    await proceedAfterAuth(currentUser);
  } else {
    showScreen('auth');
  }
}

function showScreen(screen) {
  ['screen-auth', 'screen-username', 'screen-banned', 'screen-maintenance', 'screen-app', 'screen-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.remove('hidden');
}

function setupEventListeners() {
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const authPassword = document.getElementById('auth-password');

  tabSignin.addEventListener('click', () => setAuthMode('signin'));
  tabSignup.addEventListener('click', () => setAuthMode('signup'));

  authPassword.addEventListener('input', (e) => {
    if (currentAuthMode === 'signup') {
      updatePasswordRequirements(e.target.value);
    }
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('btn-github-oauth').addEventListener('click', handleGitHubAuth);
  document.getElementById('username-form').addEventListener('submit', handleUsernameSubmit);

  // Main Role-Based App Navigation Tabs
  document.getElementById('tab-nav-log').addEventListener('click', () => switchAppTab('log'));
  document.getElementById('tab-nav-community').addEventListener('click', () => switchAppTab('community'));
  document.getElementById('tab-nav-moderator').addEventListener('click', () => switchAppTab('moderator'));
  document.getElementById('tab-nav-admin').addEventListener('click', () => switchAppTab('admin'));

  // Moderator Sub-Tabs
  document.getElementById('mod-subtab-posts').addEventListener('click', () => switchModSubtab('posts'));
  document.getElementById('mod-subtab-users').addEventListener('click', () => switchModSubtab('users'));

  // Admin Sub-Tabs
  document.getElementById('admin-subtab-settings').addEventListener('click', () => switchAdminSubtab('settings'));
  document.getElementById('admin-subtab-users').addEventListener('click', () => switchAdminSubtab('users'));
  document.getElementById('admin-subtab-posts').addEventListener('click', () => switchAdminSubtab('posts'));

  // Admin Settings Form
  document.getElementById('admin-settings-form').addEventListener('submit', handleSaveAppSettings);

  // Settings & Sign Out
  document.getElementById('btn-settings').addEventListener('click', () => {
    if (currentProfile) {
      document.getElementById('settings-username').innerText = `@${currentProfile.username}`;
      document.getElementById('settings-role').innerText = currentProfile.role || 'user';
    }
    showScreen('settings');
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => showScreen('app'));
  document.getElementById('btn-signout').addEventListener('click', handleSignOut);
  document.getElementById('btn-banned-signout').addEventListener('click', handleSignOut);
  document.getElementById('btn-maint-signout').addEventListener('click', handleSignOut);

  // Post Creation & Viewing Modals
  document.getElementById('btn-create-post').addEventListener('click', () => document.getElementById('modal-post').classList.remove('hidden'));
  document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('modal-post').classList.add('hidden'));
  document.getElementById('btn-cancel-post').addEventListener('click', () => document.getElementById('modal-post').classList.add('hidden'));
  document.getElementById('btn-close-view-modal').addEventListener('click', () => document.getElementById('modal-view-post').classList.add('hidden'));

  // Modal Delete & Moderation Actions
  document.getElementById('btn-delete-post-modal').addEventListener('click', () => {
    if (activeModalPostId) handleDeletePost(activeModalPostId);
  });
  document.getElementById('btn-save-modal-mod').addEventListener('click', handleSaveModalModeration);

  // Privacy Policy Modal Triggers
  document.getElementById('btn-open-privacy').addEventListener('click', () => openPrivacyModal(false));
  document.getElementById('btn-close-privacy').addEventListener('click', () => document.getElementById('modal-privacy').classList.add('hidden'));
  document.getElementById('btn-privacy-accept-ack').addEventListener('click', () => handlePrivacyDecision('acknowledged'));
  document.getElementById('btn-privacy-accept-no-ack').addEventListener('click', () => handlePrivacyDecision('no_acknowledgment'));
  document.getElementById('btn-privacy-no').addEventListener('click', () => handlePrivacyDecision('declined'));

  document.getElementById('post-form').addEventListener('submit', handleCreatePost);

  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', handleCreateComment);
  }

  document.getElementById('change-pass-form').addEventListener('submit', handleChangePassword);

  // Community Category Filters
  document.querySelectorAll('.cat-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-filter').forEach(b => {
        b.classList.remove('bg-amber-600', 'text-stone-950', 'font-bold');
        b.classList.add('bg-stone-900', 'text-stone-400');
      });
      e.target.classList.remove('bg-stone-900', 'text-stone-400');
      e.target.classList.add('bg-amber-600', 'text-stone-950', 'font-bold');
      activeCategory = e.target.getAttribute('data-category');
      renderPosts();
    });
  });

  // Moderator Status Filters
  document.querySelectorAll('.mod-status-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mod-status-filter').forEach(b => {
        b.classList.remove('bg-sky-600', 'text-stone-950', 'font-bold');
        b.classList.add('bg-stone-900', 'text-stone-400');
      });
      e.target.classList.remove('bg-stone-900', 'text-stone-400');
      e.target.classList.add('bg-sky-600', 'text-stone-950', 'font-bold');
      modStatusFilter = e.target.getAttribute('data-status');
      renderModeratorQueue();
    });
  });

  document.getElementById('search-input').addEventListener('input', renderPosts);
}

// ============================================================================
// APP SETTINGS LOADER (public.app_settings)
// ============================================================================
async function loadAppSettings() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('app_settings').select('key, value');
    if (!error && Array.isArray(data)) {
      data.forEach(row => {
        if (row.key in appSettings) {
          appSettings[row.key] = row.value;
        }
      });
    }
  } else {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY) || 'null');
    if (saved) appSettings = { ...appSettings, ...saved };
  }

  applyAppSettingsToUI();
}

function applyAppSettingsToUI() {
  // 1. Announcement Banner
  const bannerBar = document.getElementById('global-announcement-bar');
  const bannerText = document.getElementById('global-announcement-text');
  if (appSettings.announcement_banner && String(appSettings.announcement_banner).trim() !== '') {
    bannerText.innerText = appSettings.announcement_banner;
    bannerBar.classList.remove('hidden');
  } else {
    bannerBar.classList.add('hidden');
  }

  // 2. Max Upload Size Label
  const maxMb = Number(appSettings.max_upload_mb) || 50;
  const labelMax = document.getElementById('label-max-upload-mb');
  if (labelMax) labelMax.innerText = maxMb;

  // 3. Allow Public Posts Toggle
  const publicOpt = document.getElementById('option-visibility-public');
  if (publicOpt) {
    if (appSettings.allow_public_posts === false) {
      publicOpt.disabled = true;
      publicOpt.innerText = 'Public (Disabled by Admin)';
      document.getElementById('post-visibility').value = 'private';
    } else {
      publicOpt.disabled = false;
      publicOpt.innerText = 'Public (Community Advice)';
    }
  }

  // 4. Populate Admin Form Inputs
  document.getElementById('setting-maintenance-mode').checked = Boolean(appSettings.maintenance_mode);
  document.getElementById('setting-allow-public').checked = appSettings.allow_public_posts !== false;
  document.getElementById('setting-max-upload-mb').value = maxMb;
  document.getElementById('setting-announcement-banner').value = appSettings.announcement_banner || '';
}

async function handleSaveAppSettings(e) {
  e.preventDefault();
  if (getCurrentRole() !== 'admin') {
    return showToast('Only the Admin can modify app settings.', 'error');
  }

  const updates = {
    maintenance_mode: document.getElementById('setting-maintenance-mode').checked,
    allow_public_posts: document.getElementById('setting-allow-public').checked,
    max_upload_mb: Number(document.getElementById('setting-max-upload-mb').value) || 50,
    announcement_banner: document.getElementById('setting-announcement-banner').value.trim()
  };

  if (supabaseClient) {
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.id
    }));

    const { error } = await supabaseClient.from('app_settings').upsert(rows);
    if (error) return showToast(error.message, 'error');
  } else {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updates));
  }

  appSettings = { ...appSettings, ...updates };
  applyAppSettingsToUI();
  showToast('Global app settings saved!', 'success');
}

// ============================================================================
// PRIVACY POLICY & FIRST-TIME SIGN-IN FLOW
// ============================================================================
function getUserPrivacyStatus(userId) {
  const consents = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PRIVACY_KEY) || '{}');
  return consents[userId] || null;
}

function setUserPrivacyStatus(userId, status) {
  const consents = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PRIVACY_KEY) || '{}');
  consents[userId] = { status, timestamp: new Date().toISOString() };
  localStorage.setItem(LOCAL_STORAGE_PRIVACY_KEY, JSON.stringify(consents));
}

function openPrivacyModal(isFirstSignIn) {
  const modal = document.getElementById('modal-privacy');
  const btnNo = document.getElementById('btn-privacy-no');
  const btnClose = document.getElementById('btn-close-privacy');
  const actionsBar = document.getElementById('privacy-consent-actions');

  if (isFirstSignIn) {
    btnNo.classList.remove('hidden');
    actionsBar.classList.remove('hidden');
    btnClose.classList.add('hidden');
  } else {
    btnNo.classList.add('hidden');
    actionsBar.classList.add('hidden');
    btnClose.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

async function proceedAfterAuth(user) {
  const existingDecision = getUserPrivacyStatus(user.id);
  if (!existingDecision) {
    openPrivacyModal(true);
    return;
  }
  await fetchProfile(user.id);
}

async function handlePrivacyDecision(choice) {
  const modal = document.getElementById('modal-privacy');

  if (choice === 'declined') {
    modal.classList.add('hidden');
    handleSignOut();
    showToast('Privacy agreement declined. You have been signed out.', 'error');
    return;
  }

  if (currentUser) {
    setUserPrivacyStatus(currentUser.id, choice);
  }

  modal.classList.add('hidden');
  showToast(
    choice === 'acknowledged'
      ? 'Privacy agreement accepted and acknowledged.'
      : 'Privacy agreement accepted without acknowledgment.',
    'success'
  );

  if (currentUser) {
    await fetchProfile(currentUser.id);
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================
function setAuthMode(mode) {
  currentAuthMode = mode;
  const reqBox = document.getElementById('password-requirements');

  if (mode === 'signin') {
    document.getElementById('tab-signin').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-amber-500 text-amber-400';
    document.getElementById('tab-signup').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
    document.getElementById('auth-submit-btn').innerText = 'Sign In';
    reqBox.classList.add('hidden');
  } else {
    document.getElementById('tab-signup').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-amber-500 text-amber-400';
    document.getElementById('tab-signin').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
    document.getElementById('auth-submit-btn').innerText = 'Create Account';
    reqBox.classList.remove('hidden');
    updatePasswordRequirements(document.getElementById('auth-password').value);
  }
}

function checkPasswordStrength(pass) {
  return {
    len: pass.length >= 8,
    upper: /[A-Z]/.test(pass),
    lower: /[a-z]/.test(pass),
    num: /[0-9]/.test(pass)
  };
}

function updatePasswordRequirements(pass) {
  const res = checkPasswordStrength(pass);
  updateReqItem('req-len', res.len, 'At least 8 characters');
  updateReqItem('req-upper', res.upper, 'An uppercase letter (A-Z)');
  updateReqItem('req-lower', res.lower, 'A lowercase letter (a-z)');
  updateReqItem('req-num', res.num, 'A number (0-9)');
}

function updateReqItem(id, isValid, text) {
  const el = document.getElementById(id);
  if (isValid) {
    el.className = 'text-emerald-400 flex items-center gap-1.5';
    el.innerHTML = `<i class="fa-solid fa-check w-3"></i> ${text}`;
  } else {
    el.className = 'text-rose-400 flex items-center gap-1.5';
    el.innerHTML = `<i class="fa-solid fa-xmark w-3"></i> ${text}`;
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!email || !password) return showToast('Please fill in all fields.', 'error');

  if (currentAuthMode === 'signup') {
    const check = checkPasswordStrength(password);
    if (!check.len || !check.upper || !check.lower || !check.num) {
      return showToast('Password must be at least 8 characters long with uppercase, lowercase, and numbers.', 'error');
    }
  }

  try {
    if (supabaseClient) {
      if (currentAuthMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) return showToast(error.message, 'error');
        currentUser = data.user;
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) return showToast(error.message, 'error');
        currentUser = data.user;
      }
    } else {
      const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
      if (currentAuthMode === 'signup') {
        if (users.find(u => u.email === email)) return showToast('Account already exists for this email.', 'error');
        currentUser = { id: 'usr_' + Date.now(), email };
        users.push({ ...currentUser, password });
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      } else {
        const found = users.find(u => u.email === email && u.password === password);
        if (!found) return showToast('Invalid email or password.', 'error');
        currentUser = { id: found.id, email: found.email };
      }
    }

    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast(currentAuthMode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!', 'success');
    await proceedAfterAuth(currentUser);
  } catch (err) {
    showToast(err.message || 'An unexpected error occurred.', 'error');
  }
}

async function handleGitHubAuth() {
  if (supabaseClient) {
    const redirectUrl = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: redirectUrl }
    });
    if (error) showToast(error.message, 'error');
  } else {
    currentUser = { id: 'usr_github_' + Date.now(), email: 'github_user@petcare.com' };
    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast('Signed in with GitHub!', 'success');
    await proceedAfterAuth(currentUser);
  }
}

// ============================================================================
// PROFILE FETCHING & ROLE SCREEN ROUTING
// ============================================================================
function getCurrentRole() {
  return currentProfile?.role || 'user';
}

async function fetchProfile(userId) {
  let profile = null;
  if (supabaseClient) {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle();
    profile = data;
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    profile = profiles[userId];
  }

  const githubUsername = currentUser?.user_metadata?.user_name ||
                         currentUser?.user_metadata?.preferred_username ||
                         (currentUser?.email ? currentUser.email.split('@')[0] : null);

  if (!profile && githubUsername) {
    // Enforce RLS insert rule: role = 'user', is_banned = false
    profile = {
      id: userId,
      username: githubUsername,
      role: 'user',
      is_banned: false,
      created_at: new Date().toISOString()
    };
    if (supabaseClient) {
      await supabaseClient.from('profiles').upsert(profile);
    } else {
      const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
      profiles[userId] = profile;
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    }
  }

  if (!profile || !profile.username) {
    if (githubUsername) {
      document.getElementById('input-username').value = githubUsername;
    }
    showScreen('username');
    return;
  }

  currentProfile = profile;
  await loadAppSettings();
  configureRoleWorkspace(profile);
}

function configureRoleWorkspace(profile) {
  const role = profile.role || 'user';

  // Update Header User & Role Badge
  document.getElementById('nav-username').innerText = `@${profile.username}`;
  document.getElementById('nav-user-bar').classList.remove('hidden');

  const badge = document.getElementById('nav-role-badge');
  badge.innerText = role;
  if (role === 'admin') {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-rose-950/90 text-rose-300 border-rose-600/60';
  } else if (role === 'moderator') {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-sky-950/90 text-sky-300 border-sky-600/60';
  } else {
    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-950/80 text-amber-300 border-amber-700/50';
  }

  // 1. Check if User is Banned (SQL: is_banned = true)
  if (profile.is_banned) {
    document.getElementById('banned-username').innerText = `@${profile.username}`;
    document.getElementById('banned-meta').innerText = profile.banned_at
      ? `Suspended on: ${new Date(profile.banned_at).toLocaleString()}`
      : 'Status: Banned';
    showScreen('banned');
    return;
  }

  // 2. Check Maintenance Mode (Admin bypasses maintenance mode)
  if (appSettings.maintenance_mode && role !== 'admin') {
    showScreen('maintenance');
    return;
  }

  // 3. Configure Role-Specific Navigation Tabs
  const modTabBtn = document.getElementById('tab-nav-moderator');
  const adminTabBtn = document.getElementById('tab-nav-admin');

  if (role === 'moderator' || role === 'admin') {
    modTabBtn.classList.remove('hidden');
  } else {
    modTabBtn.classList.add('hidden');
  }

  if (role === 'admin') {
    adminTabBtn.classList.remove('hidden');
  } else {
    adminTabBtn.classList.add('hidden');
  }

  showScreen('app');
  switchAppTab('log');
  renderPosts();

  if (role === 'moderator' || role === 'admin') {
    refreshModerationData();
  }
  if (role === 'admin') {
    refreshAdminData();
  }
}

async function handleUsernameSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('input-username').value.trim();
  if (!username) return;

  currentProfile = {
    id: currentUser.id,
    username,
    role: 'user',
    is_banned: false,
    created_at: new Date().toISOString()
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('profiles').upsert(currentProfile);
    if (error) return showToast(error.message, 'error');
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    profiles[currentUser.id] = currentProfile;
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
  }

  showToast('Username configured!', 'success');
  await loadAppSettings();
  configureRoleWorkspace(currentProfile);
}

function handleSignOut() {
  if (supabaseClient) supabaseClient.auth.signOut();
  localStorage.removeItem('marblevet_session');
  currentUser = null;
  currentProfile = null;
  document.getElementById('nav-user-bar').classList.add('hidden');
  showScreen('auth');
  showToast('Signed out successfully.', 'info');
}

async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById('new-password').value;
  const check = checkPasswordStrength(newPass);

  if (!check.len || !check.upper || !check.lower || !check.num) {
    return showToast('Password must be at least 8 characters long with uppercase, lowercase, and numbers.', 'error');
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) return showToast(error.message, 'error');
  }
  showToast('Password updated!', 'success');
  document.getElementById('change-pass-form').reset();
  showScreen('app');
}

function switchAppTab(tab) {
  const role = getCurrentRole();
  if (tab === 'moderator' && role !== 'moderator' && role !== 'admin') return;
  if (tab === 'admin' && role !== 'admin') return;

  ['tab-nav-log', 'tab-nav-community', 'tab-nav-moderator', 'tab-nav-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  ['view-health-log', 'view-community', 'view-moderator', 'view-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  if (tab === 'log') {
    document.getElementById('tab-nav-log').classList.add('active');
    document.getElementById('view-health-log').classList.remove('hidden');
  } else if (tab === 'community') {
    document.getElementById('tab-nav-community').classList.add('active');
    document.getElementById('view-community').classList.remove('hidden');
  } else if (tab === 'moderator') {
    document.getElementById('tab-nav-moderator').classList.add('active');
    document.getElementById('view-moderator').classList.remove('hidden');
    refreshModerationData();
  } else if (tab === 'admin') {
    document.getElementById('tab-nav-admin').classList.add('active');
    document.getElementById('view-admin').classList.remove('hidden');
    refreshAdminData();
  }
}

function switchModSubtab(sub) {
  const btnPosts = document.getElementById('mod-subtab-posts');
  const btnUsers = document.getElementById('mod-subtab-users');
  const panelPosts = document.getElementById('mod-panel-posts');
  const panelUsers = document.getElementById('mod-panel-users');

  if (sub === 'posts') {
    btnPosts.className = 'px-3.5 py-1.5 rounded-lg bg-sky-600 text-stone-950 font-bold text-xs';
    btnUsers.className = 'px-3.5 py-1.5 rounded-lg bg-stone-900 text-stone-300 border border-stone-800 hover:border-sky-500 text-xs font-semibold';
    panelPosts.classList.remove('hidden');
    panelUsers.classList.add('hidden');
  } else {
    btnUsers.className = 'px-3.5 py-1.5 rounded-lg bg-sky-600 text-stone-950 font-bold text-xs';
    btnPosts.className = 'px-3.5 py-1.5 rounded-lg bg-stone-900 text-stone-300 border border-stone-800 hover:border-sky-500 text-xs font-semibold';
    panelUsers.classList.remove('hidden');
    panelPosts.classList.add('hidden');
  }
}

function switchAdminSubtab(sub) {
  const tabs = {
    settings: [document.getElementById('admin-subtab-settings'), document.getElementById('admin-panel-settings')],
    users: [document.getElementById('admin-subtab-users'), document.getElementById('admin-panel-users')],
    posts: [document.getElementById('admin-subtab-posts'), document.getElementById('admin-panel-posts')]
  };

  Object.entries(tabs).forEach(([key, [btn, panel]]) => {
    if (key === sub) {
      btn.className = 'px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs';
      panel.classList.remove('hidden');
    } else {
      btn.className = 'px-3.5 py-1.5 rounded-lg bg-stone-900 text-stone-300 border border-stone-800 hover:border-rose-500 text-xs font-semibold';
      panel.classList.add('hidden');
    }
  });
}

// ============================================================================
// FILE UPLOADS & POSTS (USER VIEW)
// ============================================================================
async function uploadFileToStorage(file) {
  if (!supabaseClient) return await readFileAsDataURL(file);

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { data, error } = await supabaseClient.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: publicUrlData } = supabaseClient.storage
    .from(STORAGE_BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

async function handleCreatePost(e) {
  e.preventDefault();
  if (currentProfile?.is_banned) {
    return showToast('Banned accounts cannot create posts.', 'error');
  }

  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  let visibility = document.getElementById('post-visibility').value;
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-file');

  if (visibility === 'public' && appSettings.allow_public_posts === false && getCurrentRole() !== 'admin') {
    return showToast('Public community posts are currently disabled by the Admin.', 'error');
  }

  let file_url = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const maxBytes = (Number(appSettings.max_upload_mb) || 50) * 1024 * 1024;

    if (file.size > maxBytes) {
      return showToast(`File size exceeds the ${appSettings.max_upload_mb}MB limit.`, 'error');
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type) || file.type === '';

    if (!isExtensionValid || !isMimeValid) {
      return showToast('Invalid file format. Accepted: Images, Videos, Audio, PDF, DOCX, ZIP.', 'error');
    }

    try {
      showToast('Uploading attachment...', 'info');
      file_url = await uploadFileToStorage(file);
    } catch (err) {
      return showToast(err.message, 'error');
    }
  }

  const newPost = {
    user_id: currentUser.id,
    author_username: currentProfile?.username || currentUser?.email?.split('@')[0] || 'anonymous',
    title,
    content,
    category,
    visibility,
    status: 'active',
    file_url,
    created_at: new Date().toISOString()
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('posts').insert([newPost]).select();
    if (error) return showToast(error.message, 'error');
  } else {
    newPost.id = 'post_' + Date.now();
    const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    posts.unshift(newPost);
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  }

  document.getElementById('modal-post').classList.add('hidden');
  document.getElementById('post-form').reset();
  showToast('Entry created!', 'success');
  await renderPosts();
  if (getCurrentRole() !== 'user') await refreshModerationData();
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

async function getPosts() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts from Supabase:', error);
      return [];
    }
    return data || [];
  }
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
}

async function renderPosts() {
  loadedPosts = await getPosts();
  const logGrid = document.getElementById('log-grid');
  const communityFeed = document.getElementById('community-feed');
  const searchQuery = document.getElementById('search-input').value.toLowerCase();

  // 1. Private Health Log (Strictly user's own private posts)
  const privatePosts = loadedPosts.filter(p => p.visibility === 'private' && p.user_id === currentUser?.id);
  if (privatePosts.length === 0) {
    logGrid.innerHTML = `
      <div class="col-span-full clean-card p-8 text-center text-stone-400">
        <i class="fa-solid fa-notes-medical text-3xl text-amber-500/50 mb-2"></i>
        <p class="text-sm">No private health logs stored yet.</p>
      </div>`;
  } else {
    logGrid.innerHTML = privatePosts.map(p => `
      <div onclick="openPostModal('${p.id}')" class="clean-card p-4 flex flex-col justify-between cursor-pointer hover:border-amber-500 transition-all group">
        <div>
          <div class="flex justify-between items-center text-xs mb-3">
            <span class="font-bold text-amber-400">@${escapeHtml(p.author_username || 'anonymous')}</span>
            <span class="text-[10px] text-stone-500">${new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          ${renderThumbnailBox(p.file_url)}
          <h3 class="font-bold text-amber-100 text-base mb-1.5 mt-3 group-hover:text-amber-400 transition-colors">${escapeHtml(p.title)}</h3>
          <div class="inline-flex items-center gap-1.5 text-xs text-amber-500/80 mt-1">
            <i class="fa-solid fa-up-right-and-down-left-from-center text-[10px]"></i>
            <span class="text-[11px] font-medium">Click box to reveal details</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 2. Community Hub (Shows active public posts)
  let publicPosts = loadedPosts.filter(p => p.visibility === 'public' && (p.status || 'active') === 'active');
  if (activeCategory !== 'all') {
    publicPosts = publicPosts.filter(p => p.category === activeCategory);
  }
  if (searchQuery) {
    publicPosts = publicPosts.filter(p => p.title.toLowerCase().includes(searchQuery) || p.content.toLowerCase().includes(searchQuery));
  }

  if (publicPosts.length === 0) {
    communityFeed.innerHTML = `
      <div class="col-span-full clean-card p-8 text-center text-stone-400">
        <i class="fa-solid fa-comments text-3xl text-amber-500/50 mb-2"></i>
        <p class="text-sm">No active community questions found.</p>
      </div>`;
  } else {
    communityFeed.innerHTML = publicPosts.map(p => `
      <div onclick="openPostModal('${p.id}')" class="clean-card p-4 flex flex-col justify-between cursor-pointer hover:border-amber-500 transition-all group">
        <div>
          <div class="flex justify-between items-center text-xs mb-3">
            <div class="flex items-center gap-2">
              <span class="font-bold text-amber-400">@${escapeHtml(p.author_username || 'anonymous')}</span>
              <span class="text-stone-600">•</span>
              <span class="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase text-amber-400 font-semibold">${escapeHtml(p.category)}</span>
            </div>
            <span class="text-[10px] text-stone-500">${new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          ${renderThumbnailBox(p.file_url)}
          <h3 class="font-bold text-amber-100 text-base mb-1.5 mt-3 group-hover:text-amber-400 transition-colors">${escapeHtml(p.title)}</h3>
          <div class="inline-flex items-center gap-1.5 text-xs text-amber-500/80 mt-1">
            <i class="fa-solid fa-up-right-and-down-left-from-center text-[10px]"></i>
            <span class="text-[11px] font-medium">Click box to reveal details</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// ============================================================================
// POST DETAIL MODAL & ROLE-AWARE MODERATION / DELETION
// ============================================================================
async function openPostModal(postId) {
  const post = loadedPosts.find(p => String(p.id) === String(postId));
  if (!post) return;

  const role = getCurrentRole();
  const isOwner = post.user_id === currentUser?.id;
  const isModOrAdmin = role === 'moderator' || role === 'admin';
  const status = post.status || 'active';

  activeModalPostId = postId;
  document.getElementById('view-post-title').innerText = post.title;
  document.getElementById('view-post-author').innerText = `@${post.author_username || 'anonymous'}`;
  document.getElementById('view-post-category').innerText = post.category;
  document.getElementById('view-post-date').innerText = new Date(post.created_at).toLocaleString();
  document.getElementById('view-post-content').innerText = post.content;

  // Status Badge
  const statusBadge = document.getElementById('view-post-status-badge');
  statusBadge.innerText = status.replace('_', ' ');
  statusBadge.className = getStatusBadgeClass(status);

  // Delete Button Visibility (Owners, Mods on public posts, Admin on all)
  const delBtn = document.getElementById('btn-delete-post-modal');
  if (isOwner || (role === 'moderator' && post.visibility === 'public') || role === 'admin') {
    delBtn.classList.remove('hidden');
  } else {
    delBtn.classList.add('hidden');
  }

  // Moderator/Admin Review Panel inside Modal
  const modControls = document.getElementById('view-post-mod-controls');
  if ((role === 'moderator' && post.visibility === 'public') || role === 'admin') {
    modControls.classList.remove('hidden');
    document.getElementById('modal-mod-status').value = status;
    document.getElementById('modal-mod-notes').value = post.review_notes || '';
  } else {
    modControls.classList.add('hidden');
  }

  // Media
  const mediaContainer = document.getElementById('view-post-media-container');
  const mediaContent = document.getElementById('view-post-media-content');
  if (post.file_url) {
    mediaContent.innerHTML = renderCenteredMedia(post.file_url);
    mediaContainer.classList.remove('hidden');
  } else {
    mediaContainer.classList.add('hidden');
    mediaContent.innerHTML = '';
  }

  // Comments
  const commentsSection = document.getElementById('view-post-comments-section');
  if (post.visibility === 'private') {
    commentsSection.classList.add('hidden');
  } else {
    commentsSection.classList.remove('hidden');
    await renderComments(postId);
  }

  document.getElementById('modal-view-post').classList.remove('hidden');
}

async function handleSaveModalModeration() {
  if (!activeModalPostId) return;
  const status = document.getElementById('modal-mod-status').value;
  const review_notes = document.getElementById('modal-mod-notes').value.trim();

  await updatePostModerationStatus(activeModalPostId, status, review_notes);
  document.getElementById('modal-view-post').classList.add('hidden');
}

async function updatePostModerationStatus(postId, status, reviewNotes) {
  const role = getCurrentRole();
  if (role !== 'moderator' && role !== 'admin') {
    return showToast('Insufficient permissions.', 'error');
  }

  const updates = {
    status,
    reviewed_by: currentUser.id,
    review_notes: reviewNotes || null
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('posts').update(updates).eq('id', postId);
    if (error) return showToast(error.message, 'error');
  } else {
    const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    const idx = posts.findIndex(p => String(p.id) === String(postId));
    if (idx !== -1) {
      posts[idx] = { ...posts[idx], ...updates };
      localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
    }
  }

  showToast(`Post status updated to "${status}".`, 'success');
  await renderPosts();
  if (role === 'moderator' || role === 'admin') await refreshModerationData();
  if (role === 'admin') await refreshAdminData();
}

async function handleDeletePost(postId) {
  if (!confirm('Are you sure you want to permanently delete this post?')) return;

  if (supabaseClient) {
    const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
    if (error) return showToast(error.message, 'error');
  } else {
    let posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    posts = posts.filter(p => String(p.id) !== String(postId));
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  }

  document.getElementById('modal-view-post').classList.add('hidden');
  showToast('Post permanently deleted.', 'success');
  await renderPosts();
  if (getCurrentRole() !== 'user') await refreshModerationData();
  if (getCurrentRole() === 'admin') await refreshAdminData();
}

// ============================================================================
// COMMENTS (WITH ROLE-BASED DELETE)
// ============================================================================
async function getComments(postId) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data || [];
  }

  const allComments = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COMMENTS_KEY) || '[]');
  return allComments.filter(c => String(c.post_id) === String(postId));
}

async function renderComments(postId) {
  const commentsList = document.getElementById('comments-list');
  const commentsCount = document.getElementById('comments-count');
  commentsList.innerHTML = '<p class="text-xs text-stone-500 italic">Loading replies...</p>';

  const comments = await getComments(postId);
  const role = getCurrentRole();
  commentsCount.innerText = comments.length;

  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="text-xs text-stone-500 italic">No replies yet. Be the first to share advice!</p>';
    return;
  }

  commentsList.innerHTML = comments.map(c => {
    const canDelete = c.user_id === currentUser?.id || role === 'moderator' || role === 'admin';
    return `
      <div class="bg-stone-900/70 border border-stone-800 rounded-lg p-3 space-y-1">
        <div class="flex justify-between items-center text-[11px]">
          <span class="font-bold text-amber-400">@${escapeHtml(c.author_username || 'anonymous')}</span>
          <div class="flex items-center gap-2">
            <span class="text-stone-500 text-[10px]">${new Date(c.created_at).toLocaleString()}</span>
            ${canDelete ? `
              <button type="button" onclick="handleDeleteComment('${c.id}')" class="text-rose-400 hover:text-rose-300 text-[10px]" title="Delete reply">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <p class="text-xs text-stone-200 leading-normal whitespace-pre-wrap">${escapeHtml(c.content)}</p>
      </div>
    `;
  }).join('');
}

async function handleDeleteComment(commentId) {
  if (supabaseClient) {
    const { error } = await supabaseClient.from('comments').delete().eq('id', commentId);
    if (error) return showToast(error.message, 'error');
  } else {
    let comments = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COMMENTS_KEY) || '[]');
    comments = comments.filter(c => String(c.id) !== String(commentId));
    localStorage.setItem(LOCAL_STORAGE_COMMENTS_KEY, JSON.stringify(comments));
  }

  showToast('Reply deleted.', 'success');
  if (activeModalPostId) await renderComments(activeModalPostId);
}

async function handleCreateComment(e) {
  e.preventDefault();
  if (currentProfile?.is_banned) {
    return showToast('Banned accounts cannot post replies.', 'error');
  }

  const commentInput = document.getElementById('comment-input');
  const content = commentInput.value.trim();
  if (!content || !activeModalPostId) return;

  const newComment = {
    post_id: String(activeModalPostId),
    user_id: currentUser.id,
    author_username: currentProfile?.username || currentUser?.email?.split('@')[0] || 'anonymous',
    content,
    created_at: new Date().toISOString()
  };

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('comments').insert([newComment]);
      if (error) return showToast(`Error: ${error.message}`, 'error');
    } else {
      newComment.id = 'comment_' + Date.now();
      const comments = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COMMENTS_KEY) || '[]');
      comments.push(newComment);
      localStorage.setItem(LOCAL_STORAGE_COMMENTS_KEY, JSON.stringify(comments));
    }

    commentInput.value = '';
    showToast('Reply submitted!', 'success');
    await renderComments(activeModalPostId);
  } catch (err) {
    showToast(err.message || 'Failed to post reply.', 'error');
  }
}

// ============================================================================
// MODERATOR WORKSPACE DATA & ACTIONS
// ============================================================================
async function fetchAllProfiles() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) allProfiles = data || [];
  } else {
    const map = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    allProfiles = Object.values(map);
  }
  return allProfiles;
}

async function refreshModerationData() {
  loadedPosts = await getPosts();
  await fetchAllProfiles();

  const reviewCount = loadedPosts.filter(p => p.visibility === 'public' && p.status === 'under_review').length;
  const bannedCount = allProfiles.filter(u => u.is_banned).length;

  document.getElementById('mod-stat-review').innerText = `${reviewCount} Under Review`;
  document.getElementById('mod-stat-banned').innerText = `${bannedCount} Banned Users`;

  renderModeratorQueue();
  renderModeratorUsers();
}

function renderModeratorQueue() {
  const container = document.getElementById('mod-posts-list');
  let publicPosts = loadedPosts.filter(p => p.visibility === 'public');

  if (modStatusFilter !== 'all') {
    publicPosts = publicPosts.filter(p => (p.status || 'active') === modStatusFilter);
  }

  if (publicPosts.length === 0) {
    container.innerHTML = `<div class="clean-card p-6 text-center text-xs text-stone-400">No public posts match this filter.</div>`;
    return;
  }

  container.innerHTML = publicPosts.map(p => {
    const status = p.status || 'active';
    return `
      <div class="clean-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1 flex-1">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="${getStatusBadgeClass(status)} text-[10px] font-bold uppercase px-2 py-0.5 rounded border">${status.replace('_', ' ')}</span>
            <span class="font-bold text-amber-300">@${escapeHtml(p.author_username || 'anonymous')}</span>
            <span class="text-stone-500">• ${escapeHtml(p.category)} • ${new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          <h4 class="font-bold text-amber-100 text-sm">${escapeHtml(p.title)}</h4>
          <p class="text-xs text-stone-400 line-clamp-2">${escapeHtml(p.content)}</p>
          ${p.review_notes ? `<p class="text-[11px] text-sky-300 italic">Note: ${escapeHtml(p.review_notes)}</p>` : ''}
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onclick="openPostModal('${p.id}')" class="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold">
            Inspect / Review
          </button>
          ${status !== 'active' ? `
            <button type="button" onclick="updatePostModerationStatus('${p.id}', 'active', 'Approved by moderator')" class="px-3 py-1.5 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold">
              Approve
            </button>
          ` : ''}
          ${status !== 'under_review' ? `
            <button type="button" onclick="updatePostModerationStatus('${p.id}', 'under_review', 'Flagged for review')" class="px-3 py-1.5 rounded bg-amber-600/80 hover:bg-amber-500 text-stone-950 text-xs font-bold">
              Flag Review
            </button>
          ` : ''}
          ${status !== 'removed' ? `
            <button type="button" onclick="updatePostModerationStatus('${p.id}', 'removed', 'Hidden by moderator')" class="px-3 py-1.5 rounded bg-rose-800/80 hover:bg-rose-700 text-white text-xs font-semibold">
              Hide / Remove
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderModeratorUsers() {
  const container = document.getElementById('mod-users-list');
  if (allProfiles.length === 0) {
    container.innerHTML = `<div class="col-span-full clean-card p-6 text-center text-xs text-stone-400">No user profiles found.</div>`;
    return;
  }

  container.innerHTML = allProfiles.map(u => {
    const role = u.role || 'user';
    const isSelf = u.id === currentUser?.id;
    // SQL Trigger Rule: Moderators can ONLY ban/unban 'user' accounts
    const canBan = !isSelf && role === 'user';

    return `
      <div class="clean-card p-4 flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-amber-100">@${escapeHtml(u.username)}</span>
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">${role}</span>
            ${u.is_banned ? `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700">Banned</span>` : ''}
          </div>
          <p class="text-[11px] text-stone-500 mt-1">Joined: ${u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</p>
        </div>

        <div>
          ${canBan ? `
            <button type="button" onclick="toggleUserBan('${u.id}', ${!u.is_banned})" class="px-3 py-1.5 rounded text-xs font-bold ${u.is_banned ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950' : 'bg-rose-700 hover:bg-rose-600 text-white'}">
              ${u.is_banned ? 'Unban User' : 'Ban User'}
            </button>
          ` : `<span class="text-[11px] text-stone-500 italic">${isSelf ? 'You' : 'Protected Role'}</span>`}
        </div>
      </div>
    `;
  }).join('');
}

async function toggleUserBan(targetUserId, banState) {
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ is_banned: banState })
      .eq('id', targetUserId);

    if (error) return showToast(error.message, 'error');
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    if (profiles[targetUserId]) {
      profiles[targetUserId].is_banned = banState;
      profiles[targetUserId].banned_at = banState ? new Date().toISOString() : null;
      profiles[targetUserId].banned_by = banState ? currentUser.id : null;
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    }
  }

  showToast(banState ? 'User has been banned.' : 'User ban lifted.', 'success');
  await refreshModerationData();
  if (getCurrentRole() === 'admin') await refreshAdminData();
}

// ============================================================================
// ADMIN CONSOLE DATA & GOVERNANCE ACTIONS (SINGLE ADMIN SLOT)
// ============================================================================
async function refreshAdminData() {
  if (getCurrentRole() !== 'admin') return;
  await loadAppSettings();
  await fetchAllProfiles();
  loadedPosts = await getPosts();

  renderAdminUsers();
  renderAdminPosts();
}

function renderAdminUsers() {
  const container = document.getElementById('admin-users-list');
  if (allProfiles.length === 0) {
    container.innerHTML = `<div class="clean-card p-6 text-center text-xs text-stone-400">No profiles found.</div>`;
    return;
  }

  container.innerHTML = allProfiles.map(u => {
    const role = u.role || 'user';
    const isSelf = u.id === currentUser?.id;

    return `
      <div class="clean-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-sm text-amber-100">@${escapeHtml(u.username)}</span>
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
              role === 'admin' ? 'bg-rose-950 text-rose-300 border-rose-700' :
              role === 'moderator' ? 'bg-sky-950 text-sky-300 border-sky-700' :
              'bg-stone-800 text-stone-300 border-stone-700'
            }">${role}</span>
            ${u.is_banned ? `<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-900/90 text-rose-200 border border-rose-600">Banned</span>` : ''}
            ${isSelf ? `<span class="text-[10px] text-amber-400 font-semibold">(Current Admin)</span>` : ''}
          </div>
          <p class="text-[11px] text-stone-500 mt-1">ID: ${escapeHtml(u.id)}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          ${!isSelf ? `
            <!-- Role Assignment (user <-> moderator) -->
            <select onchange="handleAdminChangeRole('${u.id}', this.value)" class="bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-200">
              <option value="user" ${role === 'user' ? 'selected' : ''}>Role: User</option>
              <option value="moderator" ${role === 'moderator' ? 'selected' : ''}>Role: Moderator</option>
            </select>

            <!-- Transfer Single Admin Slot -->
            <button type="button" onclick="handleTransferAdminSlot('${u.id}', '${escapeHtml(u.username)}')" class="px-3 py-1.5 rounded bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-xs font-semibold" title="Transfer single admin slot">
              <i class="fa-solid fa-crown mr-1"></i> Make Admin
            </button>

            <!-- Ban / Unban -->
            <button type="button" onclick="toggleUserBan('${u.id}', ${!u.is_banned})" class="px-3 py-1.5 rounded text-xs font-bold ${u.is_banned ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950' : 'bg-rose-700 hover:bg-rose-600 text-white'}">
              ${u.is_banned ? 'Unban' : 'Ban'}
            </button>

            <!-- Delete Profile -->
            <button type="button" onclick="handleAdminDeleteProfile('${u.id}', '${escapeHtml(u.username)}')" class="px-2.5 py-1.5 rounded bg-stone-900 hover:bg-rose-950 text-rose-400 border border-stone-700 hover:border-rose-700 text-xs" title="Delete Profile">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : `
            <span class="text-xs text-stone-400 italic">Transfer Admin slot to another user before demoting self.</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function handleAdminChangeRole(targetUserId, newRole) {
  if (getCurrentRole() !== 'admin') return;

  if (supabaseClient) {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);
    if (error) {
      await refreshAdminData();
      return showToast(error.message, 'error');
    }
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    if (profiles[targetUserId]) {
      profiles[targetUserId].role = newRole;
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    }
  }

  showToast(`User role updated to ${newRole}.`, 'success');
  await refreshAdminData();
}

async function handleTransferAdminSlot(targetUserId, targetUsername) {
  if (getCurrentRole() !== 'admin') return;
  const confirmed = confirm(
    `WARNING: There is only ONE Admin slot in MarbleVet Journal.\n\nTransferring Admin to @${targetUsername} will demote your own account to 'moderator'. Continue?`
  );
  if (!confirmed) return;

  if (supabaseClient) {
    // Step 1: Demote current admin to moderator first so single_admin_slot_idx unique index stays valid
    const { error: demoteErr } = await supabaseClient
      .from('profiles')
      .update({ role: 'moderator' })
      .eq('id', currentUser.id);
    if (demoteErr) return showToast(demoteErr.message, 'error');

    // Step 2: Promote target user into the single admin slot
    const { error: promoteErr } = await supabaseClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', targetUserId);
    if (promoteErr) return showToast(promoteErr.message, 'error');
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    if (profiles[currentUser.id]) profiles[currentUser.id].role = 'moderator';
    if (profiles[targetUserId]) profiles[targetUserId].role = 'admin';
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
  }

  showToast(`Admin slot transferred to @${targetUsername}.`, 'success');
  await fetchProfile(currentUser.id);
}

async function handleAdminDeleteProfile(targetUserId, targetUsername) {
  if (!confirm(`Permanently delete profile @${targetUsername}? This cannot be undone.`)) return;

  if (supabaseClient) {
    const { error } = await supabaseClient.from('profiles').delete().eq('id', targetUserId);
    if (error) return showToast(error.message, 'error');
  } else {
    const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    delete profiles[targetUserId];
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
  }

  showToast(`Profile @${targetUsername} deleted.`, 'success');
  await refreshAdminData();
}

function renderAdminPosts() {
  const container = document.getElementById('admin-posts-list');
  if (loadedPosts.length === 0) {
    container.innerHTML = `<div class="clean-card p-6 text-center text-xs text-stone-400">No posts in database.</div>`;
    return;
  }

  container.innerHTML = loadedPosts.map(p => {
    const status = p.status || 'active';
    return `
      <div class="clean-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.visibility === 'private' ? 'bg-purple-950 text-purple-300 border border-purple-700' : 'bg-amber-950 text-amber-300 border border-amber-700'}">
              ${escapeHtml(p.visibility)}
            </span>
            <span class="${getStatusBadgeClass(status)} text-[10px] font-bold uppercase px-2 py-0.5 rounded border">${status.replace('_', ' ')}</span>
            <span class="font-bold text-amber-300">@${escapeHtml(p.author_username || 'anonymous')}</span>
            <span class="text-stone-500">• ${new Date(p.created_at).toLocaleString()}</span>
          </div>
          <h4 class="font-bold text-amber-100 text-sm">${escapeHtml(p.title)}</h4>
          <p class="text-xs text-stone-400 line-clamp-1">${escapeHtml(p.content)}</p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" onclick="openPostModal('${p.id}')" class="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold">
            Open
          </button>
          <button type="button" onclick="handleDeletePost('${p.id}')" class="px-3 py-1.5 rounded bg-rose-800 hover:bg-rose-700 text-white text-xs font-semibold">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// MEDIA & UI HELPERS
// ============================================================================
function getStatusBadgeClass(status) {
  if (status === 'under_review') return 'bg-amber-950 text-amber-300 border-amber-600/60';
  if (status === 'removed') return 'bg-rose-950 text-rose-300 border-rose-600/60';
  return 'bg-emerald-950 text-emerald-300 border-emerald-600/60';
}

function getFileType(url) {
  if (!url) return 'document';
  const clean = url.split('?')[0].toLowerCase();
  if (clean.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif)$/.test(clean)) return 'image';
  if (clean.startsWith('data:video') || /\.(mp4|mov)$/.test(clean)) return 'video';
  if (clean.startsWith('data:audio') || /\.(mp3|m4a|wav)$/.test(clean)) return 'audio';
  return 'document';
}

function handleImageError(img) {
  img.parentElement.innerHTML = `
    <div class="w-full h-full flex flex-col items-center justify-center text-stone-500 gap-1">
      <i class="fa-regular fa-image text-xl"></i>
      <span class="text-[10px]">Image Unavailable</span>
    </div>`;
}

function renderThumbnailBox(url) {
  if (!url) {
    return `
      <div class="w-full h-36 rounded-lg bg-stone-900/60 border border-stone-800 flex flex-col items-center justify-center text-stone-600 gap-1.5">
        <i class="fa-regular fa-file text-2xl"></i>
        <span class="text-[11px]">No Attachment</span>
      </div>`;
  }

  const type = getFileType(url);
  if (type === 'image') {
    return `
      <div class="w-full h-36 rounded-lg bg-stone-950 overflow-hidden border border-stone-800 relative">
        <img src="${url}" onerror="handleImageError(this)" class="w-full h-full object-cover" alt="Upload thumbnail" />
      </div>`;
  }
  if (type === 'video') {
    return `
      <div class="w-full h-36 rounded-lg bg-stone-950 flex flex-col items-center justify-center border border-stone-800 relative gap-2 text-amber-400">
        <i class="fa-solid fa-circle-play text-3xl"></i>
        <span class="text-xs text-stone-400 font-medium">Video Attached</span>
      </div>`;
  }
  if (type === 'audio') {
    return `
      <div class="w-full h-36 rounded-lg bg-stone-950 flex flex-col items-center justify-center border border-stone-800 text-amber-400 gap-2">
        <i class="fa-solid fa-file-audio text-3xl"></i>
        <span class="text-xs text-stone-400 font-medium">Audio Recording</span>
      </div>`;
  }
  return `
    <div class="w-full h-36 rounded-lg bg-stone-950 flex flex-col items-center justify-center border border-stone-800 text-amber-400 gap-2">
      <i class="fa-solid fa-file-lines text-3xl"></i>
      <span class="text-xs text-stone-400 font-medium">Document Attached</span>
    </div>`;
}

function renderCenteredMedia(url) {
  const type = getFileType(url);
  if (type === 'image') {
    return `<img src="${url}" onerror="handleImageError(this)" class="max-h-[60vh] max-w-full rounded-lg object-contain shadow-2xl border border-stone-800" alt="Post attachment" />`;
  }
  if (type === 'video') {
    return `<video src="${url}" controls class="max-h-[60vh] max-w-full rounded-lg shadow-2xl border border-stone-800"></video>`;
  }
  if (type === 'audio') {
    return `<audio src="${url}" controls class="w-full max-w-md my-4"></audio>`;
  }
  return `<a href="${url}" download target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="px-5 py-3 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/40 rounded-xl inline-flex items-center gap-2.5 text-sm font-semibold transition-all"><i class="fa-solid fa-file-arrow-down text-base"></i> View / Download Full Attachment</a>`;
}

function showToast(msg, type = 'info') {
  const toastMsg = document.getElementById('toast-message');
  const toast = document.getElementById('toast');
  toastMsg.innerText = msg;
  toast.className = `fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-3 transition-all duration-300 ${
    type === 'error' ? 'bg-rose-900 text-rose-100 border border-rose-700' :
    type === 'success' ? 'bg-emerald-900 text-emerald-100 border border-emerald-700' :
    'bg-stone-800 text-amber-300 border border-amber-900'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}