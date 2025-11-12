// Gravatar helper
function getGravatarUrl(email, size = 40) {
    // MD5 hash function for email
    const md5 = (string) => {
        const hash = CryptoJS.MD5(string.toLowerCase().trim());
        return hash.toString();
    };
    
    const hash = md5(email);
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

// Gravatar helper
function getGravatarUrl(email, size = 40) {
    if (!email) return `https://www.gravatar.com/avatar/00000000000000000000000000000000?s=${size}&d=identicon`;
    const hash = SparkMD5.hash(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

// API helper functions
const API = {
    currentUser: null,
    viewingUser: null,
    authInitialized: false,
    
    async initializeUsers() {
        return new Promise((resolve, reject) => {
            try {
                console.log('👤 Initializing Firebase Auth...');
                
                // Get references to global auth and db (set in index.html)
                const auth = window.auth;
                const db = window.db;
                
                if (!auth) {
                    console.error('❌ Firebase Auth not found on window object');
                    reject(new Error('Firebase Auth not initialized'));
                    return;
                }
                
                if (!db) {
                    console.error('❌ Firestore not found on window object');
                    reject(new Error('Firestore not initialized'));
                    return;
                }
                
                console.log('✅ Firebase Auth and Firestore references obtained');
                
                // Listen for auth state changes
                auth.onAuthStateChanged(async (firebaseUser) => {
                    if (firebaseUser) {
                        console.log('✅ User authenticated:', firebaseUser.email);
                        
                        try {
                            // Try Firestore first if available
                            if (db) {
                                try {
                                    console.log('🔍 Checking Firestore for user document...');
                                    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
                                    
                                    if (userDoc.exists) {
                                        const userData = userDoc.data();
                                        this.currentUser = {
                                            username: userData.username,
                                            displayName: userData.username,
                                            email: firebaseUser.email,
                                            uid: firebaseUser.uid
                                        };
                                        console.log('👤 Logged in as (Firestore):', this.currentUser.username, `(${this.currentUser.email})`);
                                        
                                        // Set viewing user
                                        if (!this.viewingUser) {
                                            this.viewingUser = this.currentUser.username;
                                        }
                                        
                                        this.authInitialized = true;
                                        resolve();
                                        return;
                                    } else {
                                        // This shouldn't happen for properly signed-up users
                                        console.error('❌ No Firestore document found for authenticated user!');
                                        console.error('This user needs to complete signup by creating a Firestore document.');
                                        alert('Account setup incomplete. Please sign out and sign up again.');
                                        await firebaseUser.getIdToken(true); // Force token refresh
                                        reject(new Error('User document not found in Firestore'));
                                        return;
                                    }
                                } catch (firestoreError) {
                                    console.error('❌ Firestore query failed:', firestoreError.message);
                                    reject(firestoreError);
                                    return;
                                }
                            }
                            
                            // If we get here, Firestore is not available (development mode)
                            console.log('🔍 Fetching user from server...');
                            const users = await fetch('/api/users').then(r => r.json());
                            const matchedUser = users.find(u => u.email === firebaseUser.email);
                            
                            if (matchedUser) {
                                this.currentUser = {
                                    username: matchedUser.username,
                                    displayName: matchedUser.username,
                                    email: firebaseUser.email,
                                    uid: firebaseUser.uid
                                };
                                console.log('👤 Logged in as (server match):', this.currentUser.username, `(${this.currentUser.email})`);
                            } else {
                                // Extract username from email as fallback (development mode)
                                const username = firebaseUser.email.split('@')[0].replace(/[^a-z0-9_-]/g, '');
                                this.currentUser = {
                                    username: username,
                                    displayName: username,
                                    email: firebaseUser.email,
                                    uid: firebaseUser.uid
                                };
                                console.log('👤 Logged in as (email fallback):', this.currentUser.username, `(${this.currentUser.email})`);
                            }
                            
                            // Set viewing user (will be overridden by URL if needed)
                            if (!this.viewingUser) {
                                this.viewingUser = this.currentUser.username;
                            }
                            
                            this.authInitialized = true;
                            resolve();
                        } catch (error) {
                            console.error('Failed to fetch user details:', error);
                            reject(error);
                        }
                    } else {
                        console.log('❌ No user authenticated - redirecting to login');
                        this.currentUser = null;
                        this.viewingUser = null;
                        this.authInitialized = true;
                        
                        // Redirect to login page if not already there
                        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                            window.location.href = '/login';
                        }
                        resolve();
                    }
                });
            } catch (error) {
                console.error('Failed to initialize auth:', error);
                reject(error);
            }
        });
    },
    
    async handleResponse(res) {
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(error.error || `Request failed with status ${res.status}`);
        }
        return res.json();
    },
    
    async getRecipes() {
        console.log('🔄 Fetching recipes...');
        const res = await fetch(`/api/${this.viewingUser}/recipes`);
        const data = await this.handleResponse(res);
        console.log('✅ Received recipes:', data.length, 'items');
        return data;
    },
    
    async getRecipe(id) {
        console.log('🔄 Fetching recipe:', id);
        const res = await fetch(`/api/${this.viewingUser}/recipes/${id}`);
        return this.handleResponse(res);
    },
    
    async createRecipe(data) {
        console.log('🔄 Creating recipe:', data);
        const res = await fetch(`/api/${this.currentUser.username}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await this.handleResponse(res);
        console.log('✅ Recipe created:', result);
        return result;
    },
    
    async updateRecipe(id, data) {
        console.log('🔄 Updating recipe:', id, data);
        const res = await fetch(`/api/${this.currentUser.username}/recipes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async deleteRecipe(id) {
        console.log('🔄 Deleting recipe:', id);
        const res = await fetch(`/api/${this.currentUser.username}/recipes/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    async getCollections() {
        console.log('🔄 Fetching collections...');
        const res = await fetch(`/api/${this.viewingUser}/collections`);
        const data = await this.handleResponse(res);
        console.log('✅ Received collections:', data.length, 'items');
        return data;
    },
    
    async createCollection(data) {
        console.log('🔄 Creating collection:', data);
        const res = await fetch(`/api/${this.currentUser.username}/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async updateCollection(id, data) {
        console.log('🔄 Updating collection:', id, data);
        const res = await fetch(`/api/${this.currentUser.username}/collections/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async deleteCollection(id) {
        console.log('🔄 Deleting collection:', id);
        const res = await fetch(`/api/${this.currentUser.username}/collections/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    async removeRecipeFromCollection(collectionId, recipeId) {
        console.log('🔄 Removing recipe from collection:', { collectionId, recipeId });
        const res = await fetch(`/api/${this.currentUser.username}/collections/${collectionId}/recipes/${recipeId}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    // Menu API methods
    async getMenus() {
        console.log('🔄 Fetching menus...');
        const res = await fetch(`/api/${this.viewingUser}/menus`);
        const data = await this.handleResponse(res);
        console.log('✅ Received menus:', data.length, 'items');
        return data;
    },
    
    async createMenu(data) {
        console.log('🔄 Creating menu:', data);
        const res = await fetch(`/api/${this.currentUser.username}/menus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async updateMenu(id, data) {
        console.log('🔄 Updating menu:', id, data);
        const res = await fetch(`/api/${this.currentUser.username}/menus/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async deleteMenu(id) {
        console.log('🔄 Deleting menu:', id);
        const res = await fetch(`/api/${this.currentUser.username}/menus/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    // Photo API methods
    async uploadPhoto(file) {
        console.log('🔄 Uploading photo:', file.name);
        const formData = new FormData();
        formData.append('photo', file);
        
        const res = await fetch(`/api/${this.currentUser.username}/photos`, {
            method: 'POST',
            body: formData
        });
        const data = await this.handleResponse(res);
        console.log('✅ Photo uploaded:', data.url);
        return data;
    },
    
    async deletePhoto(id) {
        console.log('🔄 Deleting photo:', id);
        const res = await fetch(`/api/${this.currentUser.username}/photos/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    }
};

// Data management
let recipes = [];
let collections = [];
let menus = [];
let currentRecipeId = null;
let currentCollectionId = null;
let currentMenuId = null;
let currentView = 'home'; // home, collections, collection-detail, recipe-detail, menus, menu-detail
let isEditMode = true;
let isMenuEditMode = false;

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const filterInput = document.getElementById('filterInput');
const recipeList = document.getElementById('recipeList');

// Navbar elements
const navbar = document.getElementById('navbar');
const homeBtn = document.getElementById('homeBtn');

// View sections
const homeView = document.getElementById('homeView');
const collectionsView = document.getElementById('collectionsView');
const collectionDetailView = document.getElementById('collectionDetailView');
const menusView = document.getElementById('menusView');
const recipeDetailView = document.getElementById('recipeDetailView');
const emptyState = document.getElementById('emptyState');

// Collections elements
const collectionsGrid = document.getElementById('collectionsGrid');
const collectionsGridHome = document.getElementById('collectionsGridHome');
const newCollectionBtn = document.getElementById('newCollectionBtn');
const newCollectionBtnHome = document.getElementById('newCollectionBtnHome');
const navCollectionsBtn = document.getElementById('navCollectionsBtn');
const collectionTitle = document.getElementById('collectionTitle');
const collectionDescription = document.getElementById('collectionDescription');
const collectionRecipes = document.getElementById('collectionRecipes');

// Menus elements
const menusGrid = document.getElementById('menusGrid');
const menusGridHome = document.getElementById('menusGridHome');
const newMenuBtn = document.getElementById('newMenuBtn');
const newMenuBtnHome = document.getElementById('newMenuBtnHome');

// Navbar dropdown elements
const navMenuBtn = document.getElementById('navMenuBtn');
const navbarDropdown = document.getElementById('navbarDropdown');
const dropdownCollections = document.getElementById('dropdownCollections');
const dropdownMenus = document.getElementById('dropdownMenus');
const dropdownNewRecipe = document.getElementById('dropdownNewRecipe');
const dropdownShortcuts = document.getElementById('dropdownShortcuts');
const dropdownDebug = document.getElementById('dropdownDebug');

// Recipe elements
const titleInput = document.getElementById('titleInput');
const titleDisplay = document.getElementById('titleDisplay');
const markdownTextarea = document.getElementById('markdownTextarea');
const previewContent = document.getElementById('previewContent');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const deleteBtn2 = document.getElementById('deleteBtn2');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const addToCollectionBtn = document.getElementById('addToCollectionBtn');
const editControls = document.getElementById('editControls');
const editModeControls = document.getElementById('editModeControls');
const cancelBtn = document.getElementById('cancelBtn');
const backBtn = document.getElementById('backBtn');
const backBtnText = document.getElementById('backBtnText');
const breadcrumb = document.getElementById('breadcrumb');
const collectionCheckboxes = document.getElementById('collectionCheckboxes');
const collectionsDropdown = document.getElementById('collectionsDropdown');

// Menu detail elements
const menuDetailView = document.getElementById('menuDetailView');
const menuTitleInput = document.getElementById('menuTitleInput');
const menuTitleDisplay = document.getElementById('menuTitleDisplay');
const menuDescriptionInput = document.getElementById('menuDescriptionInput');
const menuDescriptionDisplay = document.getElementById('menuDescriptionDisplay');
const menuMarkdownTextarea = document.getElementById('menuMarkdownTextarea');
const menuPreviewContent = document.getElementById('menuPreviewContent');
const menuEditControls = document.getElementById('menuEditControls');
const menuEditModeControls = document.getElementById('menuEditModeControls');
const menuEditBtn = document.getElementById('menuEditBtn');
const menuSaveBtn = document.getElementById('menuSaveBtn');
const menuCancelBtn = document.getElementById('menuCancelBtn');
const menuDeleteBtn = document.getElementById('menuDeleteBtn');
const menuDeleteBtn2 = document.getElementById('menuDeleteBtn2');

// Metadata elements
const metadataCreated = document.getElementById('metadataCreated');
const metadataEdited = document.getElementById('metadataEdited');
const metadataCollections = document.getElementById('metadataCollections');
const metadataMenus = document.getElementById('metadataMenus');

// Markdown configuration
marked.setOptions({
    breaks: true,
    gfm: true
});

// Helper function to clean markdown content
function cleanMarkdown(content) {
    if (!content) return '';
    
    // Remove zero-width spaces and other invisible Unicode characters
    let cleaned = content.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Remove BOM (Byte Order Mark)
    cleaned = cleaned.replace(/^\uFEFF/, '');
    
    // Normalize whitespace at the start of lines (but preserve indentation)
    cleaned = cleaned.replace(/^[\s\uFEFF]+(-|\d+\.)/gm, '$1');
    
    return cleaned;
}

// Compress image before upload
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle image paste in textarea
async function handleImagePaste(e, textarea) {
    const items = e.clipboardData?.items;
    console.log('📋 Paste detected, clipboard items:', items?.length || 0);
    
    if (!items) return false;
    
    for (const item of items) {
        console.log('📋 Clipboard item type:', item.type);
        
        if (item.type.indexOf('image') !== -1) {
            console.log('🖼️ Image detected in clipboard!');
            e.preventDefault();
            
            const file = item.getAsFile();
            if (!file) {
                console.warn('⚠️ Could not get file from clipboard item');
                continue;
            }
            
            console.log('📁 Image file:', file.name, file.type, file.size, 'bytes');
            
            // Show loading indicator at cursor position
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            textarea.value = before + '![Uploading...](uploading)' + after;
            
            try {
                // Compress and upload
                const compressed = await compressImage(file);
                const photoData = await API.uploadPhoto(compressed);
                
                // Replace placeholder with actual image markdown
                const uploadingText = '![Uploading...](uploading)';
                const imageMarkdown = `![${file.name}](${photoData.url})`;
                textarea.value = textarea.value.replace(uploadingText, imageMarkdown);
                
                // Trigger change event to update preview if needed
                textarea.dispatchEvent(new Event('input'));
                
                console.log('✅ Image pasted and uploaded successfully');
            } catch (error) {
                console.error('❌ Failed to upload pasted image:', error);
                // Remove placeholder on error
                textarea.value = textarea.value.replace('![Uploading...](uploading)', '');
                alert('Failed to upload image. Please try again.');
            }
            
            return true;
        }
    }
    
    return false;
}

// Sidebar toggle
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

// Auto-collapse sidebar on narrow screens
function handleResize() {
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }
}

// Initial check and resize listener
handleResize();
window.addEventListener('resize', handleResize);

// Close sidebar when clicking outside on narrow screens
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const isClickInsideSidebar = sidebar.contains(e.target);
        const isToggleButton = sidebarToggle.contains(e.target);
        const isSearchInput = filterInput.contains(e.target);
        
        if (!isClickInsideSidebar && !isToggleButton && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
        }
    }
});

// Navigation
homeBtn.addEventListener('click', () => {
    showHomeView();
});

// Update edit controls visibility based on ownership
function updateEditControls() {
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    // Recipe edit/delete controls
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const deleteBtn2 = document.getElementById('deleteBtn2');
    
    if (editBtn) editBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (deleteBtn2) deleteBtn2.style.display = isOwner ? 'inline-flex' : 'none';
    
    // Menu edit/delete controls
    const menuEditBtn = document.getElementById('menuEditBtn');
    const menuDeleteBtn = document.getElementById('menuDeleteBtn');
    const menuDeleteBtn2 = document.getElementById('menuDeleteBtn2');
    
    if (menuEditBtn) menuEditBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (menuDeleteBtn) menuDeleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (menuDeleteBtn2) menuDeleteBtn2.style.display = isOwner ? 'inline-flex' : 'none';
    
    // "New Recipe" menu item
    const dropdownNewRecipe = document.getElementById('dropdownNewRecipe');
    if (dropdownNewRecipe) {
        dropdownNewRecipe.style.display = isOwner ? 'block' : 'none';
    }
    
    // Create collection/menu buttons on home view
    const newCollectionBtnHome = document.getElementById('newCollectionBtnHome');
    const newMenuBtnHome = document.getElementById('newMenuBtnHome');
    if (newCollectionBtnHome) newCollectionBtnHome.style.display = isOwner ? 'inline-flex' : 'none';
    if (newMenuBtnHome) newMenuBtnHome.style.display = isOwner ? 'inline-flex' : 'none';
    
    // Create buttons in collections/menus list views
    const newCollectionBtn = document.getElementById('newCollectionBtn');
    const newMenuBtn = document.getElementById('newMenuBtn');
    if (newCollectionBtn) newCollectionBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (newMenuBtn) newMenuBtn.style.display = isOwner ? 'inline-flex' : 'none';
    
    console.log(`🔒 Edit controls ${isOwner ? 'shown' : 'hidden'} (viewing: ${API.viewingUser}, owner: ${API.currentUser?.username})`);
}

// Update user display in navbar
async function updateUserDisplay() {
    // Update current user avatar in navbar (right side)
    const currentUserAvatar = document.getElementById('currentUserAvatar');
    if (currentUserAvatar && API.currentUser) {
        const gravatarUrl = getGravatarUrl(API.currentUser.email, 128);
        currentUserAvatar.src = gravatarUrl;
        currentUserAvatar.title = `Logged in as @${API.currentUser.username}`;
    }
    
    // Update viewing user in sidebar (shows whose catalog we're browsing)
    const viewingUserAvatar = document.getElementById('viewingUserAvatar');
    const viewingUsername = document.getElementById('viewingUsername');
    
    if (viewingUserAvatar && viewingUsername && API.viewingUser) {
        // If viewing ourselves, use current user data
        if (API.viewingUser === API.currentUser?.username) {
            const gravatarUrl = getGravatarUrl(API.currentUser.email, 128);
            viewingUserAvatar.src = gravatarUrl;
            viewingUsername.textContent = `@${API.viewingUser}`;
        } else {
            // Fetch the viewing user's email from Firestore
            try {
                if (window.db) {
                    const usersSnapshot = await window.db.collection('users')
                        .where('username', '==', API.viewingUser)
                        .limit(1)
                        .get();
                    
                    if (!usersSnapshot.empty) {
                        const userData = usersSnapshot.docs[0].data();
                        const gravatarUrl = getGravatarUrl(userData.email, 128);
                        viewingUserAvatar.src = gravatarUrl;
                        viewingUsername.textContent = `@${API.viewingUser}`;
                    } else {
                        // Fallback to default avatar if user not found
                        viewingUserAvatar.src = getGravatarUrl('unknown@example.com', 128);
                        viewingUsername.textContent = `@${API.viewingUser}`;
                    }
                } else {
                    // No Firestore, use fallback
                    viewingUserAvatar.src = getGravatarUrl('unknown@example.com', 128);
                    viewingUsername.textContent = `@${API.viewingUser}`;
                }
            } catch (error) {
                console.error('Failed to fetch viewing user email:', error);
                viewingUserAvatar.src = getGravatarUrl('unknown@example.com', 128);
                viewingUsername.textContent = `@${API.viewingUser}`;
            }
        }
    }
    
    // Update edit controls visibility based on ownership
    updateEditControls();
}

// Helper to get list of users (we'll fetch this from the API)
let users = [];

async function fetchUsers() {
    try {
        const res = await fetch('/api/users');
        users = await res.json();
    } catch (error) {
        console.error('Failed to fetch users:', error);
    }
}

// Navigation system
function switchToView(viewName) {
    const username = API.viewingUser || API.currentUser?.username;
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    // Update navbar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    currentView = viewName;
    
    switch(viewName) {
        case 'collections':
            collectionsView.classList.remove('hidden');
            collectionsView.classList.add('active');
            homeBtn.classList.add('active');
            renderCollectionsGrid();
            updateEditControls(); // Show/hide create button
            history.pushState({ type: 'collections' }, '', `/${username}/collections`);
            break;
        case 'collection-detail':
            collectionDetailView.classList.remove('hidden');
            collectionDetailView.classList.add('active');
            homeBtn.classList.add('active');
            break;
        case 'menus':
            menusView.classList.remove('hidden');
            menusView.classList.add('active');
            renderMenusGrid();
            updateEditControls(); // Show/hide create button
            history.pushState({ type: 'menus' }, '', `/${username}/menus`);
            break;
        case 'menu-detail':
            menuDetailView.classList.remove('hidden');
            menuDetailView.classList.add('active');
            break;
        case 'recipe-detail':
            recipeDetailView.classList.remove('hidden');
            recipeDetailView.classList.add('active');
            break;
    }
}

// URL routing
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function updateURL(type, id) {
    const username = API.viewingUser || API.currentUser?.username;
    
    if (!id) {
        history.pushState(null, '', `/${username}`);
        return;
    }
    
    if (type === 'recipe') {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        const slug = recipe.title ? slugify(recipe.title) : 'untitled';
        history.pushState({ type: 'recipe', id }, '', `/${username}/recipe/${slug}-${id}`);
    } else if (type === 'collection') {
        const collection = collections.find(c => c.id === id);
        if (!collection) return;
        const slug = slugify(collection.name);
        history.pushState({ type: 'collection', id }, '', `/${username}/collection/${slug}-${id}`);
    } else if (type === 'menu') {
        const menu = menus.find(m => m.id === id);
        if (!menu) return;
        const slug = slugify(menu.name);
        history.pushState({ type: 'menu', id }, '', `/${username}/menu/${slug}-${id}`);
    }
}

function loadFromURL() {
    const path = window.location.pathname;
    console.log('🔗 Loading from URL:', path);
    
    // Match username-prefixed URLs
    const usernameMatch = path.match(/^\/([a-z]+)/);
    if (usernameMatch) {
        const username = usernameMatch[1];
        // Set viewing user from URL (validation happens in loadAllData)
        API.viewingUser = username;
    }
    
    const recipeMatch = path.match(/^\/[a-z]+\/recipe\/.+-([a-zA-Z0-9]+)$/);
    const collectionMatch = path.match(/^\/[a-z]+\/collection\/.+-([a-zA-Z0-9]+)$/);
    const menuMatch = path.match(/^\/[a-z]+\/menu\/.+-([a-zA-Z0-9]+)$/);
    const collectionsPageMatch = path.match(/^\/[a-z]+\/collections$/);
    const menusPageMatch = path.match(/^\/[a-z]+\/menus$/);
    
    if (recipeMatch) {
        const id = recipeMatch[1];
        const recipe = recipes.find(r => r.id === id);
        if (recipe) {
            loadRecipe(id, false);
        } else {
            console.warn('⚠️ Recipe not found:', id);
        }
    } else if (collectionMatch) {
        const id = collectionMatch[1];
        const collection = collections.find(c => c.id === id);
        if (collection) {
            loadCollectionDetail(id, false);
        } else {
            console.warn('⚠️ Collection not found:', id);
        }
    } else if (menuMatch) {
        const id = menuMatch[1];
        console.log('🍽️ Menu match found, ID:', id, 'Available menus:', menus.length);
        const menu = menus.find(m => m.id === id);
        if (menu) {
            console.log('✅ Menu found, loading:', menu.name);
            loadMenuDetail(id, false);
        } else {
            console.warn('⚠️ Menu not found:', id, 'Available menu IDs:', menus.map(m => m.id));
        }
    } else if (collectionsPageMatch) {
        switchToView('collections');
    } else if (menusPageMatch) {
        switchToView('menus');
    } else {
        showHomeView();
    }
}

window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (e.state.type === 'recipe') {
            loadRecipe(e.state.id, false);
        } else if (e.state.type === 'collection') {
            loadCollectionDetail(e.state.id, false);
        } else if (e.state.type === 'collections') {
            switchToView('collections');
        } else if (e.state.type === 'menu') {
            loadMenuDetail(e.state.id, false);
        } else if (e.state.type === 'menus') {
            switchToView('menus');
        }
    } else {
        const path = window.location.pathname;
        if (path === '/collections') {
            switchToView('collections');
        } else if (path === '/menus') {
            switchToView('menus');
        } else {
            showHomeView();
        }
    }
});

// Render collections grid
function renderCollectionsGrid() {
    collectionsGrid.innerHTML = collections.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        return `
            <div class="collection-card" data-id="${col.id}" tabindex="0">
                <div class="collection-card-header">
                    <div class="collection-card-info">
                        <h3 class="collection-card-title">${escapeHtml(col.name)}</h3>
                        <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                    </div>
                    <div class="collection-card-actions">
                        <button onclick="event.stopPropagation(); editCollection('${col.id}')" class="collection-action-btn" title="Edit collection">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onclick="event.stopPropagation(); deleteCollection('${col.id}')" class="collection-action-btn" title="Delete collection">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="collection-card-description">${escapeHtml(col.description || 'No description')}</p>
            </div>
        `;
    }).join('');

    // Add click listeners
    collectionsGrid.querySelectorAll('.collection-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                loadCollectionDetail(card.dataset.id);
            }
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadCollectionDetail(card.dataset.id);
            }
        });
    });
}

// Render menus grid
function renderMenusGrid() {
    menusGrid.innerHTML = menus.map(menu => {
        const recipeCount = menu.recipeIds ? menu.recipeIds.length : 0;
        return `
            <div class="collection-card" data-id="${menu.id}" tabindex="0">
                <div class="collection-card-header">
                    <div class="collection-card-info">
                        <h3 class="collection-card-title">${escapeHtml(menu.name)}</h3>
                        <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                    </div>
                    <div class="collection-card-actions">
                        <button onclick="event.stopPropagation(); loadMenuDetail('${menu.id}'); enterMenuEditMode();" class="collection-action-btn" title="Edit menu">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onclick="event.stopPropagation(); deleteMenu('${menu.id}')" class="collection-action-btn" title="Delete menu">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <p class="collection-card-description">${escapeHtml(menu.description || 'No description')}</p>
            </div>
        `;
    }).join('');

    // Add click listeners
    menusGrid.querySelectorAll('.collection-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                loadMenuDetail(card.dataset.id);
            }
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadMenuDetail(card.dataset.id);
            }
        });
    });
}

function renderCollectionsGridHome() {
    const limitedCollections = collections.slice(0, 4);
    collectionsGridHome.innerHTML = limitedCollections.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        return `
            <div class="collection-card collection-card-compact" data-id="${col.id}" tabindex="0">
                <div class="collection-card-info">
                    <h3 class="collection-card-title">${escapeHtml(col.name)}</h3>
                    <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                </div>
                <p class="collection-card-description">${escapeHtml(col.description || 'No description')}</p>
            </div>
        `;
    }).join('');
    
    if (collections.length > 4) {
        collectionsGridHome.innerHTML += `
            <div class="collection-card collection-card-compact collection-card-view-all" onclick="switchToView('collections')" tabindex="0">
                <div class="view-all-content">
                    <i class="fa-solid fa-arrow-right"></i>
                    <span>View all ${collections.length} collections</span>
                </div>
            </div>
        `;
    }
    
    collectionsGridHome.querySelectorAll('.collection-card:not(.collection-card-view-all)').forEach(card => {
        card.addEventListener('click', () => loadCollectionDetail(card.dataset.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadCollectionDetail(card.dataset.id);
            }
        });
    });
}

function renderMenusGridHome() {
    const limitedMenus = menus.slice(0, 4);
    menusGridHome.innerHTML = limitedMenus.map(menu => {
        const recipeCount = menu.recipeIds ? menu.recipeIds.length : 0;
        return `
            <div class="collection-card collection-card-compact" data-id="${menu.id}" tabindex="0">
                <div class="collection-card-info">
                    <h3 class="collection-card-title">${escapeHtml(menu.name)}</h3>
                    <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                </div>
                <p class="collection-card-description">${escapeHtml(menu.description || 'No description')}</p>
            </div>
        `;
    }).join('');
    
    if (menus.length > 4) {
        menusGridHome.innerHTML += `
            <div class="collection-card collection-card-compact collection-card-view-all" onclick="switchToView('menus')" tabindex="0">
                <div class="view-all-content">
                    <i class="fa-solid fa-arrow-right"></i>
                    <span>View all ${menus.length} menus</span>
                </div>
            </div>
        `;
    }
    
    menusGridHome.querySelectorAll('.collection-card:not(.collection-card-view-all)').forEach(card => {
        card.addEventListener('click', () => loadMenuDetail(card.dataset.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadMenuDetail(card.dataset.id);
            }
        });
    });
}

// Render recipe list
function renderRecipeList(filter = '') {
    const lowerFilter = filter.toLowerCase();
    const filtered = recipes.filter(recipe => 
        recipe.title.toLowerCase().includes(lowerFilter) ||
        recipe.content.toLowerCase().includes(lowerFilter)
    );

    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    recipeList.innerHTML = filtered.map(recipe => {
        // Only highlight as active if we're in recipe view AND came from sidebar (no currentCollectionId)
        const isActive = currentView === 'recipe-detail' && 
                        recipe.id === currentRecipeId && 
                        !currentCollectionId;
        return `
            <div 
                class="recipe-item ${isActive ? 'active' : ''}" 
                data-id="${recipe.id}"
                role="listitem"
                tabindex="0">
                <div class="recipe-item-title">${escapeHtml(recipe.title || 'Untitled')}</div>
                <div class="recipe-item-date">${formatDate(recipe.updatedAt)}</div>
            </div>
        `;
    }).join('');

    recipeList.querySelectorAll('.recipe-item').forEach(item => {
        item.addEventListener('click', () => {
            // Reset collection context when loading from sidebar
            currentCollectionId = null;
            loadRecipe(item.dataset.id);
        });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                currentCollectionId = null;
                loadRecipe(item.dataset.id);
            }
        });
    });
}

// Load collection detail
function loadCollectionDetail(id, updateUrl = true) {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;

    currentCollectionId = id;
    switchToView('collection-detail');
    
    // Update breadcrumb
    const breadcrumbName = document.getElementById('collectionBreadcrumbName');
    if (breadcrumbName) {
        breadcrumbName.textContent = collection.name;
    }
    
    // Add edit and delete buttons to collection header
    const collectionHeader = document.querySelector('.collection-detail-header');
    if (collectionHeader) {
        collectionHeader.innerHTML = `
            <div class="breadcrumb">
                <span class="breadcrumb-link" onclick="switchToView('collections')">Collections</span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-current">${escapeHtml(collection.name)}</span>
            </div>
            <div class="collection-title-section">
                <h1>${escapeHtml(collection.name)}</h1>
                <div class="collection-header-actions">
                    <button onclick="editCollection('${collection.id}')" class="collection-action-btn" title="Edit collection">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteCollection('${collection.id}')" class="collection-action-btn collection-action-btn-danger" title="Delete collection">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="collection-description">${escapeHtml(collection.description || '')}</p>
        `;
    }
    
    const collectionRecipeIds = collection.recipeIds || [];
    const collectionRecipeList = recipes.filter(r => collectionRecipeIds.includes(r.id));
    
    collectionRecipes.innerHTML = collectionRecipeList.length > 0 
        ? `<ul class="collection-recipe-list">${collectionRecipeList.map(recipe => `
            <li class="collection-recipe-item" data-id="${recipe.id}" tabindex="0" onclick="loadRecipeFromCollection('${recipe.id}')">
                <span class="recipe-link">${escapeHtml(recipe.title || 'Untitled')}</span>
                <button onclick="event.stopPropagation(); removeRecipeFromCollection('${collection.id}', '${recipe.id}')" class="collection-action-btn collection-action-btn-danger" title="Remove from collection">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="3 6h18"></path>
                        <path d="19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                </button>
            </li>
        `).join('')}</ul>`
        : '<div class="empty-collection"><p>No recipes in this collection yet</p></div>';
    
    // Add click listeners for recipe list items
    collectionRecipes.querySelectorAll('.collection-recipe-item').forEach(item => {
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadRecipeFromCollection(item.dataset.id);
            }
        });
    });
    
    if (updateUrl) {
        updateURL('collection', id);
    }
}

// Load recipe from collection
function loadRecipeFromCollection(id) {
    loadRecipe(id, true, 'collection');
}

// Load recipe
function loadRecipe(id, updateUrl = true, source = 'sidebar') {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    currentRecipeId = id;
    switchToView('recipe-detail');
    
    // Close sidebar on narrow screens when recipe is clicked
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    }
    
    titleInput.value = recipe.title;
    markdownTextarea.value = recipe.content;
    
    // Handle breadcrumbs and back navigation based on source
    if (source === 'collection' && currentCollectionId) {
        const collection = collections.find(c => c.id === currentCollectionId);
        
        // Show full breadcrumb path
        breadcrumb.innerHTML = `
            <span class="breadcrumb-link" onclick="switchToView('collections')">Collections</span>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-link" onclick="loadCollectionDetail('${currentCollectionId}')">${escapeHtml(collection.name)}</span>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">${escapeHtml(recipe.title)}</span>
        `;
        breadcrumb.classList.remove('hidden');
    } else {
        // Hide breadcrumb for sidebar navigation
        breadcrumb.classList.add('hidden');
    }
    
    enterViewMode();
    updateRecipeMetadata(recipe);
    renderRecipeList(filterInput.value);
    updateEditControls(); // Show/hide edit controls based on ownership
    
    if (updateUrl) {
        updateURL('recipe', id);
    }
}

// Update recipe metadata display
function updateRecipeMetadata(recipe) {
    // Format dates
    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };
    
    // Update created date
    metadataCreated.textContent = formatDate(recipe.createdAt);
    
    // Update edited date
    metadataEdited.textContent = formatDate(recipe.updatedAt);
    
    // Update collections
    const recipeCollections = collections.filter(c => 
        c.recipeIds && c.recipeIds.includes(recipe.id)
    );
    
    if (recipeCollections.length === 0) {
        metadataCollections.innerHTML = '<span class="metadata-empty">None</span>';
    } else {
        metadataCollections.innerHTML = recipeCollections
            .map(c => `<div class="metadata-collection-tag" onclick="loadCollectionDetail('${c.id}')">${escapeHtml(c.name)}</div>`)
            .join('');
    }
    
    // Update menus
    const recipeMenus = menus.filter(m => 
        m.recipeIds && m.recipeIds.includes(recipe.id)
    );
    
    if (recipeMenus.length === 0) {
        metadataMenus.innerHTML = '<span class="metadata-empty">None</span>';
    } else {
        metadataMenus.innerHTML = recipeMenus
            .map(m => `<div class="metadata-collection-tag" onclick="loadMenuDetail('${m.id}')">${escapeHtml(m.name)}</div>`)
            .join('');
    }
}

// Switch to edit mode
function enterEditMode() {
    isEditMode = true;
    
    editControls.classList.add('hidden');
    editModeControls.classList.remove('hidden');
    
    titleInput.classList.remove('hidden');
    titleDisplay.classList.add('hidden');
    
    markdownTextarea.classList.remove('hidden');
    previewContent.classList.add('hidden');
    
    markdownTextarea.focus();
}

// Switch to view mode
function enterViewMode() {
    isEditMode = false;
    
    editControls.classList.remove('hidden');
    editModeControls.classList.add('hidden');
    
    titleInput.classList.add('hidden');
    titleDisplay.classList.remove('hidden');
    
    markdownTextarea.classList.add('hidden');
    previewContent.classList.remove('hidden');
    
    titleDisplay.textContent = titleInput.value || 'Untitled';
    previewContent.innerHTML = marked.parse(cleanMarkdown(markdownTextarea.value || ''));
}

// Show home view (collections)
function showHomeView() {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    homeView.classList.remove('hidden');
    homeView.classList.add('active');
    
    currentRecipeId = null;
    currentCollectionId = null;
    currentMenuId = null;
    
    // Render both collections and menus on home
    renderCollectionsGridHome();
    renderMenusGridHome();
    
    updateEditControls(); // Show/hide create buttons based on ownership
    
    updateURL(null, null);
}

// Load all data
async function loadAllData() {
    console.log('🚀 Loading all data...');
    try {
        // Initialize users first
        await API.initializeUsers();
        
        // Don't load data if not authenticated
        if (!API.currentUser) {
            console.log('⚠️ No authenticated user, skipping data load');
            return;
        }
        
        // IMPORTANT: Set viewing user from URL BEFORE loading data
        const path = window.location.pathname;
        const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
        if (usernameMatch) {
            const username = usernameMatch[1];
            // Set viewing user from URL - trust the URL
            API.viewingUser = username;
            console.log('👁️  Setting viewing user from URL:', username);
        } else {
            // No username in URL, use current user
            API.viewingUser = API.currentUser.username;
        }
        
        // Fetch users list for gravatar lookups
        await fetchUsers();
        
        const [recipesData, collectionsData, menusData] = await Promise.all([
            API.getRecipes().catch(err => {
                console.error('❌ Failed to load recipes:', err.message);
                return [];
            }),
            API.getCollections().catch(err => {
                console.error('❌ Failed to load collections:', err.message);
                return [];
            }),
            API.getMenus().catch(err => {
                console.error('❌ Failed to load menus:', err.message);
                return [];
            })
        ]);
        
        recipes = recipesData;
        collections = collectionsData;
        menus = menusData;
        
        console.log('📊 Data loaded - Recipes:', recipes.length, 'Collections:', collections.length, 'Menus:', menus.length);
        
        renderRecipeList();
        updateUserDisplay();
        loadFromURL();
        
        if (!currentRecipeId && !currentCollectionId && !currentMenuId) {
            showHomeView();
        }
    } catch (error) {
        console.error('💥 Critical error loading data:', error);
        alert('Failed to connect to server. Please check your connection and try refreshing the page.');
    }
}

// Create new recipe
async function createNewRecipe() {
    try {
        const newRecipe = await API.createRecipe({ title: '', content: '' });
        recipes.unshift(newRecipe);
        
        currentRecipeId = newRecipe.id;
        titleInput.value = '';
        markdownTextarea.value = '';
        
        switchToView('recipe-detail');
        
        enterEditMode();
        titleInput.focus();
        renderRecipeList(filterInput.value);
        updateURL('recipe', newRecipe.id);
    } catch (error) {
        alert('Error creating recipe');
    }
}

// Create new collection
async function createNewCollection() {
    const name = prompt('Collection name:');
    if (!name) return;
    
    const description = prompt('Description (optional):') || '';
    
    try {
        const newCollection = await API.createCollection({ name, description });
        collections.unshift(newCollection);
        renderCollectionsGrid();
    } catch (error) {
        alert('Error creating collection');
    }
}

// Save current recipe
async function saveCurrentRecipe() {
    if (!currentRecipeId) return;

    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;

    const title = titleInput.value.trim() || 'Untitled';
    const content = markdownTextarea.value;

    try {
        await API.updateRecipe(currentRecipeId, { title, content });
        recipe.title = title;
        recipe.content = content;
        recipe.updatedAt = new Date().toISOString();
        
        enterViewMode();
        updateRecipeMetadata(recipe);
        renderRecipeList(filterInput.value);
        updateURL('recipe', currentRecipeId);
    } catch (error) {
        alert('Error saving recipe');
    }
}

// Delete current recipe
async function deleteCurrentRecipe() {
    if (!currentRecipeId) return;
    if (!confirm('Delete this recipe?')) return;

    try {
        await API.deleteRecipe(currentRecipeId);
        
        // Remove from collections
        collections.forEach(col => {
            if (col.recipeIds && col.recipeIds.includes(currentRecipeId)) {
                col.recipeIds = col.recipeIds.filter(id => id !== currentRecipeId);
            }
        });
        
        recipes = recipes.filter(r => r.id !== currentRecipeId);
        
        if (currentCollectionId) {
            loadCollectionDetail(currentCollectionId, false);
        } else {
            showHomeView();
        }
        updateURL(null, null);
        renderRecipeList();
    } catch (error) {
        alert('Error deleting recipe');
    }
}

// Copy link to recipe
function copyRecipeLink() {
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;
    
    const slug = recipe.title ? slugify(recipe.title) : 'untitled';
    const url = `${window.location.origin}/recipe/${slug}-${currentRecipeId}`;
    
    navigator.clipboard.writeText(url).then(() => {
        copyLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            copyLinkBtn.innerHTML = '<i class="fa-solid fa-link"></i>';
        }, 2000);
    });
}

// Show collection modal
function showCollectionModal() {
    if (!currentRecipeId) return;
    
    collectionCheckboxes.innerHTML = collections.map(col => {
        const isInCollection = col.recipeIds && col.recipeIds.includes(currentRecipeId);
        return `
            <div class="collection-checkbox">
                <input type="checkbox" id="col-${col.id}" data-collection-id="${col.id}" ${isInCollection ? 'checked' : ''}>
                <label for="col-${col.id}">${escapeHtml(col.name)}</label>
            </div>
        `;
    }).join('');
    
    // Add event listeners to checkboxes for auto-save
    collections.forEach(col => {
        const checkbox = document.getElementById(`col-${col.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', () => handleCollectionToggle(col.id, checkbox.checked));
        }
    });
    
    collectionsDropdown.classList.remove('hidden');
}

// Handle collection checkbox toggle
async function handleCollectionToggle(collectionId, isChecked) {
    try {
        const col = collections.find(c => c.id === collectionId);
        if (!col) return;
        
        if (!col.recipeIds) col.recipeIds = [];
        
        if (isChecked && !col.recipeIds.includes(currentRecipeId)) {
            col.recipeIds.push(currentRecipeId);
            console.log('🔄 Adding recipe to collection:', col.name);
            await API.updateCollection(col.id, col);
            console.log('✅ Successfully added recipe to collection');
        } else if (!isChecked && col.recipeIds.includes(currentRecipeId)) {
            col.recipeIds = col.recipeIds.filter(id => id !== currentRecipeId);
            console.log('🔄 Removing recipe from collection:', col.name);
            await API.updateCollection(col.id, col);
            console.log('✅ Successfully removed recipe from collection');
        }
        
        // Update metadata sidebar
        const currentRecipe = recipes.find(r => r.id === currentRecipeId);
        if (currentRecipe) {
            updateRecipeMetadata(currentRecipe);
        }
        
        renderRecipeList(filterInput.value);
    } catch (error) {
        console.error('❌ Error updating collection:', error);
        alert(`Error updating collection: ${error.message}`);
    }
}

// Edit collection
async function editCollection(collectionId) {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        alert('Collection not found');
        return;
    }
    
    const newName = prompt('Collection name:', collection.name);
    if (!newName) return;
    
    const newDescription = prompt('Description (optional):', collection.description || '');
    
    try {
        const updatedData = { name: newName, description: newDescription || '' };
        await API.updateCollection(collectionId, updatedData);
        
        // Update local collection data
        collection.name = newName;
        collection.description = newDescription || '';
        
        // Refresh the current view
        if (currentView === 'collections') {
            renderCollectionsGrid();
        } else if (currentView === 'collection-detail' && currentCollectionId === collectionId) {
            loadCollectionDetail(collectionId, false);
        }
        
        console.log('✅ Collection updated successfully');
    } catch (error) {
        console.error('❌ Error updating collection:', error);
        alert(`Error updating collection: ${error.message}`);
    }
}

// Delete collection
async function deleteCollection(collectionId) {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) {
        alert('Collection not found');
        return;
    }
    
    const recipeCount = collection.recipeIds ? collection.recipeIds.length : 0;
    const confirmMessage = recipeCount > 0 
        ? `Are you sure you want to delete "${collection.name}"? This will remove ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''} from this collection (the recipes themselves will not be deleted).`
        : `Are you sure you want to delete "${collection.name}"?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        await API.deleteCollection(collectionId);
        console.log('✅ Collection deleted successfully');
        
        // Update local collections array
        const index = collections.findIndex(c => c.id === collectionId);
        if (index !== -1) {
            collections.splice(index, 1);
        }
        
        // Refresh the current view
        if (currentView === 'collections') {
            renderCollectionsGrid();
        } else {
            // If we're viewing the deleted collection, go back to collections view
            switchToView('collections');
        }
    } catch (error) {
        console.error('❌ Error deleting collection:', error);
        alert(`Error deleting collection: ${error.message}`);
    }
}

// Remove recipe from collection
async function removeRecipeFromCollection(collectionId, recipeId) {
    const collection = collections.find(c => c.id === collectionId);
    const recipe = recipes.find(r => r.id === recipeId);
    
    if (!collection || !recipe) {
        alert('Collection or recipe not found');
        return;
    }
    
    if (!confirm(`Remove "${recipe.title}" from "${collection.name}"?`)) {
        return;
    }
    
    try {
        await API.removeRecipeFromCollection(collectionId, recipeId);
        console.log('✅ Recipe removed from collection successfully');
        
        // Update local collection data
        if (collection.recipeIds) {
            collection.recipeIds = collection.recipeIds.filter(id => id !== recipeId);
        }
        
        // Refresh the collection detail view
        loadCollectionDetail(collectionId);
    } catch (error) {
        console.error('❌ Error removing recipe from collection:', error);
        alert(`Error removing recipe from collection: ${error.message}`);
    }
}

// === MENU FUNCTIONS ===

async function createNewMenu() {
    try {
        const newMenu = await API.createMenu({ 
            name: 'Untitled Menu', 
            description: '', 
            content: '', 
            recipeIds: [] 
        });
        menus.unshift(newMenu);
        loadMenuDetail(newMenu.id);
        enterMenuEditMode();
    } catch (error) {
        console.error('Error creating menu:', error);
        alert('Error creating menu');
    }
}

function loadMenuDetail(menuId, updateHistory = true) {
    const menu = menus.find(m => m.id === menuId);
    if (!menu) {
        console.error('Menu not found:', menuId);
        return;
    }
    
    currentMenuId = menuId;
    currentView = 'menu-detail';
    
    if (updateHistory) {
        updateURL('menu', menuId);
    }
    
    switchToView('menu-detail');
    
    // Populate display elements
    menuTitleDisplay.textContent = menu.name;
    menuDescriptionDisplay.textContent = menu.description || '';
    menuPreviewContent.innerHTML = marked.parse(cleanMarkdown(menu.content || ''));
    
    // Populate edit elements
    menuTitleInput.value = menu.name;
    menuDescriptionInput.value = menu.description || '';
    menuMarkdownTextarea.value = menu.content || '';
    
    // Show view mode controls
    menuEditControls.classList.remove('hidden');
    menuEditModeControls.classList.add('hidden');
    
    // Exit edit mode
    isMenuEditMode = false;
    menuTitleDisplay.classList.remove('hidden');
    menuTitleInput.classList.add('hidden');
    menuDescriptionDisplay.classList.remove('hidden');
    menuDescriptionInput.classList.add('hidden');
    menuPreviewContent.classList.remove('hidden');
    menuMarkdownTextarea.classList.add('hidden');
    
    updateEditControls(); // Show/hide edit controls based on ownership
}

function enterMenuEditMode() {
    isMenuEditMode = true;
    
    menuTitleDisplay.classList.add('hidden');
    menuTitleInput.classList.remove('hidden');
    menuDescriptionDisplay.classList.add('hidden');
    menuDescriptionInput.classList.remove('hidden');
    menuPreviewContent.classList.add('hidden');
    menuMarkdownTextarea.classList.remove('hidden');
    
    menuEditControls.classList.add('hidden');
    menuEditModeControls.classList.remove('hidden');
    
    menuTitleInput.focus();
}

function exitMenuEditMode() {
    const menu = menus.find(m => m.id === currentMenuId);
    if (!menu) return;
    
    isMenuEditMode = false;
    
    // Revert to saved values
    menuTitleInput.value = menu.name;
    menuDescriptionInput.value = menu.description || '';
    menuMarkdownTextarea.value = menu.content || '';
    
    menuTitleDisplay.classList.remove('hidden');
    menuTitleInput.classList.add('hidden');
    menuDescriptionDisplay.classList.remove('hidden');
    menuDescriptionInput.classList.add('hidden');
    menuPreviewContent.classList.remove('hidden');
    menuMarkdownTextarea.classList.add('hidden');
    
    menuEditControls.classList.remove('hidden');
    menuEditModeControls.classList.add('hidden');
}

async function saveMenuChanges() {
    const menu = menus.find(m => m.id === currentMenuId);
    if (!menu) return;
    
    const name = menuTitleInput.value.trim();
    const description = menuDescriptionInput.value.trim();
    const content = menuMarkdownTextarea.value;
    
    if (!name) {
        alert('Please enter a menu name');
        menuTitleInput.focus();
        return;
    }
    
    try {
        await API.updateMenu(currentMenuId, { name, description, content });
        
        menu.name = name;
        menu.description = description;
        menu.content = content;
        
        menuTitleDisplay.textContent = name;
        menuDescriptionDisplay.textContent = description;
        menuPreviewContent.innerHTML = marked.parse(cleanMarkdown(content));
        
        exitMenuEditMode();
    } catch (error) {
        console.error('Error saving menu:', error);
        alert('Error saving menu');
    }
}

async function deleteMenu(menuId) {
    const menu = menus.find(m => m.id === menuId);
    if (!menu) {
        alert('Menu not found');
        return;
    }
    
    const recipeCount = menu.recipeIds ? menu.recipeIds.length : 0;
    const confirmMessage = recipeCount > 0 
        ? `Are you sure you want to delete "${menu.name}"? This will remove ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''} from this menu (the recipes themselves will not be deleted).`
        : `Are you sure you want to delete "${menu.name}"?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        await API.deleteMenu(menuId);
        console.log('✅ Menu deleted successfully');
        
        // Update local menus array
        const index = menus.findIndex(m => m.id === menuId);
        if (index !== -1) {
            menus.splice(index, 1);
        }
        
        // Refresh the menus view
        renderMenusGrid();
    } catch (error) {
        console.error('❌ Error deleting menu:', error);
        alert(`Error deleting menu: ${error.message}`);
    }
}

// Utilities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// Event listeners
filterInput.addEventListener('input', (e) => {
    renderRecipeList(e.target.value);
});

// Nav bar new recipe button
const navNewRecipeBtn = document.getElementById('navNewRecipeBtn');
if (navNewRecipeBtn) {
    navNewRecipeBtn.addEventListener('click', createNewRecipe);
}
newCollectionBtn.addEventListener('click', createNewCollection);
newCollectionBtnHome.addEventListener('click', createNewCollection);
newMenuBtn.addEventListener('click', createNewMenu);
newMenuBtnHome.addEventListener('click', createNewMenu);

// Navbar dropdown handlers
navMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navbarDropdown.classList.toggle('hidden');
    
    // Update user info in dropdown
    if (!navbarDropdown.classList.contains('hidden') && API.currentUser) {
        const dropdownUserAvatar = document.getElementById('dropdownUserAvatar');
        const dropdownUsername = document.getElementById('dropdownUsername');
        const gravatarUrl = getGravatarUrl(API.currentUser.email, 128);
        dropdownUserAvatar.src = gravatarUrl;
        dropdownUsername.textContent = `@${API.currentUser.username}`;
    }
});

dropdownCollections.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    switchToView('collections');
});

dropdownMenus.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    switchToView('menus');
});

dropdownNewRecipe.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    createNewRecipe();
});

