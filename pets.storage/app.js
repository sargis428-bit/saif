// app.js - Application Logic & Database Operations

// Supabase Connection Configuration
const SUPABASE_URL = 'https://5fnO6q510nPODeejDxMllw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5fnO6q510nPODeejDxMllw_2OsLVWLV';

let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase operating in fallback local storage mode:", e.message);
}

// Global Application State
let currentUser = null;
let currentProfile = null;
let currentAuthMode = 'signin';
let activeCategory = 'all';

// Storage Keys
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
  const screens = ['auth', 'username', 'app', 'settings'];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.remove('hidden');
}

function setupEventListeners() {
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');

  if (tabSignin) tabSignin.addEventListener('click', (e) => setAuthMode('signin', e.target));
  if (tabSignup) tabSignup.addEventListener('click', (e) => setAuthMode('signup', e.target));

  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

  const authPassInput = document.getElementById('auth-password');
  if (authPassInput) {
    authPassInput.addEventListener('input', (e) => updatePasswordChecklist(e.target.value, 'auth'));
  }

  const newPassInput = document.getElementById('new-password');
  if (newPassInput) {
    newPassInput.addEventListener('input', (e) => updatePasswordChecklist(e.target.value, 'change'));
  }

  const btnGithub = document.getElementById('btn-github-oauth');
  if (btnGithub) btnGithub.addEventListener('click', handleGitHubAuth);

  const usernameForm = document.getElementById('username-form');
  if (usernameForm) usernameForm.addEventListener('submit', handleUsernameSubmit);

  const tabLog = document.getElementById('tab-nav-log');
  const tabComm = document.getElementById('tab-nav-community');

  if (tabLog) tabLog.addEventListener('click', () => switchAppTab('log'));
  if (tabComm) tabComm.addEventListener('click', () => switchAppTab('community'));

  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSignout = document.getElementById('btn-signout');

  if (btnSettings) btnSettings.addEventListener('click', () => showScreen('settings'));
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => showScreen('app'));
  if (btnSignout) btnSignout.addEventListener('click', handleSignOut);

  const modalPost = document.getElementById('modal-post');
  const btnCreatePost = document.getElementById('btn-create-post');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelPost = document.getElementById('btn-cancel-post');

  if (btnCreatePost && modalPost) btnCreatePost.addEventListener('click', () => modalPost.classList.remove('hidden'));
  if (btnCloseModal && modalPost) btnCloseModal.addEventListener('click', () => modalPost.classList.add('hidden'));
  if (btnCancelPost && modalPost) btnCancelPost.addEventListener('click', () => modalPost.classList.add('hidden'));

  const postForm = document.getElementById('post-form');
  if (postForm) postForm.addEventListener('submit', handleCreatePost);

  const changePassForm = document.getElementById('change-pass-form');
  if (changePassForm) changePassForm.addEventListener('submit', handleChangePassword);

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

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', renderPosts);
}

function validatePasswordLegitimacy(pass) {
  if (!pass || typeof pass !== 'string') {
    return { isValid: false, checks: {}, reasons: ['Password cannot be empty'] };
  }

  const checks = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass),
    notRepetitive: !/(.)\1{3,}/.test(pass),
    notSequential: !/12345|23456|34567|45678|56789|abcdef|qwerty|password|admin123/i.test(pass)
  };

  const isValid = checks.length && checks.uppercase && checks.lowercase && 
                  checks.number && checks.special && checks.notRepetitive && checks.notSequential;

  const reasons = [];
  if (!checks.length) reasons.push("Must be at least 8 characters long.");
  if (!checks.uppercase) reasons.push("Must contain at least 1 uppercase letter (A-Z).");
  if (!checks.lowercase) reasons.push("Must contain at least 1 lowercase letter (a-z).");
  if (!checks.number) reasons.push("Must contain at least 1 number (0-9).");
  if (!checks.special) reasons.push("Must contain at least 1 special character (!@#$%^&*).");
  if (!checks.notRepetitive || !checks.notSequential) reasons.push("Avoid repetitive or common sequential patterns.");

  return { isValid, checks, reasons };
}

