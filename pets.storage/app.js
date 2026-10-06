// app.js - Application Logic & Database Operations

// Application State
let currentUser = null;
let currentProfile = null;
let currentAuthMode = 'signin'; // 'signin' or 'signup'
let activeCategory = 'all';

// Local Storage Fallback Keys
const LOCAL_STORAGE_USERS_KEY = 'marblevet_users_db';
const LOCAL_STORAGE_POSTS_KEY = 'marblevet_posts_db';
const LOCAL_STORAGE_REPLIES_KEY = 'marblevet_replies_db';

// DOM Elements
const screenAuth = document.getElementById('screen-auth');
const screenUsername = document.getElementById('screen-username');
const screenApp = document.getElementById('screen-app');
const screenSettings = document.getElementById('screen-settings');

const navUserBar = document.getElementById('nav-user-bar');
const navUsername = document.getElementById('nav-username');

const viewHealthLog = document.getElementById('view-health-log');
const viewCommunity = document.getElementById('view-community');

const tabNavLog = document.getElementById('tab-nav-log');
const tabNavCommunity = document.getElementById('tab-nav-community');

const modalPost = document.getElementById('modal-post');
const toast = document.getElementById('toast');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

function initApp() {
  // Check for active session in LocalStorage or Supabase
  const savedUser = localStorage.getItem('marblevet_session');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    fetchProfile(currentUser.id);
  } else {
    showScreen('auth');
  }
}

// --- Navigation & Screen Manager ---
function showScreen(screen) {
  screenAuth.classList.add('hidden');
  screenUsername.classList.add('hidden');
  screenApp.classList.add('hidden');
  screenSettings.classList.add('hidden');

  if (screen === 'auth') screenAuth.classList.remove('hidden');
  if (screen === 'username') screenUsername.classList.remove('hidden');
  if (screen === 'app') screenApp.classList.remove('hidden');
  if (screen === 'settings') screenSettings.classList.remove('hidden');
}

// --- Event Listeners ---
function setupEventListeners() {
  // Auth Form Toggle
  document.getElementById('tab-signin').addEventListener('click', (e) => setAuthMode('signin', e.target));
  document.getElementById('tab-signup').addEventListener('click', (e) => setAuthMode('signup', e.target));

  // Auth Form Submission
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

  // GitHub OAuth Button
  document.getElementById('btn-github-oauth').addEventListener('click', handleGitHubAuth);

  // Username Form
  document.getElementById('username-form').addEventListener('submit', handleUsernameSubmit);

  // Navigation Tabs
  tabNavLog.addEventListener('click', () => switchAppTab('log'));
  tabNavCommunity.addEventListener('click', () => switchAppTab('community'));

  // Header Buttons
  document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings'));
  document.getElementById('btn-close-settings').addEventListener('click', () => showScreen('app'));
  document.getElementById('btn-signout').addEventListener('click', handleSignOut);

  // Modal Triggers
  document.getElementById('btn-create-post').addEventListener('click', () => modalPost.classList.remove('hidden'));
  document.getElementById('btn-close-modal').addEventListener('click', () => modalPost.classList.add('hidden'));
  document.getElementById('btn-cancel-post').addEventListener('click', () => modalPost.classList.add('hidden'));

  // Post Submission
  document.getElementById('post-form').addEventListener('submit', handleCreatePost);

  // Change Password Form
  document.getElementById('change-pass-form').addEventListener('submit', handleChangePassword);

  // Filter Buttons
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

  // Search Input
  document.getElementById('search-input').addEventListener('input', renderPosts);
}

// --- Authentication Logic ---
function setAuthMode(mode, tabElem) {
  currentAuthMode = mode;
  document.getElementById('tab-signin').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
  document.getElementById('tab-signup').className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
  tabElem.className = 'flex-1 py-2 text-center text-sm font-semibold border-b-2 border-amber-500 text-amber-400';
  document.getElementById('auth-submit-btn').innerText = mode === 'signin' ? 'Sign In' : 'Create Account';
}

