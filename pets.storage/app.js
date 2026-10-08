// app.js - Fixed Application Logic & Authentication

let currentUser = null;
let currentProfile = null;
let currentAuthMode = 'signin';
let activeCategory = 'all';

const LOCAL_STORAGE_USERS_KEY = 'marblevet_users_db';
const LOCAL_STORAGE_POSTS_KEY = 'marblevet_posts_db';
const LOCAL_STORAGE_REPLIES_KEY = 'marblevet_replies_db';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  const savedUser = localStorage.getItem('marblevet_session');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    fetchProfile(currentUser.id);
  } else {
    showScreen('auth');
  }
}

function showScreen(screen) {
  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('screen-username').classList.add('hidden');
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-settings').classList.add('hidden');

  if (screen === 'auth') document.getElementById('screen-auth').classList.remove('hidden');
  if (screen === 'username') document.getElementById('screen-username').classList.remove('hidden');
  if (screen === 'app') document.getElementById('screen-app').classList.remove('hidden');
  if (screen === 'settings') document.getElementById('screen-settings').classList.remove('hidden');
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

  document.getElementById('tab-nav-log').addEventListener('click', () => switchAppTab('log'));
  document.getElementById('tab-nav-community').addEventListener('click', () => switchAppTab('community'));

  document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings'));
  document.getElementById('btn-close-settings').addEventListener('click', () => showScreen('app'));
  document.getElementById('btn-signout').addEventListener('click', handleSignOut);

  document.getElementById('btn-create-post').addEventListener('click', () => document.getElementById('modal-post').classList.remove('hidden'));
  document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('modal-post').classList.add('hidden'));
  document.getElementById('btn-cancel-post').addEventListener('click', () => document.getElementById('modal-post').classList.add('hidden'));

  document.getElementById('post-form').addEventListener('submit', handleCreatePost);
  document.getElementById('change-pass-form').addEventListener('submit', handleChangePassword);

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

  document.getElementById('search-input').addEventListener('input', renderPosts);
}

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

  if (!email || !password) {
    return showToast('Please fill in all fields.', 'error');
  }

  if (currentAuthMode === 'signup') {
    const check = checkPasswordStrength(password);
    if (!check.len || !check.upper || !check.lower || !check.num) {
      return showToast('Password must be at least 8 characters long with uppercase, lowercase, and numbers.', 'error');
    }
  }

  try {
    if (window.supabase && supabase) {
      if (currentAuthMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return showToast(error.message, 'error');
        currentUser = data.user;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return showToast(error.message, 'error');
        currentUser = data.user;
      }
    } else {
      // LocalStorage Fallback Flow
      const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
      if (currentAuthMode === 'signup') {
        if (users.find(u => u.email === email)) {
          return showToast('Account already exists for this email.', 'error');
        }
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
    fetchProfile(currentUser.id);
  } catch (err) {
    showToast(err.message || 'An unexpected error occurred.', 'error');
  }
}

function handleGitHubAuth() {
  if (window.supabase && supabase) {
    supabase.auth.signInWithOAuth({ provider: 'github' });
  } else {
    currentUser = { id: 'usr_github_' + Date.now(), email: 'github_user@petcare.com' };
    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast('Signed in with GitHub OAuth!', 'success');
    fetchProfile(currentUser.id);
  }
}

async function fetchProfile(userId) {
  let profile = null;
  if (window.supabase && supabase) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    profile = data;
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profile = profiles[userId];
  }

  if (!profile || !profile.username) {
    showScreen('username');
  } else {
    currentProfile = profile;
    document.getElementById('nav-username').innerText = `@${profile.username}`;
    document.getElementById('nav-user-bar').classList.remove('hidden');
    showScreen('app');
    renderPosts();
  }
}

async function handleUsernameSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('input-username').value.trim();
  if (!username) return;

  currentProfile = { id: currentUser.id, username, created_at: new Date().toISOString() };

  if (window.supabase && supabase) {
    await supabase.from('profiles').upsert(currentProfile);
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profiles[currentUser.id] = currentProfile;
    localStorage.setItem('marblevet_profiles', JSON.stringify(profiles));
  }

  document.getElementById('nav-username').innerText = `@${username}`;
  document.getElementById('nav-user-bar').classList.remove('hidden');
  showToast('Username configured!', 'success');
  showScreen('app');
  renderPosts();
}

function handleSignOut() {
  if (window.supabase && supabase) supabase.auth.signOut();
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

  if (window.supabase && supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return showToast(error.message, 'error');
  }
  showToast('Password updated!', 'success');
  document.getElementById('change-pass-form').reset();
  showScreen('app');
}

