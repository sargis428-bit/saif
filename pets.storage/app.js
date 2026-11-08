let currentUser = null;
let currentProfile = null;
let currentAuthMode = 'signin';
let activeCategory = 'all';
let loadedPosts = [];
let activeModalPostId = null;

const LOCAL_STORAGE_USERS_KEY = 'marblevet_users_db';
const LOCAL_STORAGE_POSTS_KEY = 'marblevet_posts_db';
const LOCAL_STORAGE_COMMENTS_KEY = 'marblevet_comments_db';
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
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB (Matches storage bucket limit)

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

async function initApp() {
  if (supabaseClient) {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error) {
        showToast(error.message, 'error');
      }

      if (session && session.user) {
        currentUser = session.user;
        localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
        await fetchProfile(currentUser.id);
        return;
      }
    } catch (err) {
      console.error('Session retrieval error:', err);
    }
  }

  // Fallback check for stored session
  const savedUser = localStorage.getItem('marblevet_session');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    await fetchProfile(currentUser.id);
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

  document.getElementById('btn-close-view-modal').addEventListener('click', () => document.getElementById('modal-view-post').classList.add('hidden'));

  document.getElementById('post-form').addEventListener('submit', handleCreatePost);
  
  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', handleCreateComment);
  }

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
    await fetchProfile(currentUser.id);
  } catch (err) {
    showToast(err.message || 'An unexpected error occurred.', 'error');
  }
}

async function handleGitHubAuth() {
  if (supabaseClient) {
    const redirectUrl = window.location.origin + window.location.pathname;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) {
      showToast(error.message, 'error');
    }
  } else {
    currentUser = { id: 'usr_github_' + Date.now(), email: 'github_user@petcare.com' };
    localStorage.setItem('marblevet_session', JSON.stringify(currentUser));
    showToast('Signed in with GitHub!', 'success');
    await fetchProfile(currentUser.id);
  }
}

async function fetchProfile(userId) {
  let profile = null;
  if (supabaseClient) {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle();
    profile = data;
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profile = profiles[userId];
  }

  const githubUsername = currentUser?.user_metadata?.user_name || 
                         currentUser?.user_metadata?.preferred_username || 
                         (currentUser?.email ? currentUser.email.split('@')[0] : null);

  if (!profile && githubUsername) {
    profile = { id: userId, username: githubUsername, created_at: new Date().toISOString() };
    if (supabaseClient) {
      await supabaseClient.from('profiles').upsert(profile);
    } else {
      const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
      profiles[userId] = profile;
      localStorage.setItem('marblevet_profiles', JSON.stringify(profiles));
    }
  }

  if (!profile || !profile.username) {
    if (githubUsername) {
      document.getElementById('input-username').value = githubUsername;
    }
    showScreen('username');
  } else {
    currentProfile = profile;
    document.getElementById('nav-username').innerText = `@${profile.username}`;
    document.getElementById('nav-user-bar').classList.remove('hidden');
    showScreen('app');
    await renderPosts();
  }
}

async function handleUsernameSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('input-username').value.trim();
  if (!username) return;

  currentProfile = { id: currentUser.id, username, created_at: new Date().toISOString() };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('profiles').upsert(currentProfile);
    if (error) return showToast(error.message, 'error');
  } else {
    const profiles = JSON.parse(localStorage.getItem('marblevet_profiles') || '{}');
    profiles[currentUser.id] = currentProfile;
    localStorage.setItem('marblevet_profiles', JSON.stringify(profiles));
  }

  document.getElementById('nav-username').innerText = `@${username}`;
  document.getElementById('nav-user-bar').classList.remove('hidden');
  showToast('Username configured!', 'success');
  showScreen('app');
  await renderPosts();
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

async function uploadFileToStorage(file) {
  if (!supabaseClient) {
    return await readFileAsDataURL(file);
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { data, error } = await supabaseClient.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(STORAGE_BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById('post-title').value.trim();
  const category = document.getElementById('post-category').value;
  const visibility = document.getElementById('post-visibility').value;
  const content = document.getElementById('post-content').value.trim();
  const fileInput = document.getElementById('post-file');

  if (!currentProfile || !currentProfile.username) {
    await fetchProfile(currentUser.id);
  }

  let file_url = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return showToast('File size exceeds the limit.', 'error');
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
    file_url,
    created_at: new Date().toISOString()
  };

  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('posts').insert([newPost]).select();
    if (error) {
      return showToast(error.message, 'error');
    }
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

          <!-- Small screen file/image display inside the upload box -->
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

  let publicPosts = loadedPosts.filter(p => p.visibility !== 'private');
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
        <p class="text-sm">No community questions found.</p>
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

          <!-- Small screen file/image display inside the upload box -->
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

async function openPostModal(postId) {
  const post = loadedPosts.find(p => String(p.id) === String(postId));
  if (!post) return;

  activeModalPostId = postId;
  document.getElementById('view-post-title').innerText = post.title;
  document.getElementById('view-post-author').innerText = `@${post.author_username || 'anonymous'}`;
  document.getElementById('view-post-category').innerText = post.category;
  document.getElementById('view-post-date').innerText = new Date(post.created_at).toLocaleString();
  document.getElementById('view-post-content').innerText = post.content;

  const mediaContainer = document.getElementById('view-post-media-container');
  const mediaContent = document.getElementById('view-post-media-content');

  if (post.file_url) {
    mediaContent.innerHTML = renderCenteredMedia(post.file_url);
    mediaContainer.classList.remove('hidden');
  } else {
    mediaContainer.classList.add('hidden');
    mediaContent.innerHTML = '';
  }

  // Show/Hide Comment Section depending on post visibility
  const commentsSection = document.getElementById('view-post-comments-section');
  if (post.visibility === 'private') {
    commentsSection.classList.add('hidden');
  } else {
    commentsSection.classList.remove('hidden');
    await renderComments(postId);
  }

  document.getElementById('modal-view-post').classList.remove('hidden');
}

async function getComments(postId) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
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
  commentsCount.innerText = comments.length;

  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="text-xs text-stone-500 italic">No replies yet. Be the first to share advice!</p>';
    return;
  }

  commentsList.innerHTML = comments.map(c => `
    <div class="bg-stone-900/70 border border-stone-800 rounded-lg p-3 space-y-1">
      <div class="flex justify-between items-center text-[11px]">
        <span class="font-bold text-amber-400">@${escapeHtml(c.author_username || 'anonymous')}</span>
        <span class="text-stone-500 text-[10px]">${new Date(c.created_at).toLocaleString()}</span>
      </div>
      <p class="text-xs text-stone-200 leading-normal whitespace-pre-wrap">${escapeHtml(c.content)}</p>
    </div>
  `).join('');
}

async function handleCreateComment(e) {
  e.preventDefault();
  const commentInput = document.getElementById('comment-input');
  const content = commentInput.value.trim();

  if (!content || !activeModalPostId) return;

  if (!currentUser) {
    return showToast('You must be logged in to leave a reply.', 'error');
  }

  if (!currentProfile || !currentProfile.username) {
    await fetchProfile(currentUser.id);
  }

  const newComment = {
    post_id: activeModalPostId,
    user_id: currentUser.id,
    author_username: currentProfile?.username || currentUser?.email?.split('@')[0] || 'anonymous',
    content,
    created_at: new Date().toISOString()
  };

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('comments').insert([newComment]);
      if (error) {
        return showToast(error.message, 'error');
      }
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
    showToast('Failed to post reply.', 'error');
  }
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