function validatePassword(pass) {
  const minLength = pass.length >= 8;
  const hasLower = /[a-z]/.test(pass);
  const hasUpper = /[A-Z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  return minLength && hasLower && hasUpper && hasNumber;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  if (currentAuthMode === 'signup' && !validatePassword(password)) {
    showToast('Password must be at least 8 chars long with uppercase, lowercase, and a number.', 'error');
    return;
  }

  // Check if using Supabase client
  if (supabase) {
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
    // LocalStorage Fallback logic
    const users = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
    if (currentAuthMode === 'signup') {
      if (users.find(u => u.email === email)) {
        return showToast('User already exists with this email.', 'error');
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
  showToast('Signed in successfully!', 'success');
  fetchProfile(currentUser.id);
}

function handleGitHubAuth() {
  if (supabase) {
    supabase.auth.signInWithOAuth({ provider: 'github' });
  } else {
    // Simulated OAuth flow for standalone demo
    currentUser = { id: 'usr_github_' + Date.now(), email: 'github_owner@petcare.com' };
    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast('Signed in with GitHub OAuth!', 'success');
    fetchProfile(currentUser.id);
  }
}

async function fetchProfile(userId) {
  let profile = null;
  if (supabase) {
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
    navUsername.innerText = `@${profile.username}`;
    navUserBar.classList.remove('hidden');
    showScreen('app');
    renderPosts();
  }
}

async function handleUsernameSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('input-username').value.trim();
  if (!username) return;

  currentProfile = { id: currentUser.id, username, created_at: new Date().toISOString() };

  if (supabase) {
    await supabase.from('profiles').upsert(currentProfile);
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profiles[currentUser.id] = currentProfile;
    localStorage.setItem('marblevet_profiles', JSON.stringify(profiles));
  }

  navUsername.innerText = `@${username}`;
  navUserBar.classList.remove('hidden');
  showToast('Profile updated!', 'success');
  showScreen('app');
  renderPosts();
}

function handleSignOut() {
  if (supabase) supabase.auth.signOut();
  localStorage.removeItem('marblevet_session');
  currentUser = null;
  currentProfile = null;
  navUserBar.classList.add('hidden');
  showScreen('auth');
  showToast('Signed out successfully.', 'info');
}

// --- Password Reset / Change ---
async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById('new-password').value;
  if (!validatePassword(newPass)) {
    return showToast('Password does not meet required security criteria.', 'error');
  }

  if (supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return showToast(error.message, 'error');
  }
  showToast('Password updated successfully!', 'success');
  document.getElementById('change-pass-form').reset();
  showScreen('app');
}

// --- Tab Switching ---
function switchAppTab(tab) {
  if (tab === 'log') {
    tabNavLog.classList.add('active');
    tabNavCommunity.classList.remove('active');
    viewHealthLog.classList.remove('hidden');
    viewCommunity.classList.add('hidden');
  } else {
    tabNavCommunity.classList.add('active');
    tabNavLog.classList.remove('active');
    viewCommunity.classList.remove('hidden');
    viewHealthLog.classList.add('hidden');
  }
}

// --- Posts & Attachments ---
async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById('post-title').value;
  const category = document.getElementById('post-category').value;
  const visibility = document.getElementById('post-visibility').value;
  const content = document.getElementById('post-content').value;
  const fileInput = document.getElementById('post-file');

  let file_url = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 50 * 1024 * 1024) {
      return showToast('File size exceeds the 50MB limit.', 'error');
    }
    // Convert to DataURL for immediate browser preview/storage
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

  if (supabase) {
    await supabase.from('posts').insert([newPost]);
  } else {
    const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    posts.unshift(newPost);
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  }

  modalPost.classList.add('hidden');
  document.getElementById('post-form').reset();
  showToast('Entry created successfully!', 'success');
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

  // Render Private Health Logs
  const privatePosts = posts.filter(p => p.visibility === 'private' && p.user_id === currentUser.id);
  if (privatePosts.length === 0) {
    logGrid.innerHTML = `
      <div class="col-span-full clean-card p-8 text-center text-stone-400">
        <i class="fa-solid fa-notes-medical text-3xl text-amber-500/50 mb-2"></i>
        <p class="text-sm">No private health logs stored yet. Click "New Record / Question" to add one.</p>
      </div>`;
  } else {
    logGrid.innerHTML = privatePosts.map(p => `
      <div class="clean-card p-5 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
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

  // Render Community Advice Posts
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
        <p class="text-sm">No community questions found for this category.</p>
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
        
        <!-- Replies Section -->
        <div class="pt-4 border-t border-stone-800/80 space-y-3">
          <div id="replies-container-${p.id}" class="space-y-2">
            ${renderReplies(p.id)}
          </div>
          <form onsubmit="handlePostReply(event, '${p.id}')" class="flex gap-2 pt-2">
            <input type="text" id="reply-input-${p.id}" required placeholder="Write a solution or reply..." class="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500" />
            <button type="submit" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs">Reply</button>
          </form>
        </div>
      </div>
    `).join('');
  }
}

function renderAttachment(url) {
  if (url.startsWith('data:image')) {
    return `<img src="${url}" class="max-h-48 rounded-lg object-contain bg-stone-950 border border-stone-800" />`;
  }
  return `<a href="${url}" target="_blank" class="inline-flex items-center gap-2 text-xs text-amber-400 hover:underline"><i class="fa-solid fa-paperclip"></i> View Attached Document</a>`;
}

function renderReplies(postId) {
  const replies = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY) || '[]').filter(r => r.post_id === postId);
  if (replies.length === 0) return '<p class="text-[11px] text-stone-500 italic">No replies yet. Be the first to help!</p>';
  return replies.map(r => `
    <div class="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/60 text-xs">
      <div class="flex justify-between items-center mb-1">
        <span class="font-bold text-amber-300">@${escapeHtml(r.author_username)}</span>
        <span class="text-[10px] text-stone-500">${new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <p class="text-stone-300">${escapeHtml(r.content)}</p>
    </div>
  `).join('');
}

function handlePostReply(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`reply-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  const newReply = {
    id: 'rep_' + Date.now(),
    post_id: postId,
    user_id: currentUser.id,
    author_username: currentProfile.username,
    content,
    created_at: new Date().toISOString()
  };

  const replies = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY) || '[]');
  replies.push(newReply);
  localStorage.setItem(LOCAL_STORAGE_REPLIES_KEY, JSON.stringify(replies));

  input.value = '';
  renderPosts();
}

// --- Utilities ---
function showToast(msg, type = 'info') {
  const toastMsg = document.getElementById('toast-message');
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