dropdownShortcuts.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    shortcutsModal.style.display = 'flex';
});

dropdownDebug.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    showDebugModal();
});

const dropdownLogout = document.getElementById('dropdownLogout');
dropdownLogout.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    if (confirm('Are you sure you want to sign out?')) {
        handleLogout();
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!navbarDropdown.contains(e.target) && !navMenuBtn.contains(e.target)) {
        navbarDropdown.classList.add('hidden');
    }
});

menuEditBtn.addEventListener('click', enterMenuEditMode);
menuSaveBtn.addEventListener('click', saveMenuChanges);
menuCancelBtn.addEventListener('click', exitMenuEditMode);
menuDeleteBtn.addEventListener('click', () => deleteMenu(currentMenuId));
menuDeleteBtn2.addEventListener('click', () => deleteMenu(currentMenuId));
editBtn.addEventListener('click', enterEditMode);
saveBtn.addEventListener('click', saveCurrentRecipe);
deleteBtn.addEventListener('click', deleteCurrentRecipe);
deleteBtn2.addEventListener('click', deleteCurrentRecipe);
copyLinkBtn.addEventListener('click', copyRecipeLink);
addToCollectionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showCollectionModal();
});

// New collection button in dropdown
const newCollectionDropdownBtn = document.getElementById('newCollectionDropdownBtn');
newCollectionDropdownBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await createNewCollection();
    // Refresh the collection checkboxes to include the new collection
    showCollectionModal();
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!collectionsDropdown.contains(e.target) && !addToCollectionBtn.contains(e.target)) {
        collectionsDropdown.classList.add('hidden');
    }
});

