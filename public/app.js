// =============================================================================
// CONSTANTS
// =============================================================================

const CONSTANTS = {
    GRAVATAR_DEFAULT_SIZE: 40,
    GRAVATAR_DEFAULT_AVATAR: '00000000000000000000000000000000',
    VIEWS: {
        HOME: 'home',
        COLLECTIONS: 'collections',
        COLLECTION_DETAIL: 'collection-detail',
        RECIPE_DETAIL: 'recipe-detail',
        MENUS: 'menus',
        MENU_DETAIL: 'menu-detail'
    },
    MOBILE_BREAKPOINT: 768,
    IMAGE: {
        MAX_WIDTH: 1200,
        QUALITY: 0.8,
        MAX_SIZE_MB: 5
    }
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Centralized navigation utility for managing URL changes and browser history
 * This ensures all soft navigations are consistent and properly update the browser
 * 
 * NAVIGATION ARCHITECTURE:
 * - navigate() is the low-level primitive that ONLY updates history and title
 * - High-level view functions (showHomeView, loadRecipe, etc.) handle BOTH:
 *   1. DOM updates (showing/hiding views, rendering content)
 *   2. Calling navigate() to update URL (controlled by updateHistory parameter)
 * 
 * PATTERN: Always call high-level view functions, never call navigate() directly
 * unless you're implementing a new view function. Each view function should:
 * - Accept updateHistory parameter (default true)
 * - Update DOM first
 * - Call navigate() last if updateHistory is true
 * 
 * @param {Object} options - Navigation options
 * @param {string} options.url - The URL path to navigate to
 * @param {string} options.title - The page title
 * @param {Object} options.state - The state object for pushState
 * @param {boolean} options.replace - Use replaceState instead of pushState (default: false)
 */
function navigate(options) {
    const { url, title, state = {}, replace = false } = options;
    
    // Update document title
    document.title = title;
    
    // Update browser history
    if (replace) {
        window.history.replaceState(state, title, url);
    } else {
        window.history.pushState(state, title, url);
    }
    
    console.log(`🧭 Navigated to: ${url} (${title})`);
}

/**
 * Shows the Firebase error banner
 */
function showFirebaseErrorBanner() {
    const errorBanner = document.getElementById('firebaseErrorBanner');
    if (errorBanner) {
        errorBanner.classList.remove('hidden');
    }
}

/**
 * Hides the Firebase error banner
 */
function hideFirebaseErrorBanner() {
    const errorBanner = document.getElementById('firebaseErrorBanner');
    if (errorBanner) {
        errorBanner.classList.add('hidden');
    }
}

/**
 * Gets a Gravatar URL for an email address
 * @param {string} email - The email address
 * @param {number} size - The size of the avatar in pixels
 * @returns {string} The Gravatar URL
 */
function getGravatarUrl(email, size = CONSTANTS.GRAVATAR_DEFAULT_SIZE) {
    if (!email) {
        return `https://www.gravatar.com/avatar/${CONSTANTS.GRAVATAR_DEFAULT_AVATAR}?s=${size}&d=identicon`;
    }
    const hash = SparkMD5.hash(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

function getAvatarHtml(username, gravatarHash, size = 40) {
    const initial = username ? username.charAt(0).toUpperCase() : '?';
    
    // Use sidebar-specific class for larger avatars
    const fallbackClass = size > 40 ? 'sidebar-avatar-fallback' : 'feed-avatar-fallback';
    const imgClass = size > 40 ? 'sidebar-avatar' : 'feed-avatar';
    
    if (gravatarHash) {
        // Try Gravatar first, fall back to initials if image fails
        // Use d=identicon instead of d=404 to avoid 404 errors in console
        const gravatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=${size}&d=identicon`;
        return `<img src="${gravatarUrl}" class="${imgClass}" alt="${username}">`;
    } else {
        // No Gravatar hash, use initials
        return `<div class="${fallbackClass}">${initial}</div>`;
    }
}

// =============================================================================
// API MODULE
// =============================================================================

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
                                        // Compute gravatarHash client-side
                                        const gravatarHash = firebaseUser.email 
                                            ? SparkMD5.hash(firebaseUser.email.toLowerCase().trim())
                                            : null;
                                        
                                        this.currentUser = {
                                            username: userData.username,
                                            displayName: userData.username,
                                            email: firebaseUser.email,
                                            uid: firebaseUser.uid,
                                            isStaff: userData.isStaff || false,
                                            gravatarHash: gravatarHash, // Computed gravatarHash
                                            following: userData.following || [],
                                            followers: userData.followers || []
                                        };
                                        console.log('👤 Logged in as (Firestore):', this.currentUser.username, `(${this.currentUser.email})`, this.currentUser.isStaff ? '🛠️ Staff' : '', 'gravatarHash:', gravatarHash ? 'computed' : 'none');
                                        
                                        // Show sidebar for authenticated user
                                        const sidebar = document.getElementById('sidebar');
                                        if (sidebar) {
                                            sidebar.classList.remove('hidden');
                                            console.log('✅ Sidebar shown (authenticated user)');
                                        }
                                        
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
                            
                            // Compute gravatarHash client-side
                            const gravatarHash = firebaseUser.email 
                                ? SparkMD5.hash(firebaseUser.email.toLowerCase().trim())
                                : null;
                            
                            if (matchedUser) {
                                this.currentUser = {
                                    username: matchedUser.username,
                                    displayName: matchedUser.username,
                                    email: firebaseUser.email,
                                    uid: firebaseUser.uid,
                                    gravatarHash: gravatarHash
                                };
                                console.log('👤 Logged in as (server match):', this.currentUser.username, `(${this.currentUser.email})`);
                            } else {
                                // Extract username from email as fallback (development mode)
                                const username = firebaseUser.email.split('@')[0].replace(/[^a-z0-9_-]/g, '');
                                this.currentUser = {
                                    username: username,
                                    displayName: username,
                                    email: firebaseUser.email,
                                    uid: firebaseUser.uid,
                                    gravatarHash: gravatarHash
                                };
                                console.log('👤 Logged in as (email fallback):', this.currentUser.username, `(${this.currentUser.email})`);
                            }
                            
                            // Show sidebar for authenticated user
                            const sidebar = document.getElementById('sidebar');
                            if (sidebar) {
                                sidebar.classList.remove('hidden');
                                console.log('✅ Sidebar shown (authenticated user)');
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
                        console.log('❌ No user authenticated');
                        this.currentUser = null;
                        this.authInitialized = true;
                        
                        // Hide sidebar when not logged in
                        const sidebar = document.getElementById('sidebar');
                        if (sidebar) {
                            sidebar.classList.add('hidden');
                            console.log('🚫 Sidebar hidden (no authenticated user)');
                        }
                        
                        // Check if we're on a username-prefixed URL (e.g. /andri/recipe/...)
                        const path = window.location.pathname;
                        const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
                        
                        if (usernameMatch) {
                            // Allow viewing someone's content while logged out
                            const username = usernameMatch[1];
                            this.viewingUser = username;
                            console.log('👁️  Viewing user while logged out:', username);
                            resolve();
                        } else {
                            // Only redirect to login if on root path or protected routes
                            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                                console.log('↩️  Redirecting to login (no user context)');
                                window.location.href = '/login';
                            }
                            resolve();
                        }
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
            // Show error banner for server errors
            if (res.status >= 500) {
                showFirebaseErrorBanner();
            }
            const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            const errorObj = new Error(error.error || `Request failed with status ${res.status}`);
            errorObj.status = res.status;
            errorObj.userNotFound = res.status === 404 && error.error === 'User not found';
            throw errorObj;
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
    
    async getAuthenticatedUserRecipes() {
        if (!this.currentUser) return [];
        console.log('🔄 Fetching authenticated user recipes for sidebar...');
        const res = await fetch(`/api/${this.currentUser.username}/recipes`);
        const data = await this.handleResponse(res);
        console.log('✅ Received authenticated user recipes:', data.length, 'items');
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
    },
    
    // Follow/Unfollow API methods
    async followUser(targetUserId, targetUsername) {
        console.log('🔄 Following user:', targetUserId, targetUsername);
        const res = await fetch(`/api/users/${targetUserId}/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUserId: this.currentUser.uid })
        });
        const data = await this.handleResponse(res);
        // Update local following array (using UID, not username)
        if (this.currentUser && !this.currentUser.following.includes(targetUserId)) {
            this.currentUser.following.push(targetUserId);
        }
        console.log('✅ Followed user');
        return data;
    },
    
    async unfollowUser(targetUserId, targetUsername) {
        console.log('🔄 Unfollowing user:', targetUserId, targetUsername);
        const res = await fetch(`/api/users/${targetUserId}/follow`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUserId: this.currentUser.uid })
        });
        const data = await this.handleResponse(res);
        // Update local following array (using UID, not username)
        if (this.currentUser) {
            this.currentUser.following = this.currentUser.following.filter(u => u !== targetUserId);
        }
        console.log('✅ Unfollowed user');
        return data;
    },
    
    // Feed API method
    async getFeed() {
        console.log('🔄 Fetching activity feed...');
        const res = await fetch(`/api/feed?userId=${this.currentUser.uid}`);
        const data = await this.handleResponse(res);
        console.log('✅ Received feed:', data.length, 'activities');
        return data;
    }
};

// Data management
// =============================================================================
// STATE MANAGEMENT
// =============================================================================

const State = {
    recipes: [],
    authenticatedUserRecipes: [],  // Always the logged-in user's recipes (for sidebar)
    viewingUserRecipes: [],         // The profile owner's recipes (for main content)
    collections: [],
    menus: [],
    currentRecipeId: null,
    currentCollectionId: null,
    currentMenuId: null,
    currentView: 'home',
    isEditMode: true,
    isMenuEditMode: false,
    users: []
};

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const DOM = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    filterInput: document.getElementById('filterInput'),
    recipeList: document.getElementById('recipeList'),
    
    // Navbar
    navbar: document.getElementById('navbar'),
    homeBtn: document.getElementById('homeBtn'),
    navMenuBtn: document.getElementById('navMenuBtn'),
    navSearchBtn: document.getElementById('navSearchBtn'),
    navbarDropdown: document.getElementById('navbarDropdown'),
    navCollectionsBtn: document.getElementById('navCollectionsBtn'),
    
    // Profile action buttons
    profileTopBar: document.getElementById('profileTopBar'),
    profileActions: document.getElementById('profileActions'),
    profileSearchBtn: document.getElementById('profileSearchBtn'),
    profileSettingsBtn: document.getElementById('profileSettingsBtn'),
    profileMenuBtn: document.getElementById('profileMenuBtn'),
    desktopSidebarToggle: document.getElementById('desktopSidebarToggle'),
    mobileSidebarToggle: document.getElementById('mobileSidebarToggle'),
    
    // Mobile bottom navigation
    mobileBottomNav: document.getElementById('mobileBottomNav'),
    bottomNavFeed: document.getElementById('bottomNavFeed'),
    bottomNavSearch: document.getElementById('bottomNavSearch'),
    bottomNavNew: document.getElementById('bottomNavNew'),
    bottomNavCollections: document.getElementById('bottomNavCollections'),
    bottomNavProfile: document.getElementById('bottomNavProfile'),
    
    // Navbar dropdown
    dropdownCollections: document.getElementById('dropdownCollections'),
    dropdownMenus: document.getElementById('dropdownMenus'),
    dropdownNewRecipe: document.getElementById('dropdownNewRecipe'),
    dropdownShortcuts: document.getElementById('dropdownShortcuts'),
    dropdownDebug: document.getElementById('dropdownDebug'),
    
    // Views
    homeView: document.getElementById('homeView'),
    collectionsView: document.getElementById('collectionsView'),
    collectionDetailView: document.getElementById('collectionDetailView'),
    menusView: document.getElementById('menusView'),
    menuDetailView: document.getElementById('menuDetailView'),
    recipeDetailView: document.getElementById('recipeDetailView'),
    emptyState: document.getElementById('emptyState'),
    
    // Collections
    collectionsGrid: document.getElementById('collectionsGrid'),
    collectionsGridHome: document.getElementById('collectionsGridHome'),
    collectionsGridProfile: document.getElementById('collectionsGridProfile'),
    newCollectionBtn: document.getElementById('newCollectionBtn'),
    newCollectionBtnHome: document.getElementById('newCollectionBtnHome'),
    newCollectionBtnProfile: document.getElementById('newCollectionBtnProfile'),
    collectionTitle: document.getElementById('collectionTitle'),
    collectionDescription: document.getElementById('collectionDescription'),
    collectionRecipes: document.getElementById('collectionRecipes'),
    
    // Menus
    menusGrid: document.getElementById('menusGrid'),
    menusGridHome: document.getElementById('menusGridHome'),
    menusGridProfile: document.getElementById('menusGridProfile'),
    newMenuBtn: document.getElementById('newMenuBtn'),
    newMenuBtnHome: document.getElementById('newMenuBtnHome'),
    newMenuBtnProfile: document.getElementById('newMenuBtnProfile'),
    menuTitleInput: document.getElementById('menuTitleInput'),
    menuTitleDisplay: document.getElementById('menuTitleDisplay'),
    menuDescriptionInput: document.getElementById('menuDescriptionInput'),
    menuDescriptionDisplay: document.getElementById('menuDescriptionDisplay'),
    menuMarkdownTextarea: document.getElementById('menuMarkdownTextarea'),
    menuPreviewContent: document.getElementById('menuPreviewContent'),
    menuActions: document.getElementById('menuActions'),
    
    // Recipe
    recipesGridProfile: document.getElementById('recipesGridProfile'),
    newRecipeBtnProfile: document.getElementById('newRecipeBtnProfile'),
    titleInput: document.getElementById('titleInput'),
    titleDisplay: document.getElementById('titleDisplay'),
    markdownTextarea: document.getElementById('markdownTextarea'),
    previewContent: document.getElementById('previewContent'),
    breadcrumb: document.getElementById('breadcrumb'),
    menuBreadcrumb: document.getElementById('menuBreadcrumb'),
    collectionsViewBreadcrumb: document.getElementById('collectionsViewBreadcrumb'),
    menusViewBreadcrumb: document.getElementById('menusViewBreadcrumb'),
    
    // Follow Modal
    followModal: document.getElementById('followModal'),
    followModalClose: document.getElementById('followModalClose'),
    followingList: document.getElementById('followingList'),
    followersList: document.getElementById('followersList'),
    followModalEmpty: document.getElementById('followModalEmpty')
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Skeleton UI helpers
const SkeletonUI = {
    hide(element) {
        if (element) {
            const skeleton = element.querySelector('.sidebar-skeleton, .home-skeleton');
            if (skeleton) skeleton.remove();
        }
    },
    
    removeClasses(element, ...classes) {
        if (element) {
            classes.forEach(cls => element.classList.remove(cls));
        }
    },
    
    showContent(contentElement, skeletonElement) {
        if (skeletonElement) skeletonElement.classList.add('hidden');
        if (contentElement) contentElement.classList.remove('hidden');
    }
};

// Modal utilities for reusable modal behavior
const ModalUtils = {
    // Store active modal and its close callback
    activeModal: null,
    closeCallback: null,
    
    // Open a modal with focus trapping and escape handling
    open(modalElement, closeCallback) {
        if (!modalElement) return;
        
        this.activeModal = modalElement;
        this.closeCallback = closeCallback;
        
        modalElement.classList.remove('hidden');
        
        // Focus first focusable element
        setTimeout(() => {
            const firstFocusable = this.getFocusableElements(modalElement)[0];
            if (firstFocusable) firstFocusable.focus();
        }, 0);
        
        // Add event listeners
        if (!modalElement._modalListenersAdded) {
            modalElement.addEventListener('keydown', (e) => this.handleKeydown(e, modalElement));
            modalElement.addEventListener('click', (e) => {
                // Close on overlay click
                if (e.target === modalElement) {
                    this.close();
                }
            });
            modalElement._modalListenersAdded = true;
        }
    },
    
    // Close the active modal
    close() {
        if (this.activeModal) {
            this.activeModal.classList.add('hidden');
            if (this.closeCallback) {
                this.closeCallback();
            }
            this.activeModal = null;
            this.closeCallback = null;
        }
    },
    
    // Handle keydown events (Escape and Tab)
    handleKeydown(e, modalElement) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            this.close();
            return;
        }
        
        if (e.key === 'Tab') {
            this.trapFocus(e, modalElement);
        }
    },
    
    // Trap focus within modal
    trapFocus(e, modalElement) {
        const focusableElements = this.getFocusableElements(modalElement);
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    },
    
    // Get all focusable elements in modal
    getFocusableElements(modalElement) {
        const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.from(modalElement.querySelectorAll(selector));
    }
};