function switchAppTab(tab) {
  if (tab === 'log') {
    document.getElementById('tab-nav-log').classList.add('active');
    document.getElementById('tab-nav-community').classList.remove('active');
    document.getElementById('view-health-log').classList.remove('hidden');
    document.getElementById('view-community').classList.add('hidden');
  } else {
    document.getElementById('tab-nav-community').classList.add('active');
    document.getElementById('tab-nav-log').classList.remove('active');
    document.getElementById('view-community').classList.remove('hidden');
    document.getElementById('view-health-log').classList.add('hidden');
  }
}

async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const visibility = document.getElementById('post-visibility').value;
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-file');

  let file_url = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 50 * 1024 * 1024) {
      return showToast('File size exceeds 50MB limit.', 'error');
    }
    file_url = await readFileAsDataURL(file);
  }

  const newPost = {
    id: 'post_' + Date.now(),
    user_id: currentUser.id,
    author_username: currentProfile.username,
    title,
    content,
    category,
    visibility,
    file_url,
    created_at: new Date().toISOString()
  };

  if (window.supabase && supabase) {
    await supabase.from('posts').insert([newPost]);
  } else {
    const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    posts.unshift(newPost);
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  }

  document.getElementById('modal-post').classList.add('hidden');
  document.getElementById('post-form').reset();
  showToast('Entry created!', 'success');
  renderPosts();
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function getStoredPosts() {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
}

function renderPosts() {
  const posts = getStoredPosts();
  const logGrid = document.getElementById('log-grid');
  const communityFeed = document.getElementById('community-feed');
  const searchQuery = document.getElementById('search-input').value.toLowerCase();

  const privatePosts = posts.filter(p => p.visibility === 'private' && p.user_id === currentUser.id);
  if (privatePosts.length === 0) {
    logGrid.innerHTML = `
      <div class="col-span-full clean-card p-8 text-center text-stone-400">
        <i class="fa-solid fa-notes-medical text-3xl text-amber-500/50 mb-2"></i>
        <p class="text-sm">No private health logs stored yet.</p>
      </div>`;
  } else {
    logGrid.innerHTML = privatePosts.map(p => `
      <div class="clean-card p-5 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              ${escapeHtml(p.category)}
            </span>
            <span class="text-[10px] text-stone-500">${new Date(p.created_at).toLocaleDateString()}</span>
          </div>
          <h3 class="font-bold text-amber-100 text-base mb-2">${escapeHtml(p.title)}</h3>
          <p class="text-xs text-stone-300 leading-relaxed mb-4">${escapeHtml(p.content)}</p>
        </div>
        ${p.file_url ? `<div class="pt-2 border-t border-stone-800">${renderAttachment(p.file_url)}</div>` : ''}
      </div>
    `).join('');
  }

  let publicPosts = posts.filter(p => p.visibility !== 'private');
  if (activeCategory !== 'all') {
    publicPosts = publicPosts.filter(p => p.category === activeCategory);
  }
  if (searchQuery) {
    publicPosts = publicPosts.filter(p => p.title.toLowerCase().includes(searchQuery) || p.content.toLowerCase().includes(searchQuery));
  }

  if (publicPosts.length === 0) {
    communityFeed.innerHTML = `
      <div class="clean-card p-8 text-center text-stone-400">
        <i class="fa-solid fa-comments text-3xl text-amber-500/50 mb-2"></i>
        <p class="text-sm">No community questions found.</p>
      </div>`;
  } else {
    communityFeed.innerHTML = publicPosts.map(p => `
      <div class="clean-card p-6 space-y-3">
        <div class="flex justify-between items-center text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-amber-400">@${escapeHtml(p.author_username || 'anonymous')}</span>
            <span class="text-stone-500">•</span>
            <span class="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] uppercase text-stone-400 font-semibold">${escapeHtml(p.category)}</span>
          </div>
          <span class="text-stone-500 text-[11px]">${new Date(p.created_at).toLocaleString()}</span>
        </div>
        <h3 class="text-lg font-bold text-amber-100">${escapeHtml(p.title)}</h3>
        <p class="text-sm text-stone-300 leading-relaxed">${escapeHtml(p.content)}</p>
        ${p.file_url ? `<div class="pt-2">${renderAttachment(p.file_url)}</div>` : ''}
      </div>
    `).join('');
  }
}

function renderAttachment(url) {
  if (url.startsWith('data:image')) {
    return `<img src="${url}" class="max-h-48 rounded-lg object-contain bg-stone-950 border border-stone-800" />`;
  }
  return `<a href="${url}" target="_blank" class="inline-flex items-center gap-2 text-xs text-amber-400 hover:underline"><i class="fa-solid fa-paperclip"></i> View Attachment</a>`;
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