// Add paste handlers for image upload
markdownTextarea.addEventListener('paste', (e) => handleImagePaste(e, markdownTextarea));
menuMarkdownTextarea.addEventListener('paste', (e) => handleImagePaste(e, menuMarkdownTextarea));

// backBtn.addEventListener('click', () => {
//     if (currentCollectionId && currentView === 'recipe-detail') {
//         loadCollectionDetail(currentCollectionId);
//     } else {
//         showHomeView();
//     }
// });

cancelBtn.addEventListener('click', () => {
    if (titleInput.value || markdownTextarea.value) {
        enterViewMode();
    } else {
        if (currentCollectionId && currentView === 'recipe-detail') {
            loadCollectionDetail(currentCollectionId);
        } else {
            showHomeView();
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore shortcuts when typing in input fields or textareas
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    // Cmd/Ctrl+S - Save (only when editing)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditMode && currentRecipeId) {
            saveCurrentRecipe();
        } else if (isMenuEditMode && currentMenuId) {
            saveMenuChanges();
        }
    }
    
    // N - New recipe (when not typing)
    if ((e.key === 'n' || e.key === 'N') && !isTyping && !isEditMode && !isMenuEditMode) {
        e.preventDefault();
        createNewRecipe();
    }
    
    // E - Edit recipe or menu (when not typing)
    if ((e.key === 'e' || e.key === 'E') && !isTyping) {
        e.preventDefault();
        if (currentRecipeId) {
            if (isEditMode) {
                saveCurrentRecipe();
            } else {
                enterEditMode();
            }
        } else if (currentMenuId) {
            if (isMenuEditMode) {
                saveMenuChanges();
            } else {
                enterMenuEditMode();
            }
        }
    }
    
    // / - Focus search (when not typing)
    if (e.key === '/' && !isTyping) {
        e.preventDefault();
        filterInput.focus();
    }
    
    // Escape - Cancel/Close
    if (e.key === 'Escape') {
        if (isEditMode && currentRecipeId) {
            enterViewMode();
        } else if (isMenuEditMode && currentMenuId) {
            exitMenuEditMode();
        } else if (!collectionsDropdown.classList.contains('hidden')) {
            collectionsDropdown.classList.add('hidden');
        }
    }
    
    // ? - Show shortcuts (when not typing)
    if (e.key === '?' && !isTyping) {
        e.preventDefault();
        shortcutsModal.style.display = 'flex';
        shortcutsModal.focus();
    }
});