// Backwards compatibility - create global references
let recipes = State.recipes;
let collections = State.collections;
let menus = State.menus;
let currentRecipeId = State.currentRecipeId;
let currentCollectionId = State.currentCollectionId;
let currentMenuId = State.currentMenuId;
let currentView = State.currentView;
let isEditMode = State.isEditMode;
let isMenuEditMode = State.isMenuEditMode;

const sidebar = DOM.sidebar;
const sidebarToggle = DOM.sidebarToggle;
const filterInput = DOM.filterInput;
const recipeList = DOM.recipeList;
const navbar = DOM.navbar;
const homeBtn = DOM.homeBtn;
const homeView = DOM.homeView;
const collectionsView = DOM.collectionsView;
const collectionDetailView = DOM.collectionDetailView;
const menusView = DOM.menusView;
const recipeDetailView = DOM.recipeDetailView;
const emptyState = DOM.emptyState;
const collectionsGrid = DOM.collectionsGrid;
const collectionsGridHome = DOM.collectionsGridHome;
const newCollectionBtn = DOM.newCollectionBtn;
const newCollectionBtnHome = DOM.newCollectionBtnHome;
const navCollectionsBtn = DOM.navCollectionsBtn;
const collectionTitle = DOM.collectionTitle;
const collectionDescription = DOM.collectionDescription;
const collectionRecipes = DOM.collectionRecipes;
const menusGrid = DOM.menusGrid;
const menusGridHome = DOM.menusGridHome;
const newMenuBtn = DOM.newMenuBtn;
const newMenuBtnHome = DOM.newMenuBtnHome;
const navMenuBtn = DOM.navMenuBtn;
const navbarDropdown = DOM.navbarDropdown;
const dropdownCollections = DOM.dropdownCollections;
const dropdownMenus = DOM.dropdownMenus;
const dropdownNewRecipe = DOM.dropdownNewRecipe;
// const dropdownShortcuts = DOM.dropdownShortcuts; // Removed - shortcuts disabled
const dropdownDebug = DOM.dropdownDebug;
const titleInput = DOM.titleInput;
const titleDisplay = DOM.titleDisplay;
const markdownTextarea = DOM.markdownTextarea;
const previewContent = DOM.previewContent;
const breadcrumb = DOM.breadcrumb;
const menuDetailView = DOM.menuDetailView;
const menuTitleInput = DOM.menuTitleInput;
const menuTitleDisplay = DOM.menuTitleDisplay;
const menuDescriptionInput = DOM.menuDescriptionInput;
const menuDescriptionDisplay = DOM.menuDescriptionDisplay;
const menuMarkdownTextarea = DOM.menuMarkdownTextarea;
const menuPreviewContent = DOM.menuPreviewContent;

// Initialize EasyMDE editors
let recipeEditor = null;
let menuEditor = null;

function initializeRecipeEditor() {
    if (recipeEditor) {
        recipeEditor.toTextArea();
        recipeEditor = null;
    }
    
    recipeEditor = new EasyMDE({
        element: markdownTextarea,
        spellChecker: false,
        status: false,
        toolbar: [
            'bold', 'italic', 'strikethrough', '|',
            'heading-1', 'heading-2', 'heading-3', '|',
            'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'image', '|',
            'preview', 'side-by-side', 'fullscreen', '|',
            'guide'
        ],
        autoDownloadFontAwesome: false,
        hideIcons: ['side-by-side'], // Hide side-by-side for cleaner UI
        placeholder: 'Write your recipe in markdown...',
        minHeight: '500px',
        sideBySideFullscreen: false,
    });
    
    // Sync changes back to the original textarea
    recipeEditor.codemirror.on('change', () => {
        markdownTextarea.value = recipeEditor.value();
    });
}

function initializeMenuEditor() {
    if (menuEditor) {
        menuEditor.toTextArea();
        menuEditor = null;
    }
    
    menuEditor = new EasyMDE({
        element: menuMarkdownTextarea,
        spellChecker: false,
        status: false,
        toolbar: [
            'bold', 'italic', 'strikethrough', '|',
            'heading-1', 'heading-2', 'heading-3', '|',
            'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'image', '|',
            'preview', 'side-by-side', 'fullscreen', '|',
            'guide'
        ],
        autoDownloadFontAwesome: false,
        hideIcons: ['side-by-side'],
        placeholder: 'Write your menu in markdown...',
        minHeight: '500px',
        sideBySideFullscreen: false,
    });
    
    // Sync changes back to the original textarea
    menuEditor.codemirror.on('change', () => {
        menuMarkdownTextarea.value = menuEditor.value();
    });
}

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


// Auto-collapse sidebar on narrow screens
// Auto-collapse sidebar on narrow screens
function handleResize() {
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    } else {
        // On wider screens, restore saved state
        const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (wasCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }
}

// Initial check and resize listener
handleResize();
window.addEventListener('resize', handleResize);

// Close sidebar when clicking outside on narrow screens
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const filterInput = document.getElementById('filterInput');
        
        if (!sidebar || !sidebarToggle || !filterInput) return;
        
        const isClickInsideSidebar = sidebar.contains(e.target);
        const isToggleButton = sidebarToggle.contains(e.target);
        const isSearchInput = filterInput.contains(e.target);
        
        if (!isClickInsideSidebar && !isToggleButton && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
        }
    }
});


// Viewing user link (sidebar) - navigate to their home page
const authenticatedUserLink = document.getElementById('authenticatedUser');
if (authenticatedUserLink) {
    authenticatedUserLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Navigate to authenticated user's home page
        if (API.currentUser) {
            API.viewingUser = API.currentUser.username;
            navigate({
                url: `/${API.currentUser.username}`,
                title: `@${API.currentUser.username} - Sous`,
                state: null
            });
            // Reload data to switch context back to own profile
            loadAllData().then(() => showHomeView());
        }
    });
}