function updatePasswordChecklist(pass, context = 'auth') {
  const result = validatePasswordLegitimacy(pass);
  const prefix = context === 'auth' ? 'chk-' : 'chg-';

  const updateItem = (id, passed) => {
    const elem = document.getElementById(prefix + id);
    if (!elem) return;
    const labelText = elem.innerText.replace(/^.*?\s/, '');
    if (passed) {
      elem.className = 'text-emerald-400 flex items-center gap-1.5 font-medium';
      elem.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> ${labelText}`;
    } else {
      elem.className = 'text-stone-400 flex items-center gap-1.5';
      elem.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400"></i> ${labelText}`;
    }
  };

  updateItem('len', result.checks.length);
  updateItem('upper', result.checks.uppercase);
  updateItem('lower', result.checks.lowercase);
  updateItem('num', result.checks.number);
  updateItem('spec', result.checks.special);
  updateItem('pattern', result.checks.notRepetitive && result.checks.notSequential);
}

function setAuthMode(mode, tabElem) {
  currentAuthMode = mode;
  document.getElementById('tab-signin').className = 'flex-1 py-2 text-center text-xs font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
  document.getElementById('tab-signup').className = 'flex-1 py-2 text-center text-xs font-semibold border-b-2 border-transparent text-stone-400 hover:text-stone-200';
  tabElem.className = 'flex-1 py-2 text-center text-xs font-semibold border-b-2 border-amber-500 text-amber-400';
  document.getElementById('auth-submit-btn').innerText = mode === 'signin' ? 'Sign In' : 'Create Account';

  const checklist = document.getElementById('password-checklist');
  if (checklist) {
    checklist.classList.toggle('hidden', mode !== 'signup');
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (currentAuthMode === 'signup') {
    const legitimacy = validatePasswordLegitimacy(password);
    if (!legitimacy.isValid) {
      return showToast(legitimacy.reasons[0] || 'Password criteria not met.', 'error');
    }
  }

  if (password.length < 8) {
    return showToast('Password must be at least 8 characters long.', 'error');
  }

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
    currentUser = { id: 'usr_github_' + Date.now(), email: 'vet_owner@example.com' };
    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast('Signed in with GitHub Auth!', 'success');
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

  if (supabase) {
    await supabase.from('profiles').upsert(currentProfile);
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profiles[currentUser.id] = currentProfile;
    localStorage.setItem('marblevet_profiles', JSON.stringify(profiles));
  }

  document.getElementById('nav-username').innerText = `@${username}`;
  document.getElementById('nav-user-bar').classList.remove('hidden');
  showToast('Username saved!', 'success');
  showScreen('app');
  renderPosts();
}

function handleSignOut() {
  if (supabase) supabase.auth.signOut();
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
  const legitimacy = validatePasswordLegitimacy(newPass);

  if (!legitimacy.isValid) {
    return showToast(legitimacy.reasons[0] || 'Password does not meet safety criteria.', 'error');
  }

  if (supabase) {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return showToast(error.message, 'error');
  }
  showToast('Password updated successfully!', 'success');
  document.getElementById('change-pass-form').reset();
  showScreen('app');
}

function switchAppTab(tab) {
  const logBtn = document.getElementById('tab-nav-log');
  const commBtn = document.getElementById('tab-nav-community');
  const logView = document.getElementById('view-health-log');
  const commView = document.getElementById('view-community');

  if (tab === 'log') {
    logBtn.className = 'active pb-2 border-b-2 border-amber-500 text-amber-400 font-bold transition-all';
    commBtn.className = 'pb-2 text-stone-400 hover:text-stone-200 transition-all';
    logView.classList.remove('hidden');
    commView.classList.add('hidden');
  } else {
    commBtn.className = 'active pb-2 border-b-2 border-amber-500 text-amber-400 font-bold transition-all';
    logBtn.className = 'pb-2 text-stone-400 hover:text-stone-200 transition-all';
    commView.classList.remove('hidden');
    logView.classList.add('hidden');
  }
}

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

  if (supabase) {
    await supabase.from('posts').insert([newPost]);
  } else {
    const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
    posts.unshift(newPost);
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  }

  document.getElementById('modal-post').classList.add('hidden');
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

function renderPosts() {
  const posts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
  const logGrid = document.getElementById('log-grid');
  const communityFeed = document.getElementById('community-feed');
  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase();

  // Render Private Health Logs
  const privatePosts = posts.filter(p => p.visibility === 'private' && p.user_id === currentUser?.id);
  if (logGrid) {
    if (privatePosts.length === 0) {
      logGrid.innerHTML = `
        <div class="col-span-full clean-card p-8 text-center text-stone-400">
          <i class="fa-solid fa-notes-medical text-3xl text-amber-500/50 mb-2"></i>
          <p class="text-xs">No private health logs stored yet. Click "New Record / Question" to add one.</p>
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
            <h3 class="font-bold text-amber-100 text-sm mb-2">${escapeHtml(p.title)}</h3>
            <p class="text-xs text-stone-300 leading-relaxed mb-4">${escapeHtml(p.content)}</p>
          </div>
          ${p.file_url ? `<div class="pt-2 border-t border-stone-800">${renderAttachment(p.file_url)}</div>` : ''}
        </div>
      `).join('');
    }
  }

  // Render Public Community Feed
  let publicPosts = posts.filter(p => p.visibility !== 'private');
  if (activeCategory !== 'all') {
    publicPosts = publicPosts.filter(p => p.category === activeCategory);
  }
  if (searchQuery) {
    publicPosts = publicPosts.filter(p => p.title.toLowerCase().includes(searchQuery) || p.content.toLowerCase().includes(searchQuery));
  }

  if (communityFeed) {
    if (publicPosts.length === 0) {
      communityFeed.innerHTML = `
        <div class="clean-card p-8 text-center text-stone-400">
          <i class="fa-solid fa-comments text-3xl text-amber-500/50 mb-2"></i>
          <p class="text-xs">No community questions found for this category.</p>
        </div>`;
    } else {
      communityFeed.innerHTML = publicPosts.map(p => `
        <div class="clean-card p-5 space-y-3">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold text-amber-400">@${escapeHtml(p.author_username || 'anonymous')}</span>
              <span class="text-stone-500">•</span>
              <span class="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] uppercase text-stone-400 font-semibold">${escapeHtml(p.category)}</span>
            </div>
            <span class="text-stone-500 text-[11px]">${new Date(p.created_at).toLocaleString()}</span>
          </div>
          <h3 class="text-base font-bold text-amber-100">${escapeHtml(p.title)}</h3>
          <p class="text-xs text-stone-300 leading-relaxed">${escapeHtml(p.content)}</p>
          ${p.file_url ? `<div class="pt-2">${renderAttachment(p.file_url)}</div>` : ''}
          
          <div class="pt-3 border-t border-stone-800/80 space-y-3">
            <div id="replies-container-${p.id}" class="space-y-2">
              ${renderReplies(p.id)}
            </div>
            <form onsubmit="handlePostReply(event, '${p.id}')" class="flex gap-2 pt-1">
              <input type="text" id="reply-input-${p.id}" required placeholder="Write a response..." class="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500" />
              <button type="submit" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs">Reply</button>
            </form>
          </div>
        </div>
      `).join('');
    }
  }
}

function renderAttachment(url) {
  if (url.startsWith('data:image')) {
    return `<img src="${url}" class="max-h-48 rounded-lg object-contain bg-stone-950 border border-stone-800" />`;
  }
  return `<a href="${url}" target="_blank" class="inline-flex items-center gap-2 text-xs text-amber-400 hover:underline"><i class="fa-solid fa-paperclip"></i> View Attachment</a>`;
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
      <p class="text-stone-300 text-xs">${escapeHtml(r.content)}</p>
    </div>
  `).join('');
}

function handlePostReply(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`reply-input-${postId}`);
  const content = input ? input.value.trim() : '';
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

  if (input) input.value = '';
  renderPosts();
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.innerText = msg;
  toast.className = `fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-xl text-xs font-medium flex items-center gap-3 transition-all duration-300 ${
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