// Initialize
loadAllData();

// Debug functionality
const debugModal = document.getElementById('debugModal');
const debugContent = document.getElementById('debugContent');
const debugCloseBtn = document.getElementById('debugCloseBtn');

async function showDebugModal() {
    debugModal.style.display = 'flex';
    debugModal.focus();
    debugContent.textContent = 'Loading debug info...';
    
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        
        let output = '=== FIREBASE STATUS ===\n';
        output += `Status: ${data.status}\n`;
        output += `Firebase Connected: ${data.firebase}\n`;
        output += `Firebase Failure Detected: ${data.firebaseFailure}\n`;
        output += `Timestamp: ${data.timestamp}\n\n`;
        
        output += '=== ENVIRONMENT ===\n';
        output += `Node Environment: ${data.environment.nodeEnv}\n`;
        output += `Is Vercel: ${data.environment.isVercel}\n`;
        output += `Has Project ID: ${data.environment.hasFirebaseProjectId}\n`;
        output += `Has Service Account Key: ${data.environment.hasServiceAccountKey}\n`;
        output += `Has Google App Credentials: ${data.environment.hasGoogleAppCreds}\n\n`;
        
        output += '=== INITIALIZATION LOGS ===\n';
        if (data.initLogs && data.initLogs.length > 0) {
            data.initLogs.forEach(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                output += `[${time}] [${log.level.toUpperCase()}] ${log.message}\n`;
            });
        } else {
            output += 'No initialization logs available.\n';
        }
        
        debugContent.textContent = output;
    } catch (error) {
        debugContent.textContent = `Error fetching debug info: ${error.message}`;
    }
}