// Update edit controls visibility based on ownership
function updateEditControls() {
    const isOwner = API.viewingUser === API.currentUser?.username;
    const isLoggedIn = !!API.currentUser;
    
    // Profile actions: show only on home view when viewing own profile
    const homeView = document.getElementById('homeView');
    const isOnHomePage = homeView && !homeView.classList.contains('hidden');
    
    console.log('🔍 updateEditControls:', {
        isOnHomePage,
        isOwner,
        isLoggedIn,
        viewingUser: API.viewingUser,
        currentUser: API.currentUser?.username,
        homeViewHidden: homeView?.classList.contains('hidden')
    });
    
    if (DOM.profileTopBar && DOM.profileActions) {
        if (isLoggedIn && isOwner && isOnHomePage) {
            console.log('✅ Showing profile actions');
            DOM.profileTopBar.classList.remove('hidden');
            DOM.profileActions.classList.remove('hidden');
        } else {
            console.log('❌ Hiding profile actions');
            DOM.profileTopBar.classList.add('hidden');
            DOM.profileActions.classList.add('hidden');
        }
    }
    
    // Mobile sidebar toggle: show on home page when logged in
    if (DOM.mobileSidebarToggle) {
        if (isLoggedIn && isOnHomePage) {
            DOM.mobileSidebarToggle.classList.remove('hidden');
        } else {
            DOM.mobileSidebarToggle.classList.add('hidden');
        }
    }
    
    // Sidebar toggle: show when logged in, hide when logged out
    if (sidebarToggle) {
        if (isLoggedIn) {
            sidebarToggle.classList.remove('hidden');
        } else {
            sidebarToggle.classList.add('hidden');
        }
    }
    
    // Desktop sidebar toggle: show when logged in
    if (DOM.desktopSidebarToggle) {
        if (isLoggedIn) {
            DOM.desktopSidebarToggle.classList.remove('hidden');
        } else {
            DOM.desktopSidebarToggle.classList.add('hidden');
        }
    }
    
    // Mobile bottom navigation: show when logged in
    updateMobileBottomNav();
    
    // Navbar: show menu button and search if logged in, sign in button if logged out
    const navMenuBtn = document.getElementById('navMenuBtn');
    const navMenuBtnWrapper = document.getElementById('navMenuBtnWrapper');
    const navSearchBtn = document.getElementById('navSearchBtn');
    const navSignInBtn = document.getElementById('navSignInBtn');
    
    console.log('🔧 updateEditControls: isLoggedIn=', isLoggedIn, 'currentUser=', API.currentUser?.username);
    
    if (navSearchBtn) navSearchBtn.style.display = isLoggedIn ? 'block' : 'none';
    
    if (navMenuBtn && navMenuBtnWrapper) {
        navMenuBtnWrapper.style.display = isLoggedIn ? 'block' : 'none';
        // Set Gravatar on navbar avatar button using cached gravatarHash
        if (isLoggedIn && API.currentUser) {
            // Clear any existing fallback
            const existingFallback = navMenuBtnWrapper.querySelector('.nav-avatar-fallback');
            if (existingFallback) existingFallback.remove();
            
            const gravatarHash = API.currentUser.gravatarHash;
            console.log('👤 Nav avatar gravatarHash:', gravatarHash ? 'has hash' : 'no hash');
            
            // Helper function to create and attach fallback
            const createFallback = () => {
                const existingFallback = navMenuBtnWrapper.querySelector('.nav-avatar-fallback');
                if (existingFallback) return; // Already exists
                
                const initial = API.currentUser.username.charAt(0).toUpperCase();
                const fallback = document.createElement('div');
                fallback.className = 'nav-avatar-fallback';
                fallback.textContent = initial;
                fallback.setAttribute('aria-label', 'Menu');
                fallback.setAttribute('aria-expanded', 'false');
                fallback.addEventListener('click', (e) => {
                    console.log('🖱️ Fallback avatar clicked');
                    e.stopPropagation();
                    const dropdown = document.getElementById('navbarDropdown');
                    if (dropdown) {
                        dropdown.classList.toggle('hidden');
                        fallback.setAttribute('aria-expanded', !dropdown.classList.contains('hidden'));
                    }
                });
                navMenuBtnWrapper.appendChild(fallback);
            };
            
            if (gravatarHash) {
                const gravatarUrl = `https://www.gravatar.com/avatar/${gravatarHash}?s=56&d=404`;
                navMenuBtn.src = gravatarUrl;
                navMenuBtn.style.display = 'block';
                // Handle 404 - show initials fallback
                navMenuBtn.onerror = () => {
                    console.log('⚠️ Gravatar 404, showing fallback');
                    navMenuBtn.style.display = 'none';
                    createFallback();
                };
            } else {
                // No Gravatar hash, show initials directly
                console.log('📝 No hash, creating fallback');
                navMenuBtn.style.display = 'none';
                createFallback();
            }
        }
    }
    if (navSignInBtn) navSignInBtn.style.display = isLoggedIn ? 'none' : 'block';
    
    // Recipe edit/delete controls
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const deleteBtn2 = document.getElementById('deleteBtn2');
    const addToCollectionBtn = document.getElementById('addToCollectionBtn');
    
    if (editBtn) editBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (deleteBtn2) deleteBtn2.style.display = isOwner ? 'inline-flex' : 'none';
    if (addToCollectionBtn) addToCollectionBtn.style.display = isOwner ? 'inline-flex' : 'none';
    
    // Menu edit/delete controls
    const menuEditBtn = document.getElementById('menuEditBtn');
    const menuDeleteBtn = document.getElementById('menuDeleteBtn');
    const menuDeleteBtn2 = document.getElementById('menuDeleteBtn2');
    
    if (menuEditBtn) menuEditBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (menuDeleteBtn) menuDeleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
    if (menuDeleteBtn2) menuDeleteBtn2.style.display = isOwner ? 'inline-flex' : 'none';
    
    // "New Recipe" menu item - always visible when logged in
    const dropdownNewRecipe = document.getElementById('dropdownNewRecipe');
    if (dropdownNewRecipe) {
        dropdownNewRecipe.style.display = isLoggedIn ? 'block' : 'none';
    }
    
    // Debug menu item (staff only)
    const dropdownDebug = document.getElementById('dropdownDebug');
    if (dropdownDebug) {
        dropdownDebug.style.display = API.currentUser?.isStaff ? 'block' : 'none';
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
    
    console.log(`🔒 Edit controls ${isOwner ? 'shown' : 'hidden'} (viewing: ${API.viewingUser}, owner: ${API.currentUser?.username}, logged in: ${isLoggedIn})`);
}

// Update user display in navbar
async function updateUserDisplay() {
    // Update current user avatar in navbar (right side)
    const currentUserAvatar = document.getElementById('currentUserAvatar');
    if (currentUserAvatar && API.currentUser) {
        // Show loading placeholder
        currentUserAvatar.style.background = '#e0e0e0';
        const gravatarUrl = getGravatarUrl(API.currentUser.email, 128);
        currentUserAvatar.src = gravatarUrl;
        currentUserAvatar.title = `Logged in as @${API.currentUser.username}`;
        // Remove placeholder once loaded
        currentUserAvatar.onload = () => { currentUserAvatar.style.background = 'transparent'; };
    }
    
    // Update authenticated user in sidebar (shows your recipes)
    const authenticatedUserAvatar = document.getElementById('authenticatedUserAvatar');
    const authenticatedUsername = document.getElementById('authenticatedUsername');
    
    // Remove skeleton classes and convert div to img when updating
    if (authenticatedUserAvatar) {
        authenticatedUserAvatar.classList.remove('skeleton-avatar');
        
        // If it's a div, convert it to an img element
        if (authenticatedUserAvatar.tagName === 'DIV') {
            const img = document.createElement('img');
            img.id = 'authenticatedUserAvatar';
            img.className = 'user-avatar';
            img.alt = 'Your recipes';
            // Start with skeleton color to match ghost loading state
            img.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; background: #f5f5f5;';
            // Set a 1x1 transparent placeholder to prevent broken image icon
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            authenticatedUserAvatar.parentNode.replaceChild(img, authenticatedUserAvatar);
            // Update reference
            const newAuthenticatedUserAvatar = document.getElementById('authenticatedUserAvatar');
            
            if (newAuthenticatedUserAvatar && authenticatedUsername && API.currentUser) {
                loadAuthenticatedUserAvatar(newAuthenticatedUserAvatar, authenticatedUsername);
            }
        } else {
            if (authenticatedUserAvatar && authenticatedUsername && API.currentUser) {
                loadAuthenticatedUserAvatar(authenticatedUserAvatar, authenticatedUsername);
            }
        }
    }
    
    // Remove skeleton class from username using helper
    SkeletonUI.removeClasses(authenticatedUsername, 'skeleton-text');
    
    // Update sidebar follower stats
    await updateSidebarFollowStats();
    
    // Update edit controls visibility based on ownership
    updateEditControls();
}

async function updateSidebarFollowStats() {
    const sidebarFollowSection = document.getElementById('sidebarFollowSection');
    const sidebarFollowingCount = document.getElementById('sidebarFollowingCount');
    const sidebarFollowersCount = document.getElementById('sidebarFollowersCount');
    
    if (!sidebarFollowSection || !API.currentUser) return;
    
    try {
        const res = await fetch(`/api/${API.currentUser.username}/user`);
        if (res.ok) {
            const userData = await res.json();
            
            if (sidebarFollowingCount) sidebarFollowingCount.textContent = userData.followingCount || 0;
            if (sidebarFollowersCount) sidebarFollowersCount.textContent = userData.followersCount || 0;
            
            sidebarFollowSection.classList.remove('hidden');
        } else {
            sidebarFollowSection.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading sidebar follow stats:', error);
        sidebarFollowSection.classList.add('hidden');
    }
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
// Show collections list view
function showCollectionsView(updateHistory = true) {
    const username = API.viewingUser || API.currentUser?.username;
    
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    // Update navbar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (!collectionsView) {
        console.error('collectionsView element not found');
        return;
    }
    collectionsView.classList.remove('hidden');
    collectionsView.classList.add('active');
    if (homeBtn) homeBtn.classList.add('active');
    
    currentView = 'collections';
    renderCollectionsGrid();
    
    // Render breadcrumb
    const collectionsViewBreadcrumb = DOM.collectionsViewBreadcrumb;
    if (collectionsViewBreadcrumb) {
        collectionsViewBreadcrumb.innerHTML = `
            <a href="/${username}" class="breadcrumb-link">@${username}</a>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">Collections</span>
        `;
        collectionsViewBreadcrumb.classList.remove('hidden');
        
        // Add click handler to username link
        const breadcrumbLink = collectionsViewBreadcrumb.querySelector('.breadcrumb-link');
        breadcrumbLink?.addEventListener('click', (e) => {
            e.preventDefault();
            showHomeView();
        });
    }
    
    updateEditControls();
    
    if (updateHistory) {
        navigate({
            url: `/${username}/collections`,
            title: `Collections - @${username} - Sous`,
            state: { type: 'collections', username }
        });
    }
}

// Show menus list view
function showMenusView(updateHistory = true) {
    const username = API.viewingUser || API.currentUser?.username;
    
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    // Update navbar
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (!menusView) {
        console.error('menusView element not found');
        return;
    }
    menusView.classList.remove('hidden');
    menusView.classList.add('active');
    
    currentView = 'menus';
    renderMenusGrid();
    
    // Render breadcrumb
    const menusViewBreadcrumb = DOM.menusViewBreadcrumb;
    if (menusViewBreadcrumb) {
        menusViewBreadcrumb.innerHTML = `
            <a href="/${username}" class="breadcrumb-link">@${username}</a>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">Menus</span>
        `;
        menusViewBreadcrumb.classList.remove('hidden');
        
        // Add click handler to username link
        const breadcrumbLink = menusViewBreadcrumb.querySelector('.breadcrumb-link');
        breadcrumbLink?.addEventListener('click', (e) => {
            e.preventDefault();
            showHomeView();
        });
    }
    
    updateEditControls();
    
    if (updateHistory) {
        navigate({
            url: `/${username}/menus`,
            title: `Menus - @${username} - Sous`,
            state: { type: 'menus', username }
        });
    }
}

// Helper to show collection detail view (just DOM, no navigation)
function showCollectionDetailView() {
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    if (!collectionDetailView) {
        console.error('collectionDetailView element not found');
        return;
    }
    collectionDetailView.classList.remove('hidden');
    collectionDetailView.classList.add('active');
    if (homeBtn) homeBtn.classList.add('active');
    currentView = 'collection-detail';
}

// Helper to show menu detail view (just DOM, no navigation)
function showMenuDetailView() {
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    if (!menuDetailView) {
        console.error('menuDetailView element not found');
        return;
    }
    menuDetailView.classList.remove('hidden');
    menuDetailView.classList.add('active');
    currentView = 'menu-detail';
}

// Helper to show recipe detail view (just DOM, no navigation)
function showRecipeDetailView() {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    if (!recipeDetailView) {
        console.error('recipeDetailView element not found');
        return;
    }
    recipeDetailView.classList.remove('hidden');
    recipeDetailView.classList.add('active');
    currentView = 'recipe-detail';
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
        navigate({
            url: `/${username}`,
            title: `@${username} - Sous`,
            state: null
        });
        return;
    }
    
    if (type === 'recipe') {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        const slug = recipe.title ? slugify(recipe.title) : 'untitled';
        const title = `${recipe.title || 'Untitled'} - @${username} - Sous`;
        navigate({
            url: `/${username}/recipe/${slug}-${id}`,
            title,
            state: { type: 'recipe', id }
        });
    } else if (type === 'collection') {
        const collection = collections.find(c => c.id === id);
        if (!collection) return;
        const slug = slugify(collection.name);
        const title = `${collection.name} - @${username} - Sous`;
        navigate({
            url: `/${username}/collection/${slug}-${id}`,
            title,
            state: { type: 'collection', id }
        });
    } else if (type === 'menu') {
        const menu = menus.find(m => m.id === id);
        if (!menu) return;
        const slug = slugify(menu.name);
        const title = `${menu.name} - @${username} - Sous`;
        navigate({
            url: `/${username}/menu/${slug}-${id}`,
            title,
            state: { type: 'menu', id }
        });
    }
}

function loadFromURL() {
    const path = window.location.pathname;
    console.log('🔗 Loading from URL:', path);
    console.log('🔐 Current user:', API.currentUser?.username);
    console.log('👀 Viewing user:', API.viewingUser);
    
    // Handle reserved paths
    if (path === '/login' || path === '/signup' || path === '/logout') {
        console.log('🚫 Reserved path, not loading app');
        return;
    }
    
    // Handle search page
    if (path === '/search') {
        console.log('🔍 Search page detected');
        if (API.currentUser) {
            showSearchView();
        } else {
            console.log('⚠️ User not logged in, redirecting to login');
            window.location.href = '/login';
        }
        return;
    }
    
    // Handle root path first
    if (path === '/') {
        console.log('📍 Root path detected');
        if (API.currentUser) {
            // Logged-in users see feed at root
            console.log('✅ User is logged in, showing feed');
            showFeedView();
        } else {
            // Logged-out users redirected to login
            console.log('⚠️ User not logged in, redirecting to login');
            window.location.href = '/login';
        }
        return;
    }
    
    console.log('📍 Non-root path, checking patterns...');
    
    // Match username-prefixed URLs (username can contain lowercase letters, numbers, hyphens, underscores)
    const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
    if (usernameMatch) {
        const username = usernameMatch[1];
        console.log('👤 Username matched from URL:', username);
        // Set viewing user from URL (validation happens in loadAllData)
        API.viewingUser = username;
    }
    
    const recipeMatch = path.match(/^\/[a-z0-9_-]+\/recipe\/.+-([a-zA-Z0-9]+)$/);
    const collectionMatch = path.match(/^\/[a-z0-9_-]+\/collection\/.+-([a-zA-Z0-9]+)$/);
    const menuMatch = path.match(/^\/[a-z0-9_-]+\/menu\/.+-([a-zA-Z0-9]+)$/);
    const collectionsPageMatch = path.match(/^\/[a-z0-9_-]+\/collections$/);
    const menusPageMatch = path.match(/^\/[a-z0-9_-]+\/menus$/);
    
    if (recipeMatch) {
        const id = recipeMatch[1];
        console.log('📖 Recipe match:', id);
        const recipe = recipes.find(r => r.id === id);
        if (recipe) {
            loadRecipe(id, false);
        } else {
            console.warn('⚠️ Recipe not found:', id);
        }
    } else if (collectionMatch) {
        const id = collectionMatch[1];
        console.log('📚 Collection match:', id);
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
        console.log('📚 Collections page match');
        showCollectionsView(false);
    } else if (menusPageMatch) {
        console.log('🍽️ Menus page match');
        showMenusView(false);
    } else {
        // Default to home view for username-only URLs
        console.log('🏠 Defaulting to home view');
        showHomeView();
    }
}

async function loadAuthenticatedUserAvatar(avatarElement, usernameElement) {
    if (!API.currentUser) return;
    
    try {
        const res = await fetch(`/api/${API.currentUser.username}/user`);
        if (res.ok) {
            const userData = await res.json();
            avatarElement.style.background = '#f5f5f5';
            
            if (userData.gravatarHash) {
                const gravatarUrl = `https://www.gravatar.com/avatar/${userData.gravatarHash}?s=56&d=404`;
                avatarElement.src = gravatarUrl;
                avatarElement.onload = () => { avatarElement.style.background = 'transparent'; };
                avatarElement.onerror = () => {
                    // Fallback to initials
                    avatarElement.style.display = 'none';
                    const initial = API.currentUser.username.charAt(0).toUpperCase();
                    avatarElement.insertAdjacentHTML('afterend', `<div class="sidebar-avatar-fallback">${initial}</div>`);
                };
            } else {
                // No Gravatar, show initials
                avatarElement.style.display = 'none';
                const initial = API.currentUser.username.charAt(0).toUpperCase();
                avatarElement.insertAdjacentHTML('afterend', `<div class="sidebar-avatar-fallback">${initial}</div>`);
            }
            
            usernameElement.textContent = `@${API.currentUser.username}`;
            
            // Add admin badge if user is staff
            if (API.currentUser.isStaff) {
                usernameElement.innerHTML = `@${escapeHtml(API.currentUser.username)} ${getAdminBadge(API.currentUser)}`;
            }
        } else {
            // Fallback if user not found
            avatarElement.style.display = 'none';
            const initial = API.currentUser.username.charAt(0).toUpperCase();
            avatarElement.insertAdjacentHTML('afterend', `<div class="sidebar-avatar-fallback">${initial}</div>`);
            usernameElement.textContent = `@${API.currentUser.username}`;
            
            // Add admin badge if user is staff
            if (API.currentUser.isStaff) {
                usernameElement.innerHTML = `@${escapeHtml(API.currentUser.username)} ${getAdminBadge(API.currentUser)}`;
            }
        }
    } catch (error) {
        console.error('Failed to fetch authenticated user info:', error);
        avatarElement.style.display = 'none';
        const initial = API.currentUser ? API.currentUser.username.charAt(0).toUpperCase() : '?';
        avatarElement.insertAdjacentHTML('afterend', `<div class="sidebar-avatar-fallback">${initial}</div>`);
        usernameElement.textContent = `@${API.currentUser.username}`;
        
        // Add admin badge if user is staff
        if (API.currentUser?.isStaff) {
            usernameElement.innerHTML = `@${escapeHtml(API.currentUser.username)} ${getAdminBadge(API.currentUser)}`;
        }
    }
}

function loadFromURL() {
    const path = window.location.pathname;
    console.log('🔗 Loading from URL:', path);
    console.log('🔐 Current user:', API.currentUser?.username);
    console.log('👀 Viewing user:', API.viewingUser);
    
    // Handle reserved paths
    if (path === '/login' || path === '/signup' || path === '/logout') {
        console.log('🚫 Reserved path, not loading app');
        return;
    }
    
    // Handle search page
    if (path === '/search') {
        console.log('🔍 Search page detected');
        if (API.currentUser) {
            showSearchView();
        } else {
            console.log('⚠️ User not logged in, redirecting to login');
            window.location.href = '/login';
        }
        return;
    }
    
    // Handle root path first
    if (path === '/') {
        console.log('📍 Root path detected');
        if (API.currentUser) {
            // Logged-in users see feed at root
            console.log('✅ User is logged in, showing feed');
            showFeedView();
        } else {
            // Logged-out users redirected to login
            console.log('⚠️ User not logged in, redirecting to login');
            window.location.href = '/login';
        }
        return;
    }
    
    console.log('📍 Non-root path, checking patterns...');
    
    // Match username-prefixed URLs (username can contain lowercase letters, numbers, hyphens, underscores)
    const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
    if (usernameMatch) {
        const username = usernameMatch[1];
        console.log('👤 Username matched from URL:', username);
        // Set viewing user from URL (validation happens in loadAllData)
        API.viewingUser = username;
    }
    
    const recipeMatch = path.match(/^\/[a-z0-9_-]+\/recipe\/.+-([a-zA-Z0-9]+)$/);
    const collectionMatch = path.match(/^\/[a-z0-9_-]+\/collection\/.+-([a-zA-Z0-9]+)$/);
    const menuMatch = path.match(/^\/[a-z0-9_-]+\/menu\/.+-([a-zA-Z0-9]+)$/);
    const collectionsPageMatch = path.match(/^\/[a-z0-9_-]+\/collections$/);
    const menusPageMatch = path.match(/^\/[a-z0-9_-]+\/menus$/);
    
    if (recipeMatch) {
        const id = recipeMatch[1];
        console.log('📖 Recipe match:', id);
        const recipe = recipes.find(r => r.id === id);
        if (recipe) {
            loadRecipe(id, false);
        } else {
            console.warn('⚠️ Recipe not found:', id);
        }
    } else if (collectionMatch) {
        const id = collectionMatch[1];
        console.log('📚 Collection match:', id);
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
        console.log('📚 Collections page match');
        showCollectionsView(false);
    } else if (menusPageMatch) {
        console.log('🍽️ Menus page match');
        showMenusView(false);
    } else {
        // Default to home view for username-only URLs
        console.log('🏠 Defaulting to home view');
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
            showCollectionsView(false);
        } else if (e.state.type === 'menu') {
            loadMenuDetail(e.state.id, false);
        } else if (e.state.type === 'menus') {
            showMenusView(false);
        } else if (e.state.type === 'feed') {
            showFeedView();
        }
    } else {
        const path = window.location.pathname;
        if (path === '/collections') {
            showCollectionsView(false);
        } else if (path === '/menus') {
            showMenusView(false);
        } else {
            showHomeView();
        }
    }
});

// Render collections grid
function renderCollectionsGrid() {
    const isOwner = API.viewingUser === API.currentUser?.username;
    collectionsGrid.innerHTML = collections.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        const slug = slugify(col.name);
        const url = `/${API.viewingUser}/collection/${slug}-${col.id}`;
        const actionsHtml = isOwner ? `
                    <div class="collection-card-actions">
                        <button onclick="event.preventDefault(); copyCollectionLink(event, '${col.id}')" class="collection-action-btn" title="Copy link">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                        <button onclick="event.preventDefault(); event.stopPropagation(); editCollection('${col.id}')" class="collection-action-btn" title="Edit collection">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onclick="event.preventDefault(); event.stopPropagation(); deleteCollection('${col.id}')" class="collection-action-btn" title="Delete collection">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>` : '';
        return `
            <a href="${url}" class="collection-card" data-id="${col.id}" tabindex="0">
                <div class="collection-card-header">
                    <div class="collection-card-info">
                        <h3 class="collection-card-title">${escapeHtml(col.name)}</h3>
                        <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                    </div>
                    ${actionsHtml}
                </div>
                <p class="collection-card-description">${escapeHtml(col.description || '')}</p>
            </a>
        `;
    }).join('');

    // Add click listeners
    collectionsGrid.querySelectorAll('.collection-card').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                const collectionId = card.dataset.id;
                const collection = collections.find(c => c.id === collectionId);
                const slug = slugify(collection?.name || 'untitled');
                navigate({
                    url: `/${API.viewingUser}/collection/${slug}-${collectionId}`,
                    title: collection?.name || 'Collection',
                    state: { type: 'collection', id: collectionId }
                });
                loadCollectionDetail(collectionId);
            }
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
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
    const isOwner = API.viewingUser === API.currentUser?.username;
    menusGrid.innerHTML = menus.map(menu => {
        const slug = slugify(menu.name);
        const url = `/${API.viewingUser}/menu/${slug}-${menu.id}`;
        const actionsHtml = isOwner ? `
                    <div class="collection-card-actions">
                        <button onclick="event.preventDefault(); copyMenuLink(event, '${menu.id}')" class="collection-action-btn" title="Copy link">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                        </button>
                        <button onclick="event.preventDefault(); event.stopPropagation(); loadMenuDetail('${menu.id}'); enterMenuEditMode();" class="collection-action-btn" title="Edit menu">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onclick="event.preventDefault(); event.stopPropagation(); deleteMenu('${menu.id}')" class="collection-action-btn" title="Delete menu">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1 2-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>` : '';
        return `
            <a href="${url}" class="collection-card" data-id="${menu.id}" tabindex="0">
                <div class="collection-card-header">
                    <div class="collection-card-info">
                        <h3 class="collection-card-title">${escapeHtml(menu.name)}</h3>
                    </div>
                    ${actionsHtml}
                </div>
                <p class="collection-card-description">${escapeHtml(menu.description || '')}</p>
            </a>
        `;
    }).join('');

    // Add click listeners
    menusGrid.querySelectorAll('.collection-card').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                const menuId = card.dataset.id;
                const menu = menus.find(m => m.id === menuId);
                const slug = slugify(menu?.name || 'untitled');
                navigate({
                    url: `/${API.viewingUser}/menu/${slug}-${menuId}`,
                    title: menu?.name || 'Menu',
                    state: { type: 'menu', id: menuId }
                });
                loadMenuDetail(menuId);
            }
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
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
    
    if (collections.length === 0) {
        const isOwner = API.viewingUser === API.currentUser?.username;
        collectionsGridHome.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #999; grid-column: 1 / -1;">
                <p style="margin: 0; font-size: 0.95rem;">${isOwner ? 'No collections yet — organize your recipes into collections' : 'No collections yet'}</p>
            </div>
        `;
        return;
    }
    
    collectionsGridHome.innerHTML = limitedCollections.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        const slug = slugify(col.name);
        const url = `/${API.viewingUser}/collection/${slug}-${col.id}`;
        return `
            <a href="${url}" class="collection-card collection-card-compact" data-id="${col.id}" tabindex="0">
                <div class="collection-card-info">
                    <h3 class="collection-card-title">${escapeHtml(col.name)}</h3>
                    <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                </div>
                <p class="collection-card-description">${escapeHtml(col.description || '')}</p>
            </a>
        `;
    }).join('');
    
    if (collections.length > 4) {
        collectionsGridHome.innerHTML += `
            <div class="collection-card collection-card-compact collection-card-view-all" onclick="showCollectionsView()" tabindex="0">
                <div class="view-all-content">
                    <i class="fa-solid fa-arrow-right"></i>
                    <span>View all ${collections.length} collections</span>
                </div>
            </div>
        `;
    }
    
    collectionsGridHome.querySelectorAll('.collection-card:not(.collection-card-view-all)').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            loadCollectionDetail(card.dataset.id);
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
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
    
    if (menus.length === 0) {
        const isOwner = API.viewingUser === API.currentUser?.username;
        menusGridHome.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #999; grid-column: 1 / -1;">
                <p style="margin: 0; font-size: 0.95rem;">${isOwner ? 'No menus yet — create curated menus for special occasions' : 'No menus yet'}</p>
            </div>
        `;
        return;
    }
    
    menusGridHome.innerHTML = limitedMenus.map(menu => {
        const slug = slugify(menu.name);
        const url = `/${API.viewingUser}/menu/${slug}-${menu.id}`;
        return `
            <a href="${url}" class="collection-card collection-card-compact" data-id="${menu.id}" tabindex="0">
                <div class="collection-card-info">
                    <h3 class="collection-card-title">${escapeHtml(menu.name)}</h3>
                </div>
                <p class="collection-card-description">${escapeHtml(menu.description || '')}</p>
            </a>
        `;
    }).join('');
    
    if (menus.length > 4) {
        menusGridHome.innerHTML += `
            <div class="collection-card collection-card-compact collection-card-view-all" onclick="showMenusView()" tabindex="0">
                <div class="view-all-content">
                    <i class="fa-solid fa-arrow-right"></i>
                    <span>View all ${menus.length} menus</span>
                </div>
            </div>
        `;
    }
    
    menusGridHome.querySelectorAll('.collection-card:not(.collection-card-view-all)').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            loadMenuDetail(card.dataset.id);
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
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
    // Remove skeleton on first render using helper
    SkeletonUI.hide(recipeList);
    
    // ALWAYS use authenticated user's recipes for sidebar
    const recipesToDisplay = API.currentUser ? State.authenticatedUserRecipes : [];
    
    const lowerFilter = filter.toLowerCase();
    const filtered = recipesToDisplay.filter(recipe => 
        recipe.title.toLowerCase().includes(lowerFilter) ||
        recipe.content.toLowerCase().includes(lowerFilter)
    );

    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Show welcome message for new users with no recipes
    if (recipesToDisplay.length === 0 && API.currentUser) {
        recipeList.innerHTML = `
            <div style="padding: 2rem 1rem; text-align: center; color: #999;">
                <p style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 500;">Welcome to Sous! 🎉</p>
                <p style="margin: 0; font-size: 0.875rem;">Press <kbd style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace;">N</kbd> or use the menu to create your first recipe</p>
            </div>
        `;
        return;
    }

    recipeList.innerHTML = filtered.map(recipe => {
        // Only highlight as active if we're in recipe view AND came from sidebar (no currentCollectionId)
        const isActive = currentView === 'recipe-detail' && 
                        recipe.id === currentRecipeId && 
                        !currentCollectionId;
        const slug = recipe.title ? slugify(recipe.title) : 'untitled';
        const username = API.currentUser?.username || API.viewingUser;
        const url = `/${username}/recipe/${slug}-${recipe.id}`;
        return `
            <a 
                href="${url}"
                class="recipe-item ${isActive ? 'active' : ''}" 
                data-id="${recipe.id}"
                role="listitem"
                tabindex="0">
                <div class="recipe-item-title">${escapeHtml(recipe.title || 'Untitled')}</div>
                <div class="recipe-item-date">${formatDate(recipe.updatedAt)}</div>
            </a>
        `;
    }).join('');

    recipeList.querySelectorAll('.recipe-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset collection context when loading from sidebar
            State.currentCollectionId = null;
            
            // Sidebar always shows authenticated user's recipes
            // So clicking a recipe should navigate to it using proper URL navigation
            const recipeId = item.dataset.id;
            const recipe = State.authenticatedUserRecipes.find(r => r.id === recipeId);
            if (recipe) {
                const slug = recipe.title ? slugify(recipe.title) : 'untitled';
                const username = API.currentUser?.username;
                const url = `/${username}/recipe/${slug}-${recipeId}`;
                
                // If viewing another user's profile, need to switch context and reload data
                if (API.currentUser && API.viewingUser !== API.currentUser.username) {
                    API.viewingUser = API.currentUser.username;
                    // Update URL and reload data, then load from URL
                    navigate({
                        url,
                        title: recipe?.title || 'Untitled',
                        state: { type: 'recipe', id: recipeId }
                    });
                    loadAllData().then(() => {
                        loadFromURL();
                    });
                } else {
                    // Same user, just navigate
                    navigate({
                        url,
                        title: recipe?.title || 'Untitled',
                        state: { type: 'recipe', id: recipeId }
                    });
                    loadFromURL();
                }
            }
        });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                State.currentCollectionId = null;
                
                // Sidebar always shows authenticated user's recipes
                const recipeId = item.dataset.id;
                const recipe = State.authenticatedUserRecipes.find(r => r.id === recipeId);
                if (recipe) {
                    const slug = recipe.title ? slugify(recipe.title) : 'untitled';
                    const username = API.currentUser?.username;
                    const url = `/${username}/recipe/${slug}-${recipeId}`;
                    
                    // If viewing another user's profile, need to switch context and reload data
                    if (API.currentUser && API.viewingUser !== API.currentUser.username) {
                        API.viewingUser = API.currentUser.username;
                        // Update URL and reload data, then load from URL
                        navigate({
                            url,
                            title: recipe?.title || 'Untitled',
                            state: { type: 'recipe', id: recipeId }
                        });
                        loadAllData().then(() => {
                            loadFromURL();
                        });
                    } else {
                        // Same user, just navigate
                        navigate({
                            url,
                            title: recipe?.title || 'Untitled',
                            state: { type: 'recipe', id: recipeId }
                        });
                        loadFromURL();
                    }
                }
            }
        });
    });
}