debugCloseBtn?.addEventListener('click', () => {
    debugModal.style.display = 'none';
});

debugModal?.addEventListener('click', (e) => {
    if (e.target === debugModal) {
        debugModal.style.display = 'none';
    }
});

debugModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.stopPropagation();
        debugModal.style.display = 'none';
    }
    if (e.key === 'Tab') {
        // Trap focus within modal
        const focusableElements = debugModal.querySelectorAll('button');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }
});

// Shortcuts modal functionality
const shortcutsModal = document.getElementById('shortcutsModal');
const shortcutsCloseBtn = document.getElementById('shortcutsCloseBtn');

shortcutsCloseBtn?.addEventListener('click', () => {
    shortcutsModal.style.display = 'none';
});

shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) {
        shortcutsModal.style.display = 'none';
    }
});

shortcutsModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.stopPropagation();
        shortcutsModal.style.display = 'none';
    }
    if (e.key === 'Tab') {
        // Trap focus within modal
        const focusableElements = shortcutsModal.querySelectorAll('button');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }
});

// Logout functionality

async function handleLogout() {
    try {
        console.log('🔐 Logging out...');
        await auth.signOut();
        console.log('✅ Logout successful');
        
        // Clear data
        recipes = [];
        collections = [];
        menus = [];
        currentRecipeId = null;
        currentCollectionId = null;
        currentMenuId = null;
        
        // Redirect to login page
        window.location.href = '/login';
        
    } catch (error) {
        console.error('❌ Logout failed:', error);
        alert('Failed to log out: ' + error.message);
    }
}

// Logout button handler