// Load collection detail
function loadCollectionDetail(id, updateUrl = true) {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;

    currentCollectionId = id;
    showCollectionDetailView();
    
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    // Update breadcrumb
    const breadcrumbName = document.getElementById('collectionBreadcrumbName');
    if (breadcrumbName) {
        breadcrumbName.textContent = collection.name;
    }
    
    // Add edit and delete buttons to collection header (only if owner)
    const collectionHeader = document.querySelector('.collection-detail-header');
    if (collectionHeader) {
        const actionsHtml = isOwner ? `
                <div class="collection-header-actions">
                    <button onclick="copyCollectionLink(event, '${collection.id}')" class="collection-action-btn" title="Copy link">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                    </button>
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
                </div>` : '';
        collectionHeader.innerHTML = `
            <div class="breadcrumb">
                <a href="/${API.viewingUser}" class="breadcrumb-link">@${API.viewingUser}</a>
                <span class="breadcrumb-separator">></span>
                <a href="/${API.viewingUser}/collections" class="breadcrumb-link">Collections</a>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-current">${escapeHtml(collection.name)}</span>
            </div>
            <div class="collection-title-section">
                <h1>${escapeHtml(collection.name)}</h1>
                ${actionsHtml}
            </div>
            <p class="collection-description">${escapeHtml(collection.description || '')}</p>
        `;
        
        // Add click handlers to breadcrumb links
        const breadcrumbLinks = collectionHeader.querySelectorAll('.breadcrumb-link');
        breadcrumbLinks[0]?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}`,
                title: `@${API.viewingUser} - Sous`,
                state: { type: 'home' }
            });
            showHomeView();
        });
        breadcrumbLinks[1]?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}/collections`,
                title: 'Collections',
                state: { type: 'collections' }
            });
            showCollectionsView();
        });
    }
    
    const collectionRecipeIds = collection.recipeIds || [];
    const collectionRecipeList = recipes.filter(r => collectionRecipeIds.includes(r.id));
    
    collectionRecipes.innerHTML = collectionRecipeList.length > 0 
        ? `<ul class="collection-recipe-list">${collectionRecipeList.map(recipe => {
            const removeButtonHtml = isOwner ? `
                <button onclick="event.stopPropagation(); removeRecipeFromCollection('${collection.id}', '${recipe.id}')" class="collection-action-btn collection-action-btn-danger" title="Remove from collection">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="3 6h18"></path>
                        <path d="19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                </button>` : '';
            
            return `
            <li class="collection-recipe-item" data-id="${recipe.id}" tabindex="0" onclick="loadRecipeFromCollection('${recipe.id}')">
                <span class="recipe-link">${escapeHtml(recipe.title || 'Untitled')}</span>
                ${removeButtonHtml}
            </li>
        `;
        }).join('')}</ul>`
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
    showRecipeDetailView();
    
    // Close sidebar on narrow screens when recipe is clicked
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    }
    
    titleInput.value = recipe.title;
    markdownTextarea.value = recipe.content;
    
    // Handle breadcrumbs and back navigation based on source
    if (source === 'collection' && currentCollectionId) {
        const collection = collections.find(c => c.id === currentCollectionId);
        const collectionSlug = slugify(collection.name);
        
        // Show full breadcrumb path
        breadcrumb.innerHTML = `
            <a href="/${API.viewingUser}" class="breadcrumb-link">@${API.viewingUser}</a>
            <span class="breadcrumb-separator">></span>
            <a href="/${API.viewingUser}/collections" class="breadcrumb-link">Collections</a>
            <span class="breadcrumb-separator">></span>
            <a href="/${API.viewingUser}/collection/${collectionSlug}-${currentCollectionId}" class="breadcrumb-link">${escapeHtml(collection.name)}</a>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">${escapeHtml(recipe.title)}</span>
        `;
        breadcrumb.classList.remove('hidden');
        
        // Add click handlers to breadcrumb links
        const breadcrumbLinks = breadcrumb.querySelectorAll('.breadcrumb-link');
        breadcrumbLinks[0]?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}`,
                title: `@${API.viewingUser} - Sous`,
                state: { type: 'home' }
            });
            showHomeView();
        });
        breadcrumbLinks[1]?.addEventListener('click', (e) => {
            e.preventDefault();
            showCollectionsView();
        });
        breadcrumbLinks[2]?.addEventListener('click', (e) => {
            e.preventDefault();
            const collection = collections.find(c => c.id === currentCollectionId);
            const slug = slugify(collection?.name || 'untitled');
            navigate({
                url: `/${API.viewingUser}/collection/${slug}-${currentCollectionId}`,
                title: collection?.name || 'Collection',
                state: { type: 'collection', id: currentCollectionId }
            });
            loadCollectionDetail(currentCollectionId);
        });
    } else {
        // Show simple breadcrumb for sidebar navigation
        breadcrumb.innerHTML = `
            <a href="/${API.viewingUser}" class="breadcrumb-link">@${API.viewingUser}</a>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">${escapeHtml(recipe.title)}</span>
        `;
        breadcrumb.classList.remove('hidden');
        
        // Add click handler to username link
        const breadcrumbLink = breadcrumb.querySelector('.breadcrumb-link');
        breadcrumbLink?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}`,
                title: `@${API.viewingUser} - Sous`,
                state: { type: 'home' }
            });
            showHomeView();
        });
    }
    
    enterViewMode();
    updateRecipeMetadata(recipe);
    renderRecipeList(filterInput.value);
    updateEditControls(); // Show/hide edit controls based on ownership
    
    // Focus on title to scroll it into view and ensure page starts at top
    titleDisplay.setAttribute('tabindex', '-1');
    titleDisplay.focus();
    titleDisplay.removeAttribute('tabindex');
    
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
    
    // Update author
    const metadataAuthor = document.getElementById('metadataAuthor');
    if (metadataAuthor && recipe.username) {
        metadataAuthor.textContent = `@${recipe.username}`;
    }
    
    // Update collections
    const recipeCollections = collections.filter(c => 
        c.recipeIds && c.recipeIds.includes(recipe.id)
    );
    
    if (recipeCollections.length === 0) {
        metadataCollections.innerHTML = '<span class="metadata-empty">None</span>';
    } else {
        metadataCollections.innerHTML = recipeCollections
            .map(c => {
                const slug = slugify(c.name);
                const url = `/${API.viewingUser}/collection/${slug}-${c.id}`;
                return `<a href="${url}" class="metadata-collection-tag">${escapeHtml(c.name)}</a>`;
            })
            .join('');
        
        // Add click handlers
        metadataCollections.querySelectorAll('.metadata-collection-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                const collectionId = tag.getAttribute('href').split('-').pop();
                loadCollectionDetail(collectionId);
            });
        });
    }
    
    // Update action buttons
    updateRecipeActionButtons(recipe);
}

// Update recipe action buttons in metadata
function updateRecipeActionButtons(recipe) {
    const metadataActions = document.getElementById('metadataActions');
    if (!metadataActions) return;
    
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    if (isEditMode) {
        // Edit mode buttons
        metadataActions.innerHTML = `
            <button id="metadataSaveBtn" class="metadata-action-btn metadata-action-btn-primary" title="Save">
                <i class="fa-solid fa-check"></i>
            </button>
            <button id="metadataCancelBtn" class="metadata-action-btn" title="Cancel">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <button id="metadataDeleteBtn" class="metadata-action-btn metadata-action-btn-danger" title="Delete">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        document.getElementById('metadataSaveBtn').onclick = saveCurrentRecipe;
        document.getElementById('metadataCancelBtn').onclick = enterViewMode;
        document.getElementById('metadataDeleteBtn').onclick = deleteCurrentRecipe;
    } else if (isOwner) {
        // View mode buttons (owner)
        metadataActions.innerHTML = `
            <button id="metadataEditBtn" class="metadata-action-btn metadata-action-btn-primary" title="Edit">
                <i class="fa-solid fa-pen"></i>
            </button>
            <div class="share-dropdown-container">
                <button id="metadataShareBtn" class="metadata-action-btn" title="Share">
                    <i class="fa-solid fa-arrow-up-from-bracket"></i>
                </button>
                <div id="shareDropdown" class="share-dropdown hidden">
                    <button class="share-dropdown-item" onclick="copyRecipeLink(event)">
                        <i class="fa-solid fa-link"></i>
                        <span>Copy Link</span>
                    </button>
                    <div class="share-dropdown-divider"></div>
                    <div class="share-dropdown-label">Copy Content As:</div>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('markdown')">
                        <i class="fa-brands fa-markdown"></i>
                        <span>Original</span>
                    </button>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('plaintext')">
                        <i class="fa-solid fa-align-left"></i>
                        <span>Plain Text</span>
                    </button>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('html')">
                        <i class="fa-brands fa-html5"></i>
                        <span>Rich Text</span>
                    </button>
                </div>
            </div>
            <button id="metadataAddToCollectionBtn" class="metadata-action-btn" title="Add to collection">
                <i class="fa-solid fa-folder-plus"></i>
            </button>
            <button id="metadataDeleteBtn2" class="metadata-action-btn metadata-action-btn-danger" title="Delete">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        document.getElementById('metadataEditBtn').onclick = enterEditMode;
        document.getElementById('metadataShareBtn').onclick = toggleShareDropdown;
        document.getElementById('metadataAddToCollectionBtn').onclick = showCollectionModal;
        document.getElementById('metadataDeleteBtn2').onclick = deleteCurrentRecipe;
    } else {
        // View mode (non-owner) - share dropdown only
        metadataActions.innerHTML = `
            <div class="share-dropdown-container">
                <button id="metadataShareBtn" class="metadata-action-btn" title="Share">
                    <i class="fa-solid fa-arrow-up-from-bracket"></i>
                </button>
                <div id="shareDropdown" class="share-dropdown hidden">
                    <button class="share-dropdown-item" onclick="copyRecipeLink(event)">
                        <i class="fa-solid fa-link"></i>
                        <span>Copy Link</span>
                    </button>
                    <div class="share-dropdown-divider"></div>
                    <div class="share-dropdown-label">Copy Content As:</div>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('markdown')">
                        <i class="fa-brands fa-markdown"></i>
                        <span>Original</span>
                    </button>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('plaintext')">
                        <i class="fa-solid fa-align-left"></i>
                        <span>Plain Text</span>
                    </button>
                    <button class="share-dropdown-item" onclick="copyRecipeContent('html')">
                        <i class="fa-brands fa-html5"></i>
                        <span>Rich Text</span>
                    </button>
                </div>
            </div>
        `;
        document.getElementById('metadataShareBtn').onclick = toggleShareDropdown;
    }
}

// Toggle share dropdown
function toggleShareDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('shareDropdown');
    if (!dropdown) return;
    
    dropdown.classList.toggle('hidden');
    
    // Close dropdown when clicking outside
    if (!dropdown.classList.contains('hidden')) {
        const closeDropdown = (e) => {
            if (!e.target.closest('.share-dropdown-container')) {
                dropdown.classList.add('hidden');
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }
}

// Update menu action buttons based on edit mode and ownership
function updateMenuActionButtons(menu) {
    const menuActions = DOM.menuActions;
    if (!menuActions) return;
    
    const isOwner = API.currentUser && API.currentUser.username === API.viewingUser;
    
    if (isMenuEditMode) {
        // Edit mode: Show save, cancel, delete buttons
        menuActions.innerHTML = `
            <button onclick="saveMenu()" class="metadata-action-btn metadata-action-btn-primary">
                <i class="fas fa-save"></i> Save
            </button>
            <button onclick="exitMenuEditMode()" class="metadata-action-btn">
                <i class="fas fa-times"></i> Cancel
            </button>
            <button onclick="deleteMenu('${menu.id}')" class="metadata-action-btn metadata-action-btn-danger">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
    } else if (isOwner) {
        // Owner view mode: Show edit, share, delete buttons
        menuActions.innerHTML = `
            <button onclick="enterMenuEditMode()" class="metadata-action-btn">
                <i class="fas fa-edit"></i> Edit
            </button>
            <div class="share-dropdown-container">
                <button onclick="toggleMenuShareDropdown(event)" class="metadata-action-btn" id="menuShareBtn">
                    <i class="fas fa-arrow-up-from-square"></i> Share
                </button>
                <div class="share-dropdown hidden" id="menuShareDropdown">
                    <button onclick="copyMenuLink(event, '${menu.id}')" class="share-dropdown-item">
                        <i class="fas fa-link"></i> Copy Link
                    </button>
                    <div class="share-dropdown-divider"></div>
                    <div class="share-dropdown-label">Copy Content As:</div>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'markdown')" class="share-dropdown-item">
                        <i class="fab fa-markdown"></i> Original
                    </button>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'plaintext')" class="share-dropdown-item">
                        <i class="fas fa-align-left"></i> Plain Text
                    </button>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'html')" class="share-dropdown-item">
                        <i class="fab fa-html5"></i> Rich Text
                    </button>
                </div>
            </div>
            <button onclick="deleteMenu('${menu.id}')" class="metadata-action-btn metadata-action-btn-danger">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
    } else {
        // Non-owner view mode: Show only share button
        menuActions.innerHTML = `
            <div class="share-dropdown-container">
                <button onclick="toggleMenuShareDropdown(event)" class="metadata-action-btn" id="menuShareBtn">
                    <i class="fas fa-arrow-up-from-square"></i> Share
                </button>
                <div class="share-dropdown hidden" id="menuShareDropdown">
                    <button onclick="copyMenuLink(event, '${menu.id}')" class="share-dropdown-item">
                        <i class="fas fa-link"></i> Copy Link
                    </button>
                    <div class="share-dropdown-divider"></div>
                    <div class="share-dropdown-label">Copy Content As:</div>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'markdown')" class="share-dropdown-item">
                        <i class="fab fa-markdown"></i> Original
                    </button>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'plaintext')" class="share-dropdown-item">
                        <i class="fas fa-align-left"></i> Plain Text
                    </button>
                    <button onclick="copyMenuContent(event, '${menu.id}', 'html')" class="share-dropdown-item">
                        <i class="fab fa-html5"></i> Rich Text
                    </button>
                </div>
            </div>
        `;
    }
}

// Toggle menu share dropdown visibility
function toggleMenuShareDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('menuShareDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        
        // Close dropdown when clicking outside
        if (!dropdown.classList.contains('hidden')) {
            const closeDropdown = (e) => {
                if (!dropdown.contains(e.target) && e.target.id !== 'menuShareBtn') {
                    dropdown.classList.add('hidden');
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 0);
        }
    }
}

// Switch to edit mode
function enterEditMode() {
    isEditMode = true;
    
    titleInput.classList.remove('hidden');
    titleDisplay.classList.add('hidden');
    
    // Hide preview content in edit mode
    previewContent.classList.add('hidden');
    
    // Initialize EasyMDE editor when entering edit mode
    initializeRecipeEditor();
    
    // Update action buttons for edit mode
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (recipe) updateRecipeActionButtons(recipe);
}

// Switch to view mode
function enterViewMode() {
    isEditMode = false;
    
    // Clean up EasyMDE editor when exiting edit mode
    if (recipeEditor) {
        markdownTextarea.value = recipeEditor.value();
        recipeEditor.toTextArea();
        recipeEditor = null;
    }
    
    titleInput.classList.add('hidden');
    titleDisplay.classList.remove('hidden');
    
    markdownTextarea.classList.add('hidden');
    previewContent.classList.remove('hidden');
    
    titleDisplay.textContent = titleInput.value || 'Untitled';
    previewContent.innerHTML = marked.parse(cleanMarkdown(markdownTextarea.value || ''));
    
    // Update action buttons for view mode
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (recipe) updateRecipeActionButtons(recipe);
}

// Show home view (collections)
function showHomeView() {
    console.log('🏠 showHomeView called');
    console.log('👀 Current viewing user:', API.viewingUser);
    console.log('🔐 Current logged-in user:', API.currentUser?.username);
    
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show sidebar only if user is authenticated (in case it was hidden by 404 view)
    const sidebar = document.getElementById('sidebar');
    if (sidebar && API.currentUser) {
        sidebar.classList.remove('hidden');
    }
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    homeView.classList.remove('hidden');
    homeView.classList.add('active');
    console.log('✅ Home view made visible');
    
    currentRecipeId = null;
    currentCollectionId = null;
    currentMenuId = null;
    
    // Render profile page
    renderProfilePage();
    
    updateEditControls(); // Show/hide create buttons based on ownership
    updateURL(null, null);
}

// Render profile page
async function renderProfilePage() {
    console.log('📄 Rendering profile page for:', API.viewingUser);
    
    // Update profile action buttons visibility
    updateEditControls();
    
    // Get user data
    let userData = null;
    try {
        const response = await fetch(`/api/${API.viewingUser}/user`);
        userData = await response.json();
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
    
    // Set avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar && userData?.gravatarHash) {
        // Keep skeleton until image loads
        profileAvatar.onload = () => {
            profileAvatar.classList.remove('skeleton-avatar');
        };
        profileAvatar.onerror = () => {
            // Remove skeleton even if image fails to load
            profileAvatar.classList.remove('skeleton-avatar');
        };
        profileAvatar.src = `https://www.gravatar.com/avatar/${userData.gravatarHash}?s=256&d=identicon`;
    }
    
    // Set username
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = `@${API.viewingUser}`;
        profileUsername.classList.remove('skeleton-text');
    }
    
    // Set bio
    const profileBio = document.getElementById('profileBio');
    if (profileBio) {
        if (userData?.bio) {
            profileBio.textContent = userData.bio;
            profileBio.classList.remove('hidden');
        } else {
            profileBio.classList.add('hidden');
        }
        profileBio.classList.remove('skeleton-text');
    }
    
    // Set stats
    const profileFollowingCount = document.getElementById('profileFollowingCount');
    const profileFollowersCount = document.getElementById('profileFollowersCount');
    const profileFollowingLink = document.getElementById('profileFollowingLink');
    const profileFollowersLink = document.getElementById('profileFollowersLink');
    
    if (profileFollowingCount) {
        profileFollowingCount.textContent = userData?.followingCount || 0;
        profileFollowingCount.classList.remove('skeleton-text');
    }
    if (profileFollowersCount) {
        profileFollowersCount.textContent = userData?.followersCount || 0;
        profileFollowersCount.classList.remove('skeleton-text');
    }
    
    // Add click handlers for following/followers lists
    if (profileFollowingLink && userData?.username) {
        profileFollowingLink.style.cursor = 'pointer';
        profileFollowingLink.onclick = () => showFollowModal('following', userData.username);
    }
    if (profileFollowersLink && userData?.username) {
        profileFollowersLink.style.cursor = 'pointer';
        profileFollowersLink.onclick = () => showFollowModal('followers', userData.username);
    }
    
    // Show/hide follow button
    const profileFollowBtn = document.getElementById('profileFollowBtn');
    const isOwner = API.viewingUser === API.currentUser?.username;
    const isFollowing = API.currentUser?.following?.includes(userData?.uid);
    
    console.log('🔍 Setting up follow button - userData:', userData);
    
    if (profileFollowBtn) {
        if (isOwner || !API.currentUser) {
            profileFollowBtn.classList.add('hidden');
        } else {
            profileFollowBtn.classList.remove('hidden');
            if (isFollowing) {
                profileFollowBtn.textContent = 'Following';
                profileFollowBtn.classList.add('following');
            } else {
                profileFollowBtn.textContent = 'Follow';
                profileFollowBtn.classList.remove('following');
            }
            
            // Capture userData values in closure
            const uid = userData?.uid;
            const username = userData?.username;
            console.log('✅ Captured for closure - uid:', uid, 'username:', username);
            profileFollowBtn.onclick = () => {
                console.log('🖱️ Follow button clicked - uid:', uid, 'username:', username);
                toggleFollowFromProfile(uid, username);
            };
        }
    }
    
    // Render grids
    renderProfileRecipesGrid();
    renderProfileCollectionsGrid();
    renderProfileMenusGrid();
    
    // Set up tab switching
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
        tab.onclick = () => switchProfileTab(tab.dataset.tab);
    });
    
    // Activate recipes tab by default
    switchProfileTab('recipes');
}

// Switch profile tabs
function switchProfileTab(tabName) {
    console.log('🔄 Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update tab panels
    document.querySelectorAll('.profile-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const activePanel = document.getElementById(`profile${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (activePanel) {
        activePanel.classList.add('active');
    }
    
    // Render content for the active tab
    if (tabName === 'recipes') {
        renderProfileRecipesGrid();
    } else if (tabName === 'collections') {
        renderProfileCollectionsGrid();
    } else if (tabName === 'menus') {
        renderProfileMenusGrid();
    }
}

// Render profile recipes grid
function renderProfileRecipesGrid() {
    console.log('📄 renderProfileRecipesGrid called');
    const grid = document.getElementById('recipesGridProfile');
    const empty = document.getElementById('recipesEmpty');
    console.log('Grid element:', grid);
    console.log('Recipes count:', recipes.length);
    
    if (!grid) {
        console.warn('⚠️ recipesGridProfile element not found!');
        return;
    }
    
    if (recipes.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    grid.innerHTML = recipes.map(recipe => {
        const slug = recipe.title ? slugify(recipe.title) : 'untitled';
        const url = `/${API.viewingUser}/recipe/${slug}-${recipe.id}`;
        return `
            <a href="${url}" class="collection-card" data-id="${recipe.id}">
                <div class="collection-card-header">
                    <h3 class="collection-card-title">${escapeHtml(recipe.title || 'Untitled')}</h3>
                </div>
                <div class="collection-card-meta">
                    <span class="collection-card-date">${formatTimeAgo(recipe.updatedAt || recipe.createdAt)}</span>
                </div>
            </a>
        `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.collection-card').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            loadRecipe(card.dataset.id);
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
    });
}

// Render profile collections grid
function renderProfileCollectionsGrid() {
    console.log('📦 renderProfileCollectionsGrid called');
    const grid = document.getElementById('collectionsGridProfile');
    const empty = document.getElementById('collectionsEmpty');
    console.log('Grid element:', grid);
    console.log('Collections count:', collections.length);
    
    if (!grid) {
        console.warn('⚠️ collectionsGridProfile element not found!');
        return;
    }
    
    if (collections.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    grid.innerHTML = collections.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        return `
            <div class="collection-card" data-id="${col.id}">
                <div class="collection-card-header">
                    <h3 class="collection-card-title">${escapeHtml(col.name)}</h3>
                    ${isOwner ? `
                        <div class="collection-card-actions">
                            <button onclick="event.preventDefault(); event.stopPropagation(); editCollection('${col.id}')" class="collection-action-btn" title="Edit collection">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="event.preventDefault(); event.stopPropagation(); deleteCollection('${col.id}')" class="collection-action-btn" title="Delete collection">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                ${col.description ? `<p class="collection-card-description">${escapeHtml(col.description)}</p>` : ''}
                <div class="collection-card-meta">
                    <span class="collection-card-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.collection-card').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            loadCollectionDetail(card.dataset.id);
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
    });
}

// Render profile menus grid
function renderProfileMenusGrid() {
    console.log('🍽️ renderProfileMenusGrid called');
    const grid = document.getElementById('menusGridProfile');
    const empty = document.getElementById('menusEmpty');
    console.log('Grid element:', grid);
    console.log('Menus count:', menus.length);
    
    if (!grid) {
        console.warn('⚠️ menusGridProfile element not found!');
        return;
    }
    
    if (menus.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    
    if (empty) empty.classList.add('hidden');
    
    const isOwner = API.viewingUser === API.currentUser?.username;
    
    grid.innerHTML = menus.map(menu => `
        <div class="collection-card" data-id="${menu.id}">
            <div class="collection-card-header">
                <h3 class="collection-card-title">${escapeHtml(menu.name)}</h3>
                ${isOwner ? `
                    <div class="collection-card-actions">
                        <button onclick="event.preventDefault(); event.stopPropagation(); loadMenuDetail('${menu.id}'); enterMenuEditMode();" class="collection-action-btn" title="Edit menu">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="event.preventDefault(); event.stopPropagation(); deleteMenu('${menu.id}')" class="collection-action-btn" title="Delete menu">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            ${menu.description ? `<p class="collection-card-description">${escapeHtml(menu.description)}</p>` : ''}
            <div class="collection-card-meta">
                <span class="collection-card-date">${formatTimeAgo(menu.updatedAt || menu.createdAt)}</span>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    grid.querySelectorAll('.collection-card').forEach(card => {
        const handler = (e) => {
            e.preventDefault();
            loadMenuDetail(card.dataset.id);
        };
        card.addEventListener('click', handler);
        card.addEventListener('touchstart', handler, { passive: false });
    });
}

// Toggle follow from profile page
async function toggleFollowFromProfile(userIdToFollow, usernameToFollow) {
    console.log('🔄 toggleFollowFromProfile called', { userIdToFollow, usernameToFollow });
    console.log('👤 API.currentUser:', API.currentUser);
    
    if (!API.currentUser) {
        console.log('❌ Missing currentUser');
        return;
    }
    
    if (!userIdToFollow) {
        console.log('❌ Missing userIdToFollow');
        return;
    }
    
    const profileFollowBtn = document.getElementById('profileFollowBtn');
    if (!profileFollowBtn) {
        console.log('❌ profileFollowBtn not found');
        return;
    }
    
    const isFollowing = profileFollowBtn.classList.contains('following');
    console.log('📊 Current state - isFollowing:', isFollowing, 'classList:', profileFollowBtn.className);
    
    try {
        if (isFollowing) {
            console.log('🔄 Unfollowing user...');
            await API.unfollowUser(userIdToFollow, usernameToFollow);
            profileFollowBtn.classList.remove('following');
            profileFollowBtn.textContent = 'Follow';
            console.log('✅ Unfollowed - new classList:', profileFollowBtn.className);
        } else {
            console.log('🔄 Following user...');
            await API.followUser(userIdToFollow, usernameToFollow);
            profileFollowBtn.classList.add('following');
            profileFollowBtn.textContent = 'Following';
            console.log('✅ Followed - new classList:', profileFollowBtn.className);
        }
        
        // Update follower count
        const profileFollowersCount = document.getElementById('profileFollowersCount');
        if (profileFollowersCount) {
            const currentCount = parseInt(profileFollowersCount.textContent) || 0;
            profileFollowersCount.textContent = isFollowing ? currentCount - 1 : currentCount + 1;
            console.log('📊 Updated follower count:', profileFollowersCount.textContent);
        }
    } catch (error) {
        console.error('❌ Error toggling follow:', error);
        alert('Error updating follow status');
    }
}

// =============================================================================
// FOLLOW MODAL FUNCTIONS
// =============================================================================

async function showFollowModal(initialTab, username) {
    console.log(`📋 Opening follow modal (${initialTab} tab) for ${username}`);
    
    // Clear previous content
    DOM.followingList.innerHTML = '';
    DOM.followersList.innerHTML = '';
    DOM.followModalEmpty.classList.add('hidden');
    
    // Set active tab
    const tabs = DOM.followModal.querySelectorAll('.follow-tab');
    const tabContents = DOM.followModal.querySelectorAll('.follow-tab-content');
    
    tabs.forEach(tab => {
        const isActive = tab.dataset.tab === initialTab;
        tab.classList.toggle('active', isActive);
    });
    
    tabContents.forEach(content => {
        const isActive = content.id === (initialTab === 'following' ? 'followingList' : 'followersList');
        content.classList.toggle('active', isActive);
    });
    
    // Setup tab click handlers
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetList = tab.dataset.tab === 'following' ? DOM.followingList : DOM.followersList;
            tabContents.forEach(content => content.classList.remove('active'));
            targetList.classList.add('active');
            
            // Load data for this tab if not already loaded
            if (targetList.children.length === 0) {
                loadFollowList(tab.dataset.tab, username, targetList);
            }
        };
    });
    
    // Load initial tab data
    const initialList = initialTab === 'following' ? DOM.followingList : DOM.followersList;
    await loadFollowList(initialTab, username, initialList);
    
    // Open modal with utilities (handles focus trap, escape, etc.)
    ModalUtils.open(DOM.followModal, closeFollowModal);
}

async function loadFollowList(type, username, listElement) {
    console.log(`📋 Loading ${type} list for ${username}`);
    
    try {
        // Fetch both lists from server in one request
        const endpoint = `/api/users/${username}/connections`;
        
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch users');
        
        const data = await response.json();
        const users = data[type] || []; // Get 'following' or 'followers' from response
        
        if (users.length === 0) {
            DOM.followModalEmpty.classList.remove('hidden');
            return;
        }
        
        DOM.followModalEmpty.classList.add('hidden');
        
        // Render user list
        for (const user of users) {
            const item = document.createElement('div');
            item.className = 'follow-item';
            
            const gravatarUrl = user.gravatarHash 
                ? `https://www.gravatar.com/avatar/${user.gravatarHash}?d=retro&s=88`
                : `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=retro&s=88`;
            
            const isCurrentUser = API.currentUser && user.username === API.currentUser.username;
            const isFollowing = API.currentUser && State.users[user.username]?.isFollowing;
            
            item.innerHTML = `
                <img src="${gravatarUrl}" alt="${user.username}" class="follow-item-avatar">
                <div class="follow-item-info">
                    <a href="/${user.username}" class="follow-item-username">@${user.username}</a>
                    ${user.bio ? `<div class="follow-item-bio">${escapeHtml(user.bio)}</div>` : ''}
                </div>
                ${!isCurrentUser ? `
                    <div class="follow-item-action">
                        <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                                data-user-id="${user.userId}"
                                data-username="${user.username}">
                            ${isFollowing ? 'Following' : 'Follow'}
                        </button>
                    </div>
                ` : ''}
            `;
            
            listElement.appendChild(item);
            
            // Add click handler to username link
            const usernameLink = item.querySelector('.follow-item-username');
            usernameLink.addEventListener('click', (e) => {
                e.preventDefault();
                closeFollowModal();
                const username = user.username;
                navigate({
                    url: `/${username}`,
                    title: `@${username} - Sous`,
                    state: { type: 'home', username }
                });
                API.viewingUser = username;
                loadAllData().then(() => {
                    renderProfilePage();
                });
            });
            
            // Add click handler to follow button if present
            if (!isCurrentUser) {
                const followBtn = item.querySelector('.follow-btn');
                followBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await handleFollowToggleInModal(followBtn, user.userId, user.username);
                });
            }
        }
    } catch (error) {
        console.error('Error loading users:', error);
        DOM.followModalEmpty.textContent = 'Error loading users';
        DOM.followModalEmpty.classList.remove('hidden');
    }
}

async function handleFollowToggleInModal(button, userId, username) {
    const isFollowing = button.classList.contains('following');
    
    try {
        if (isFollowing) {
            await API.unfollowUser(userId, username);
            button.classList.remove('following');
            button.textContent = 'Follow';
        } else {
            await API.followUser(userId, username);
            button.classList.add('following');
            button.textContent = 'Following';
        }
        
        // Update cached user data
        if (!State.users[username]) {
            State.users[username] = {};
        }
        State.users[username].isFollowing = !isFollowing;
        
    } catch (error) {
        console.error('Error toggling follow:', error);
        alert('Error updating follow status');
    }
}

function closeFollowModal() {
    // Modal closing handled by ModalUtils
    console.log('📋 Follow modal closed');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotFoundView() {
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    const notFoundView = document.getElementById('notFoundView');
    if (notFoundView) {
        notFoundView.classList.remove('hidden');
        notFoundView.classList.add('active');
    }
    
    // Hide sidebar for 404 page
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
    }
    
    // Expand main content to full width
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.style.marginLeft = '0';
    }
    
    currentRecipeId = null;
    currentCollectionId = null;
    currentMenuId = null;
}

function showFeedView() {
    console.log('📰 showFeedView called');
    
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show sidebar only if user is authenticated (in case it was hidden by 404 view)
    const sidebar = document.getElementById('sidebar');
    if (sidebar && API.currentUser) {
        sidebar.classList.remove('hidden');
    }
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    const feedView = document.getElementById('feedView');
    if (feedView) {
        feedView.classList.remove('hidden');
        feedView.classList.add('active');
        console.log('✅ Feed view made visible');
    } else {
        console.error('❌ Feed view element not found!');
    }
    
    currentRecipeId = null;
    currentCollectionId = null;
    currentMenuId = null;
    currentView = 'feed';
    
    // Update browser history
    navigate({
        url: '/',
        title: 'Feed - Sous',
        state: { type: 'feed' }
    });
    
    // Load and render feed
    loadFeed();
}

async function showSearchView() {
    console.log('🔍 showSearchView called');
    
    // Clear sidebar active states
    document.querySelectorAll('.recipe-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hide sidebar for search page
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('hidden');
    
    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    const searchView = document.getElementById('searchView');
    if (searchView) {
        searchView.classList.remove('hidden');
        searchView.classList.add('active');
        console.log('✅ Search view made visible');
    } else {
        console.error('❌ Search view element not found!');
    }
    
    currentRecipeId = null;
    currentCollectionId = null;
    currentMenuId = null;
    currentView = 'search';
    
    // Update browser history
    navigate({
        url: '/search',
        title: 'Search - Sous',
        state: { type: 'search' }
    });
    
    // Clear search input and focus
    const searchUsersInput = document.getElementById('searchUsersInput');
    const searchResults = document.getElementById('searchResults');
    if (searchUsersInput) {
        searchUsersInput.value = '';
        searchUsersInput.focus();
    }
    
    // Load all searchable users by default
    if (searchResults) {
        await loadAllSearchableUsers();
    }
}

async function loadAllSearchableUsers() {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    try {
        searchResults.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Loading users...</div>';
        
        const response = await fetch('/api/users/search');
        if (!response.ok) throw new Error('Failed to load users');
        
        let users = await response.json();
        
        // Filter out current user
        if (API.currentUser) {
            users = users.filter(u => u.username !== API.currentUser.username);
        }
        
        if (users.length === 0) {
            searchResults.innerHTML = `
                <div class="search-results-empty">
                    <div>👥</div>
                    <h3>No users yet</h3>
                </div>
            `;
            return;
        }
        
        await renderSearchResults(users);
    } catch (error) {
        console.error('❌ Error loading users:', error);
        searchResults.innerHTML = `
            <div class="search-results-empty">
                <p>Failed to load users. Please try again.</p>
            </div>
        `;
    }
}

async function renderSearchResults(users) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    // Get current user's following list (contains UIDs)
    const following = API.currentUser?.following || [];
    
    searchResults.innerHTML = users.map(user => {
        const isFollowing = following.includes(user.uid); // Compare UIDs, not usernames
        const isSelf = user.username === API.currentUser?.username;
        const profileUrl = `/${user.username}`;
        const adminBadge = user.isStaff ? getAdminBadge({ isStaff: true }) : '';
        
        return `
            <a href="${profileUrl}" class="search-result-item" data-username="${user.username}">
                ${getAvatarHtml(user.username, user.gravatarHash, 40)}
                <div class="search-result-info">
                    <div class="search-result-username">@${user.username}${adminBadge}</div>
                    <div class="search-result-stats">${user.followersCount || 0} followers · ${user.followingCount || 0} following</div>
                </div>
                ${!isSelf ? `<button class="search-result-follow-btn ${isFollowing ? 'following' : ''}" data-username="${user.username}" data-uid="${user.uid}">
                    ${isFollowing ? 'Following' : 'Follow'}
                </button>` : ''}
            </a>
        `;
    }).join('');
    
    // Add click handlers to results (navigate to profile)
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't navigate if clicking the follow button
            if (e.target.classList.contains('search-result-follow-btn')) return;
            
            e.preventDefault();
            const username = item.dataset.username;
            // Navigate to user's profile
            API.viewingUser = username;
            navigate({
                url: `/${username}`,
                title: `@${username} - Sous`,
                state: { type: 'home' }
            });
            loadAllData().then(() => {
                showHomeView();
            });
        });
    });
    
    // Add click handlers to follow buttons
    searchResults.querySelectorAll('.search-result-follow-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const username = btn.dataset.username;
            const uid = btn.dataset.uid;
            const isFollowing = btn.classList.contains('following');
            
            try {
                if (isFollowing) {
                    await API.unfollowUser(uid, username);
                    btn.classList.remove('following');
                    btn.textContent = 'Follow';
                } else {
                    await API.followUser(uid, username);
                    btn.classList.add('following');
                    btn.textContent = 'Following';
                }
            } catch (error) {
                console.error('❌ Follow/unfollow error:', error);
                alert('Failed to update follow status');
            }
        });
    });
}

async function loadFeed() {
    try {
        const activities = await API.getFeed();
        renderFeed(activities);
        
        // Set up explore users button
        const exploreUsersBtn = document.getElementById('exploreUsersBtn');
        if (exploreUsersBtn) {
            exploreUsersBtn.onclick = () => {
                showSearchView();
                updateURL('/search', 'Search Users - Sous');
            };
        }
    } catch (error) {
        console.error('Error loading feed:', error);
        const feedContainer = document.getElementById('feedContainer');
        if (feedContainer) {
            feedContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Failed to load activity feed</div>';
        }
    }
}

async function renderFeed(activities) {
    const feedContainer = document.getElementById('feedContainer');
    const feedEmpty = document.getElementById('feedEmpty');
    
    if (!feedContainer) return;
    
    if (activities.length === 0) {
        feedContainer.classList.add('hidden');
        if (feedEmpty) feedEmpty.classList.remove('hidden');
        return;
    }
    
    feedContainer.classList.remove('hidden');
    if (feedEmpty) feedEmpty.classList.add('hidden');
    
    // Fetch user data for avatars and staff status (cache to avoid duplicate requests)
    const userGravatars = {};
    const userIsStaff = {};
    const uniqueUsernames = [...new Set(activities.map(a => a.username))];
    
    await Promise.all(uniqueUsernames.map(async (username) => {
        try {
            const res = await fetch(`/api/${username}/user`);
            if (res.ok) {
                const userData = await res.json();
                userGravatars[username] = userData.gravatarHash;
                userIsStaff[username] = userData.isStaff || false;
            }
        } catch (err) {
            console.error(`Failed to fetch user data for ${username}:`, err);
        }
    }));
    
    feedContainer.innerHTML = activities.map(activity => {
        const timeAgo = formatTimeAgo(new Date(activity.createdAt));
        const actionText = getActionText(activity.type);
        const icon = getActivityIcon(activity.type);
        
        // Debug: Log what we're getting
        console.log('🔍 Activity:', {
            type: activity.type,
            entityId: activity.entityId,
            entitySlug: activity.entitySlug,
            entityTitle: activity.entityTitle
        });
        
        // Build URL based on entity type
        let entityUrl = '';
        if (activity.type === 'recipe_created') {
            entityUrl = `/${activity.username}/recipe/${activity.entitySlug}`;
        } else if (activity.type === 'collection_created') {
            entityUrl = `/${activity.username}/collection/${activity.entitySlug}`;
        } else if (activity.type === 'menu_created') {
            entityUrl = `/${activity.username}/menu/${activity.entitySlug}`;
        }
        
        console.log('🔗 Generated URL:', entityUrl);
        
        // Get avatar HTML (Gravatar with initials fallback)
        const avatarHtml = getAvatarHtml(activity.username, userGravatars[activity.username], 40);
        
        // Get admin badge if user is staff
        const adminBadge = userIsStaff[activity.username] ? getAdminBadge({ isStaff: true }) : '';
        
        return `
            <div class="feed-item">
                ${avatarHtml}
                <div class="feed-content">
                    <div class="feed-header-text">
                        <a href="/${activity.username}" class="feed-username">@${activity.username}${adminBadge}</a>
                        <span class="feed-action">${actionText}</span>
                        <a href="${entityUrl}" class="feed-entity-title">${activity.entityTitle}</a>
                    </div>
                    ${activity.preview ? `<div class="feed-preview">${activity.preview}</div>` : ''}
                    <div class="feed-timestamp">${icon} ${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function getActionText(type) {
    switch (type) {
        case 'recipe_created': return 'created a recipe';
        case 'collection_created': return 'created a collection';
        case 'menu_created': return 'created a menu';
        default: return 'did something';
    }
}

function getActivityIcon(type) {
    switch (type) {
        case 'recipe_created': return '📝';
        case 'collection_created': return '📁';
        case 'menu_created': return '🍽️';
        default: return '✨';
    }
}

function formatTimeAgo(date) {
    if (!date) return 'just now';
    
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) return 'just now';
    
    const seconds = Math.floor((new Date() - dateObj) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'just now';
}

/**
 * Shows the onboarding banner for first-time users
 */
function showOnboardingBanner(skeleton, content) {
    // Hide skeleton and content using helper
    SkeletonUI.showContent(null, skeleton);
    if (content) content.classList.add('hidden');
    
    // Create onboarding banner if it doesn't exist
    const existingBanner = homeView.querySelector('.onboarding-banner');
    if (!existingBanner) {
        const banner = document.createElement('div');
        banner.className = 'onboarding-banner';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 400px; padding: 40px;">
                <div style="text-align: center; max-width: 500px;">
                    <h1 style="font-family: 'Cinzel', serif; font-size: 48px; margin: 0 0 16px 0; color: #6b5d52;">Welcome to Sous</h1>
                    <p style="font-size: 18px; line-height: 1.6; color: #666; margin: 0 0 32px 0;">Your personal recipe manager. Get started by adding your first recipe or creating a curated menu.</p>
                    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="createNewRecipe()" style="padding: 14px 28px; font-size: 16px; font-weight: 500; background: #6b5d52; color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit;" onmouseover="this.style.background='#5a4d42'" onmouseout="this.style.background='#6b5d52'">📝 Add your first recipe</button>
                        <button onclick="createNewMenu()" style="padding: 14px 28px; font-size: 16px; font-weight: 500; background: white; color: #6b5d52; border: 2px solid #6b5d52; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit;" onmouseover="this.style.background='#f9f7f4'" onmouseout="this.style.background='white'">🍽️ Create a menu</button>
                    </div>
                </div>
            </div>
        `;
        homeView.appendChild(banner);
    }
}

/**
 * Shows the normal home view with collections and menus
 */
function showNormalHomeView(skeleton, content) {
    // Hide skeleton, show content using helper
    SkeletonUI.showContent(content, skeleton);
    
    // Remove any onboarding banner
    const banner = homeView.querySelector('.onboarding-banner');
    if (banner) banner.remove();
    
    // Render normal home view - MENUS FIRST, then collections
    renderMenusGridHome();
    renderCollectionsGridHome();
}

// Load all data
async function loadAllData() {
    console.log('🚀 Loading all data...');
    try {
        // Initialize users first
        await API.initializeUsers();
        
        // IMPORTANT: Set viewing user from URL BEFORE loading data
        const path = window.location.pathname;
        
        // Skip loading data for special routes but still handle routing
        if (path === '/search' || path === '/login' || path === '/signup' || path === '/logout') {
            console.log('🚫 Special route detected, skipping data load but handling routing:', path);
            // For search, set viewing user to current user if logged in
            if (path === '/search' && API.currentUser) {
                API.viewingUser = API.currentUser.username;
            }
            updateEditControls(); // Update navbar controls
            loadFromURL();
            return;
        }
        
        const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
        if (usernameMatch) {
            const username = usernameMatch[1];
            // Set viewing user from URL - trust the URL
            API.viewingUser = username;
            console.log('👁️  Setting viewing user from URL:', username);
        } else if (API.currentUser) {
            // No username in URL, use current user if logged in
            API.viewingUser = API.currentUser.username;
        } else {
            // Not logged in and no username in URL - bail out
            console.log('⚠️ No viewing context (not logged in, no username in URL)');
            return;
        }
        
        // Fetch users list for gravatar lookups
        await fetchUsers();
        
        // Fetch authenticated user's recipes (for sidebar) and viewing user's data (for main content)
        const fetchPromises = [];
        
        // Always fetch authenticated user's recipes if logged in (for sidebar)
        if (API.currentUser) {
            fetchPromises.push(
                API.getAuthenticatedUserRecipes().catch(err => {
                    console.error('❌ Failed to load authenticated user recipes:', err.message);
                    return [];
                })
            );
        } else {
            fetchPromises.push(Promise.resolve([]));
        }
        
        // Fetch viewing user's recipes (for main content)
        fetchPromises.push(
            API.getRecipes().catch(err => {
                console.error('❌ Failed to load viewing user recipes:', err.message);
                if (err.userNotFound) {
                    throw err; // Re-throw to handle at top level
                }
                showFirebaseErrorBanner();
                return [];
            })
        );
        
        // Fetch collections and menus
        fetchPromises.push(
            API.getCollections().catch(err => {
                console.error('❌ Failed to load collections:', err.message);
                if (err.userNotFound) {
                    throw err; // Re-throw to handle at top level
                }
                showFirebaseErrorBanner();
                return [];
            })
        );
        
        fetchPromises.push(
            API.getMenus().catch(err => {
                console.error('❌ Failed to load menus:', err.message);
                if (err.userNotFound) {
                    throw err; // Re-throw to handle at top level
                }
                showFirebaseErrorBanner();
                return [];
            })
        );
        
        const [authRecipesData, viewRecipesData, collectionsData, menusData] = await Promise.all(fetchPromises);
        
        State.authenticatedUserRecipes = authRecipesData;
        State.viewingUserRecipes = viewRecipesData;
        recipes = viewRecipesData;  // Maintain backward compatibility for main content
        collections = collectionsData;
        menus = menusData;
        
        console.log('📊 Data loaded - Recipes:', recipes.length, 'Collections:', collections.length, 'Menus:', menus.length);
        
        renderRecipeList();
        updateUserDisplay();
        loadFromURL(); // This will show the appropriate view based on URL
    } catch (error) {
        console.error('💥 Critical error loading data:', error);
        
        // Check if it's a user not found error
        if (error.userNotFound) {
            console.log('🚫 User not found - showing 404 page');
            showNotFoundView();
            return;
        }
        
        // Only show Firebase error banner for actual network/Firebase errors
        // Don't show it for DOM errors (like null references)
        const isNetworkError = error.message && (
            error.message.includes('fetch') || 
            error.message.includes('NetworkError') ||
            error.message.includes('Firebase') ||
            error.message.includes('CORS') ||
            error.message.includes('Failed to load') ||
            error.name === 'NetworkError'
        );
        
        if (isNetworkError) {
            const errorBanner = document.getElementById('firebaseErrorBanner');
            if (errorBanner) {
                errorBanner.classList.remove('hidden');
            }
            
            // Still show a modal for critical network failures
            alert('Failed to connect to server. Please check your connection and try refreshing the page.');
        }
    }
}

// Create new recipe
async function createNewRecipe() {
    try {
        const newRecipe = await API.createRecipe({ title: '', content: '' });
        recipes.unshift(newRecipe);
        
        // Also add to authenticated user's recipes (for sidebar)
        if (API.currentUser) {
            State.authenticatedUserRecipes.unshift(newRecipe);
        }
        
        currentRecipeId = newRecipe.id;
        titleInput.value = '';
        markdownTextarea.value = '';
        
        // Clear metadata for new recipe
        const metadataCreated = document.getElementById('metadataCreated');
        const metadataEdited = document.getElementById('metadataEdited');
        const metadataCollections = document.getElementById('metadataCollections');
        const metadataAuthor = document.getElementById('metadataAuthor');
        
        if (metadataCreated) metadataCreated.textContent = '—';
        if (metadataEdited) metadataEdited.textContent = '—';
        if (metadataCollections) metadataCollections.innerHTML = '<span class="metadata-empty">None</span>';
        if (metadataAuthor) metadataAuthor.textContent = '—';
        
        showRecipeDetailView();
        
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
        
        // Also update in authenticated user's recipes if it exists there
        if (API.currentUser) {
            const authRecipe = State.authenticatedUserRecipes.find(r => r.id === currentRecipeId);
            if (authRecipe) {
                authRecipe.title = title;
                authRecipe.content = content;
                authRecipe.updatedAt = recipe.updatedAt;
            }
        }
        
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
        
        // Also remove from authenticated user's recipes
        if (API.currentUser) {
            State.authenticatedUserRecipes = State.authenticatedUserRecipes.filter(r => r.id !== currentRecipeId);
        }
        
        // Navigate to home view after deletion
        showHomeView();
        renderRecipeList();
    } catch (error) {
        alert('Error deleting recipe');
    }
}

// Copy link to recipe
function copyRecipeLink(event) {
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;
    
    const slug = recipe.title ? slugify(recipe.title) : 'untitled';
    const url = `${window.location.origin}/${API.viewingUser}/recipe/${slug}-${currentRecipeId}`;
    
    const button = event?.target?.closest('button') || document.getElementById('metadataCopyLinkBtn');
    
    navigator.clipboard.writeText(url).then(() => {
        // Close dropdown
        const dropdown = document.getElementById('shareDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        // Show brief success feedback
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 1500);
        }
    });
}

function copyCollectionLink(event, collectionId) {
    event.stopPropagation();
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    
    const slug = slugify(collection.name);
    const url = `${window.location.origin}/${API.viewingUser}/collection/${slug}-${collectionId}`;
    
    const button = event.target.closest('button');
    
    navigator.clipboard.writeText(url).then(() => {
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }
    });
}

// Copy recipe content in different formats
function copyRecipeContent(format) {
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;
    
    let content = '';
    
    if (format === 'markdown') {
        // Copy raw markdown
        content = `# ${recipe.title}\n\n${recipe.content}`;
        navigator.clipboard.writeText(content).then(() => {
            closeShareDropdown();
            console.log('Recipe content copied:', format);
        });
    } else if (format === 'plaintext') {
        // Convert markdown to plain text (strip formatting)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(cleanMarkdown(recipe.content || ''));
        content = `${recipe.title}\n\n${tempDiv.textContent || tempDiv.innerText}`;
        navigator.clipboard.writeText(content).then(() => {
            closeShareDropdown();
            console.log('Recipe content copied:', format);
        });
    } else if (format === 'html') {
        // Convert markdown to rich HTML for pasting into Google Docs, Word, etc.
        const htmlContent = `<h1>${escapeHtml(recipe.title)}</h1>\n${marked.parse(cleanMarkdown(recipe.content || ''))}`;
        const plainContent = `${recipe.title}\n\n${document.createElement('div').textContent = htmlContent}`;
        
        // Use ClipboardItem to write both HTML and plain text formats
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const plainBlob = new Blob([content], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
            'text/html': blob,
            'text/plain': plainBlob
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
            closeShareDropdown();
            console.log('Recipe content copied as rich text:', format);
        }).catch(err => {
            console.error('Failed to copy rich text:', err);
            // Fallback to plain text
            navigator.clipboard.writeText(htmlContent);
        });
    }
}

// Helper to close share dropdown
function closeShareDropdown() {
    const dropdown = document.getElementById('shareDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

// Copy menu content in different formats
function copyMenuContent(format) {
    const menu = menus.find(m => m.id === currentMenuId);
    if (!menu) return;
    
    let content = '';
    
    if (format === 'markdown') {
        // Copy raw markdown
        content = `# ${menu.name}\n\n${menu.description ? menu.description + '\n\n' : ''}${menu.content}`;
        navigator.clipboard.writeText(content).then(() => {
            closeMenuShareDropdown();
            console.log('Menu content copied:', format);
        });
    } else if (format === 'plaintext') {
        // Convert markdown to plain text (strip formatting)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(cleanMarkdown(menu.content || ''));
        const descText = menu.description ? `${menu.description}\n\n` : '';
        content = `${menu.name}\n\n${descText}${tempDiv.textContent || tempDiv.innerText}`;
        navigator.clipboard.writeText(content).then(() => {
            closeMenuShareDropdown();
            console.log('Menu content copied:', format);
        });
    } else if (format === 'html') {
        // Convert markdown to rich HTML for pasting into Google Docs, Word, etc.
        const descHtml = menu.description ? `<p>${escapeHtml(menu.description)}</p>\n` : '';
        const htmlContent = `<h1>${escapeHtml(menu.name)}</h1>\n${descHtml}${marked.parse(cleanMarkdown(menu.content || ''))}`;
        
        // Use ClipboardItem to write both HTML and plain text formats
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const plainContent = tempDiv.textContent || tempDiv.innerText;
        const plainBlob = new Blob([plainContent], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
            'text/html': blob,
            'text/plain': plainBlob
        });
        
        navigator.clipboard.write([clipboardItem]).then(() => {
            closeMenuShareDropdown();
            console.log('Menu content copied as rich text:', format);
        }).catch(err => {
            console.error('Failed to copy rich text:', err);
            // Fallback to plain text
            navigator.clipboard.writeText(htmlContent);
        });
    }
}

// Helper to close menu share dropdown
function closeMenuShareDropdown() {
    const dropdown = document.getElementById('menuShareDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

function copyMenuLink(event, menuId) {
    event.stopPropagation();
    const menu = menus.find(m => m.id === menuId);
    if (!menu) return;
    
    const slug = slugify(menu.name);
    const url = `${window.location.origin}/${API.viewingUser}/menu/${slug}-${menuId}`;
    
    const button = event.target.closest('button');
    
    navigator.clipboard.writeText(url).then(() => {
        // Close dropdown
        const dropdown = document.getElementById('menuShareDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        if (button) {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }
    });
}

// Show collection modal
function showCollectionModal(event) {
    if (!currentRecipeId) return;
    
    const collectionsMenuContent = document.getElementById('collectionsMenuContent');
    const collectionsMenu = document.getElementById('collectionsMenu');
    const collectionsSearch = document.getElementById('collectionsSearch');
    const button = event?.target?.closest('button');
    
    // Render all collections
    const renderCollections = (filter = '') => {
        const filtered = filter 
            ? collections.filter(col => col.name.toLowerCase().includes(filter.toLowerCase()))
            : collections;
            
        collectionsMenuContent.innerHTML = filtered.map(col => {
            const isInCollection = col.recipeIds && col.recipeIds.includes(currentRecipeId);
            return `
                <div class="collection-checkbox">
                    <input type="checkbox" id="col-${col.id}" data-collection-id="${col.id}" ${isInCollection ? 'checked' : ''}>
                    <label for="col-${col.id}">${escapeHtml(col.name)}</label>
                </div>
            `;
        }).join('');
        
        // Add event listeners to checkboxes for auto-save
        filtered.forEach(col => {
            const checkbox = document.getElementById(`col-${col.id}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => handleCollectionToggle(col.id, checkbox.checked));
            }
        });
    };
    
    renderCollections();
    
    // Search functionality
    collectionsSearch.value = '';
    collectionsSearch.oninput = (e) => renderCollections(e.target.value);
    
    // New collection button
    document.getElementById('newCollectionMenuBtn').onclick = async () => {
        const name = prompt('Collection name:');
        if (name && name.trim()) {
            const description = prompt('Description (optional):') || '';
            const newCollection = await API.createCollection({ name: name.trim(), description });
            if (newCollection) {
                collections.push(newCollection);
                renderCollections();
            }
        }
    };
    
    // Position menu near the button - now uses absolute positioning relative to metadata
    if (button) {
        const metadata = button.closest('.recipe-metadata');
        const buttonRect = button.getBoundingClientRect();
        const metadataRect = metadata.getBoundingClientRect();
        
        const menuHeight = 400; // max-height
        const menuWidth = 240;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Calculate position relative to metadata container
        let top = buttonRect.bottom - metadataRect.top + 8;
        let left = buttonRect.left - metadataRect.left;
        
        // Check if menu would go off the right edge of viewport
        if (buttonRect.left + menuWidth > viewportWidth - 16) {
            // Position menu to the left of the button
            left = buttonRect.right - metadataRect.left - menuWidth;
        }
        
        // Check if menu would go off the bottom of viewport
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        if (spaceBelow < menuHeight + 16 && spaceAbove > spaceBelow) {
            // Show above the button - closer spacing
            top = buttonRect.top - metadataRect.top - menuHeight - 4;
        }
        
        // Ensure menu doesn't go off the top (below navbar)
        if (top < 50 - metadataRect.top) {
            top = 50 - metadataRect.top;
        }
        
        collectionsMenu.style.top = `${top}px`;
        collectionsMenu.style.left = `${left}px`;
    }
    
    collectionsMenu.style.display = 'flex';
    
    // Focus search input
    setTimeout(() => collectionsSearch.focus(), 50);
}

// Close collections modal
function closeCollectionsModal() {
    const collectionsMenu = document.getElementById('collectionsMenu');
    collectionsMenu.style.display = 'none';
}

// Close collections menu when clicking outside
document.addEventListener('click', (e) => {
    const collectionsMenu = document.getElementById('collectionsMenu');
    const addToCollectionBtn = document.getElementById('metadataAddToCollectionBtn');
    
    if (collectionsMenu && collectionsMenu.style.display === 'flex') {
        if (!collectionsMenu.contains(e.target) && !addToCollectionBtn?.contains(e.target)) {
            closeCollectionsModal();
        }
    }
});

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
            // Update URL with new name
            updateURL('collection', collectionId);
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
        
        // Navigate to home view after deletion
        showHomeView();
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
    
    showMenuDetailView();
    
    // Populate display elements
    menuTitleDisplay.textContent = menu.name;
    menuDescriptionDisplay.textContent = menu.description || '';
    menuPreviewContent.innerHTML = marked.parse(cleanMarkdown(menu.content || ''));
    
    // Populate edit elements
    menuTitleInput.value = menu.name;
    menuDescriptionInput.value = menu.description || '';
    menuMarkdownTextarea.value = menu.content || '';
    
    // Exit edit mode
    isMenuEditMode = false;
    menuTitleDisplay.classList.remove('hidden');
    menuTitleInput.classList.add('hidden');
    menuDescriptionDisplay.classList.remove('hidden');
    menuDescriptionInput.classList.add('hidden');
    menuPreviewContent.classList.remove('hidden');
    menuMarkdownTextarea.classList.add('hidden');
    
    // Render breadcrumb
    const menuBreadcrumb = DOM.menuBreadcrumb;
    if (menuBreadcrumb) {
        menuBreadcrumb.innerHTML = `
            <a href="/${API.viewingUser}" class="breadcrumb-link">@${API.viewingUser}</a>
            <span class="breadcrumb-separator">></span>
            <a href="/${API.viewingUser}/menus" class="breadcrumb-link">Menus</a>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">${escapeHtml(menu.name)}</span>
        `;
        menuBreadcrumb.classList.remove('hidden');
        
        // Add click handlers to breadcrumb links
        const breadcrumbLinks = menuBreadcrumb.querySelectorAll('.breadcrumb-link');
        breadcrumbLinks[0]?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}`,
                title: `@${API.viewingUser} - Sous`,
                state: { type: 'home' }
            });
            showHomeView();
        });
        breadcrumbLinks[1]?.addEventListener('click', (e) => {
            e.preventDefault();
            navigate({
                url: `/${API.viewingUser}/menus`,
                title: 'Menus',
                state: { type: 'menus' }
            });
            showMenusView();
        });
    }
    
    updateEditControls(); // Show/hide edit controls based on ownership
    updateMenuActionButtons(menu); // Update action buttons
}

function enterMenuEditMode() {
    isMenuEditMode = true;
    
    menuTitleDisplay.classList.add('hidden');
    menuTitleInput.classList.remove('hidden');
    menuDescriptionDisplay.classList.add('hidden');
    menuDescriptionInput.classList.remove('hidden');
    
    // Hide preview content in edit mode
    menuPreviewContent.classList.add('hidden');
    
    // Initialize EasyMDE editor when entering edit mode
    initializeMenuEditor();
    
    // Update action buttons for edit mode
    const menu = menus.find(m => m.id === currentMenuId);
    if (menu) updateMenuActionButtons(menu);
    
    menuTitleInput.focus();
}

function exitMenuEditMode() {
    const menu = menus.find(m => m.id === currentMenuId);
    if (!menu) return;
    
    isMenuEditMode = false;
    
    // Clean up EasyMDE editor when exiting edit mode
    if (menuEditor) {
        menuMarkdownTextarea.value = menuEditor.value();
        menuEditor.toTextArea();
        menuEditor = null;
    }
    
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
    
    // Update action buttons for view mode
    updateMenuActionButtons(menu);
}

// Wrapper function for save button
async function saveMenu() {
    await saveMenuChanges();
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
        
        // Update URL with new name
        updateURL('menu', currentMenuId);
        
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
        
        // Navigate to home view after deletion
        showHomeView();
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

// Helper function to render admin badge if user is staff
function getAdminBadge(user) {
    if (!user || !user.isStaff) return '';
    return '<span class="admin-badge" title="Admin">✦</span>';
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

// Follow modal close button
if (DOM.followModalClose) {
    DOM.followModalClose.addEventListener('click', () => ModalUtils.close());
}

// Nav bar new recipe button
const navNewRecipeBtn = document.getElementById('navNewRecipeBtn');
if (navNewRecipeBtn) {
    navNewRecipeBtn.addEventListener('click', createNewRecipe);
}
if (newCollectionBtn) newCollectionBtn.addEventListener('click', createNewCollection);
if (newCollectionBtnHome) newCollectionBtnHome.addEventListener('click', createNewCollection);
if (newMenuBtn) newMenuBtn.addEventListener('click', createNewMenu);
if (newMenuBtnHome) newMenuBtnHome.addEventListener('click', createNewMenu);


dropdownCollections.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    // Navigate to current user's collections
    if (API.currentUser) {
        // Only change viewing user if we're currently viewing someone else
        const path = window.location.pathname;
        const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
        const urlUsername = usernameMatch ? usernameMatch[1] : null;
        
        // If viewing someone else, switch back to own collections and reload data
        if (urlUsername && urlUsername !== API.currentUser.username) {
            API.viewingUser = API.currentUser.username;
            loadAllData().then(() => showCollectionsView());
        } else {
            // Already viewing own profile, just show collections view
            showCollectionsView();
        }
    }
});

const dropdownFeed = document.getElementById('dropdownFeed');
dropdownFeed.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    // Also update viewing user to current user when going to feed
    if (API.currentUser) {
        API.viewingUser = API.currentUser.username;
    }
    showFeedView();
});

dropdownMenus.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    // Navigate to current user's menus
    if (API.currentUser) {
        // Only change viewing user if we're currently viewing someone else
        const path = window.location.pathname;
        const usernameMatch = path.match(/^\/([a-z0-9_-]+)/);
        const urlUsername = usernameMatch ? usernameMatch[1] : null;
        
        // If viewing someone else, switch back to own menus and reload data
        if (urlUsername && urlUsername !== API.currentUser.username) {
            API.viewingUser = API.currentUser.username;
            loadAllData().then(() => showMenusView());
        } else {
            // Already viewing own profile, just show menus view
            showMenusView();
        }
    }
});

dropdownNewRecipe.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    // If viewing someone else's profile, switch to own profile before creating
    if (API.currentUser && API.viewingUser !== API.currentUser.username) {
        API.viewingUser = API.currentUser.username;
        loadAllData().then(() => createNewRecipe());
    } else {
        createNewRecipe();
    }
});

// Keyboard shortcuts modal removed - shortcuts interfered with browser behavior
/*
dropdownShortcuts.addEventListener('click', () => {
    navbarDropdown.classList.add('hidden');
    shortcutsModal.classList.remove('hidden');
});
*/

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
    const navMenuBtnWrapper = document.getElementById('navMenuBtnWrapper');
    const profileMenuBtn = document.getElementById('profileMenuBtn');
    const navbarDropdown = document.getElementById('navbarDropdown');
    const navMenuBtn = document.getElementById('navMenuBtn');
    
    if (!navbarDropdown || !navMenuBtn) return;
    
    if (!navbarDropdown.contains(e.target) && 
        !navMenuBtn.contains(e.target) && 
        !(navMenuBtnWrapper && navMenuBtnWrapper.contains(e.target)) &&
        !(profileMenuBtn && profileMenuBtn.contains(e.target))) {
        navbarDropdown.classList.add('hidden');
    }
});

// Profile action buttons
if (DOM.profileSearchBtn) {
    DOM.profileSearchBtn.addEventListener('click', () => {
        showSearchView();
    });
}

if (DOM.profileSettingsBtn) {
    DOM.profileSettingsBtn.addEventListener('click', () => {
        // Settings is a separate page, not SPA navigation
        window.location.href = '/settings';
    });
}

if (DOM.profileMenuBtn) {
    DOM.profileMenuBtn.addEventListener('click', (e) => {
        console.log('☰ Profile menu button clicked');
        e.stopPropagation();
        const dropdown = document.getElementById('navbarDropdown');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    });
}

// Mobile sidebar toggle
if (DOM.mobileSidebarToggle) {
    DOM.mobileSidebarToggle.addEventListener('click', () => {
        console.log('📱 Mobile sidebar toggle clicked');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    });
}

// Desktop sidebar toggle
if (DOM.desktopSidebarToggle) {
    DOM.desktopSidebarToggle.addEventListener('click', () => {
        console.log('🖥️ Desktop sidebar toggle clicked');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            // Save state to localStorage
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        }
    });
}

// Inner sidebar toggle
const innerSidebarToggle = document.getElementById('innerSidebarToggle');
if (innerSidebarToggle) {
    innerSidebarToggle.addEventListener('click', () => {
        console.log('📐 Inner sidebar toggle clicked');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            // Save state to localStorage
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        }
    });
}

// Add paste handlers for image upload
markdownTextarea.addEventListener('paste', (e) => handleImagePaste(e, markdownTextarea));
menuMarkdownTextarea.addEventListener('paste', (e) => handleImagePaste(e, menuMarkdownTextarea));

// Keyboard shortcuts - DISABLED
// Shortcuts were interfering with normal browser behavior (Cmd+S, etc.)
// Users can access all functionality through UI buttons
/*
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
    
    // N - New recipe (when not typing, and only if owner)
    if ((e.key === 'n' || e.key === 'N') && !isTyping && !isEditMode && !isMenuEditMode) {
        e.preventDefault();
        const isOwner = API.viewingUser === API.currentUser?.username;
        if (isOwner) {
            createNewRecipe();
        }
    }
    
    // E - Edit recipe or menu (when not typing, and only if owner)
    if ((e.key === 'e' || e.key === 'E') && !isTyping) {
        e.preventDefault();
        const isOwner = API.viewingUser === API.currentUser?.username;
        if (!isOwner) return; // Prevent editing if not owner
        
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
        const collectionsMenu = document.getElementById('collectionsMenu');
        
        if (isEditMode && currentRecipeId) {
            enterViewMode();
        } else if (isMenuEditMode && currentMenuId) {
            exitMenuEditMode();
        } else if (collectionsMenu && collectionsMenu.style.display === 'flex') {
            closeCollectionsModal();
        }
    }
    
    // ? - Show shortcuts (when not typing)
    if (e.key === '?' && !isTyping) {
        e.preventDefault();
        shortcutsModal.style.display = 'flex';
        shortcutsModal.focus();
    }
});
*/

// Initialize
loadAllData();

// Debug functionality
const debugModal = document.getElementById('debugModal');
const debugContent = document.getElementById('debugContent');
const debugCloseBtn = document.getElementById('debugCloseBtn');

async function showDebugModal() {
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
    
    // Open modal with utilities (handles focus trap, escape, etc.)
    ModalUtils.open(debugModal);
}

debugCloseBtn?.addEventListener('click', () => {
    ModalUtils.close();
});

// Search Page functionality
const searchView = document.getElementById('searchView');
const searchUsersInput = document.getElementById('searchUsersInput');
const searchResults = document.getElementById('searchResults');
const navSearchBtn = document.getElementById('navSearchBtn');

// Navigate to search page
navSearchBtn?.addEventListener('click', () => {
    showSearchView();
});

// Search users as user types
let searchTimeout;
searchUsersInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    clearTimeout(searchTimeout);
    
    // If query is empty, reload all users
    if (!query) {
        loadAllSearchableUsers();
        return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            let users = await response.json();
            
            // Filter out current user
            if (API.currentUser) {
                users = users.filter(u => u.username !== API.currentUser.username);
            }
            
            if (users.length === 0) {
                searchResults.innerHTML = `
                    <div class="search-results-empty">
                        <div>🔍</div>
                        <h3>No users found</h3>
                    </div>
                `;
                return;
            }
            
            await renderSearchResults(users);
        } catch (error) {
            console.error('❌ Search error:', error);
            searchResults.innerHTML = `
                <div class="search-results-empty">
                    <p>Search failed. Please try again.</p>
                </div>
            `;
        }
    }, 300); // 300ms debounce
});

// Mobile Bottom Navigation
if (DOM.bottomNavFeed) {
    DOM.bottomNavFeed.addEventListener('click', (e) => {
        e.preventDefault();
        if (API.currentUser) {
            showFeedView();
            updateBottomNavActive('feed');
        }
    });
}

if (DOM.bottomNavSearch) {
    DOM.bottomNavSearch.addEventListener('click', (e) => {
        e.preventDefault();
        showSearchView();
        updateBottomNavActive('search');
    });
}

if (DOM.bottomNavNew) {
    DOM.bottomNavNew.addEventListener('click', (e) => {
        e.preventDefault();
        // If viewing someone else's profile, switch to own profile before creating
        if (API.currentUser && API.viewingUser !== API.currentUser.username) {
            API.viewingUser = API.currentUser.username;
            loadAllData().then(() => createNewRecipe());
        } else {
            createNewRecipe();
        }
        updateBottomNavActive('');
    });
}

if (DOM.bottomNavCollections) {
    DOM.bottomNavCollections.addEventListener('click', (e) => {
        e.preventDefault();
        if (API.currentUser) {
            const username = API.currentUser.username;
            API.viewingUser = username;
            navigate({
                url: `/${username}/collections`,
                title: `Collections - @${username} - Sous`,
                state: { type: 'collections', username }
            });
            loadAllData().then(() => {
                showCollectionsView();
                updateBottomNavActive('collections');
            });
        }
    });
}

if (DOM.bottomNavProfile) {
    DOM.bottomNavProfile.addEventListener('click', (e) => {
        e.preventDefault();
        if (API.currentUser) {
            const username = API.currentUser.username;
            API.viewingUser = username;
            navigate({
                url: `/${username}`,
                title: `@${username} - Sous`,
                state: { type: 'home', username }
            });
            // Reload data for the authenticated user
            loadAllData().then(() => {
                showHomeView();
                updateBottomNavActive('profile');
            });
        }
    });
}

function updateBottomNavActive(view) {
    if (!DOM.mobileBottomNav) return;
    
    // Remove active class from all items
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current view
    switch(view) {
        case 'feed':
            DOM.bottomNavFeed?.classList.add('active');
            break;
        case 'search':
            DOM.bottomNavSearch?.classList.add('active');
            break;
        case 'collections':
            DOM.bottomNavCollections?.classList.add('active');
            break;
        case 'profile':
            DOM.bottomNavProfile?.classList.add('active');
            break;
    }
}

// Show/hide mobile bottom nav based on auth state
function updateMobileBottomNav() {
    if (DOM.mobileBottomNav) {
        if (API.currentUser) {
            DOM.mobileBottomNav.classList.remove('hidden');
        } else {
            DOM.mobileBottomNav.classList.add('hidden');
        }
    }
}

// Shortcuts modal functionality - DISABLED (keyboard shortcuts removed)
/*
const shortcutsModal = document.getElementById('shortcutsModal');
const shortcutsCloseBtn = document.getElementById('shortcutsCloseBtn');

shortcutsCloseBtn?.addEventListener('click', () => {
    shortcutsModal.classList.add('hidden');
});

shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) {
        shortcutsModal.classList.add('hidden');
    }
});

shortcutsModal?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.stopPropagation();
        shortcutsModal.classList.add('hidden');
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
*/
// Logout functionality

async function handleLogout() {
    try {
        console.log('🔐 Logging out...');
        
        // Clear API state first
        API.currentUser = null;
        API.viewingUser = null;
        
        await auth.signOut();
        console.log('✅ Logout successful');
        
        // Clear data
        recipes = [];
        collections = [];
        menus = [];
        currentRecipeId = null;
        currentCollectionId = null;
        currentMenuId = null;
        
        // Force redirect to login page
        window.location.replace('/login');
        
    } catch (error) {
        console.error('❌ Logout failed:', error);
        alert('Failed to log out: ' + error.message);
    }
}

// Logout button handler

