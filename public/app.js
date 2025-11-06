// API helper functions
const API = {
    async handleResponse(res) {
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(error.error || `Request failed with status ${res.status}`);
        }
        return res.json();
    },
    
    async getRecipes() {
        console.log('🔄 Fetching recipes...');
        const res = await fetch('/api/recipes');
        const data = await this.handleResponse(res);
        console.log('✅ Received recipes:', data.length, 'items');
        return data;
    },
    
    async getRecipe(id) {
        console.log('🔄 Fetching recipe:', id);
        const res = await fetch(`/api/recipes/${id}`);
        return this.handleResponse(res);
    },
    
    async createRecipe(data) {
        console.log('🔄 Creating recipe:', data);
        const res = await fetch('/api/recipes', {
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
        const res = await fetch(`/api/recipes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async deleteRecipe(id) {
        console.log('🔄 Deleting recipe:', id);
        const res = await fetch(`/api/recipes/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    async getCollections() {
        console.log('🔄 Fetching collections...');
        const res = await fetch('/api/collections');
        const data = await this.handleResponse(res);
        console.log('✅ Received collections:', data.length, 'items');
        return data;
    },
    
    async createCollection(data) {
        console.log('🔄 Creating collection:', data);
        const res = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async updateCollection(id, data) {
        console.log('🔄 Updating collection:', id, data);
        const res = await fetch(`/api/collections/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    },
    
    async deleteCollection(id) {
        console.log('🔄 Deleting collection:', id);
        const res = await fetch(`/api/collections/${id}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },
    
    async removeRecipeFromCollection(collectionId, recipeId) {
        console.log('🔄 Removing recipe from collection:', { collectionId, recipeId });
        const res = await fetch(`/api/collections/${collectionId}/recipes/${recipeId}`, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    }
};

// Data management
let recipes = [];
let collections = [];
let currentRecipeId = null;
let currentCollectionId = null;
let currentView = 'home'; // home, collections, collection-detail, recipe-detail
let isEditMode = true;

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const floatingMenuBtn = document.getElementById('floatingMenuBtn');
const filterInput = document.getElementById('filterInput');
const recipeList = document.getElementById('recipeList');
const newRecipeBtn = document.getElementById('newRecipeBtn');

// Navbar elements
const navbar = document.getElementById('navbar');
const homeBtn = document.getElementById('homeBtn');

// View sections
const homeView = document.getElementById('homeView');
const collectionsView = document.getElementById('collectionsView');
const collectionDetailView = document.getElementById('collectionDetailView');
const recipeDetailView = document.getElementById('recipeDetailView');
const emptyState = document.getElementById('emptyState');

// Collections elements
const collectionsGrid = document.getElementById('collectionsGrid');
const newCollectionBtn = document.getElementById('newCollectionBtn');
const collectionTitle = document.getElementById('collectionTitle');
const collectionDescription = document.getElementById('collectionDescription');
const collectionRecipes = document.getElementById('collectionRecipes');

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
const collectionModal = document.getElementById('collectionModal');
const collectionCheckboxes = document.getElementById('collectionCheckboxes');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Markdown configuration
marked.setOptions({
    breaks: true,
    gfm: true
});

// Sidebar toggle
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

floatingMenuBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
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

// Navigation
homeBtn.addEventListener('click', () => {
    switchToView('collections');
    currentRecipeId = null;
    currentCollectionId = null;
    updateURL(null, null);
});

// Navigation system
function switchToView(viewName) {
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
            break;
        case 'collection-detail':
            collectionDetailView.classList.remove('hidden');
            collectionDetailView.classList.add('active');
            homeBtn.classList.add('active');
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
    if (!id) {
        history.pushState(null, '', '/');
        return;
    }
    
    if (type === 'recipe') {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        const slug = recipe.title ? slugify(recipe.title) : 'untitled';
        history.pushState({ type: 'recipe', id }, '', `/recipe/${slug}-${id}`);
    } else if (type === 'collection') {
        const collection = collections.find(c => c.id === id);
        if (!collection) return;
        const slug = slugify(collection.name);
        history.pushState({ type: 'collection', id }, '', `/collection/${slug}-${id}`);
    }
}

function loadFromURL() {
    const path = window.location.pathname;
    
    const recipeMatch = path.match(/^\/recipe\/.+-([a-zA-Z0-9]+)$/);
    const collectionMatch = path.match(/^\/collection\/.+-([a-zA-Z0-9]+)$/);
    
    if (recipeMatch) {
        const id = recipeMatch[1];
        const recipe = recipes.find(r => r.id === id);
        if (recipe) {
            loadRecipe(id, false);
        }
    } else if (collectionMatch) {
        const id = collectionMatch[1];
        const collection = collections.find(c => c.id === id);
        if (collection) {
            loadCollectionDetail(id, false);
        }
    } else if (path === '/collections') {
        switchToView('collections');
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
        }
    } else {
        const path = window.location.pathname;
        if (path === '/collections') {
            switchToView('collections');
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
        
        // Hide back button when breadcrumb is shown
        backBtn.classList.add('hidden');
    } else {
        // Hide breadcrumb and back button for sidebar navigation
        breadcrumb.classList.add('hidden');
        backBtn.classList.add('hidden');
    }
    
    enterViewMode();
    renderRecipeList(filterInput.value);
    
    if (updateUrl) {
        updateURL('recipe', id);
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
    previewContent.innerHTML = marked.parse(markdownTextarea.value || '');
}

// Show home view (collections)
function showHomeView() {
    switchToView('collections');
    currentRecipeId = null;
    currentCollectionId = null;
}

// Load all data
async function loadAllData() {
    console.log('🚀 Loading all data...');
    try {
        const [recipesData, collectionsData] = await Promise.all([
            API.getRecipes().catch(err => {
                console.error('❌ Failed to load recipes:', err.message);
                return [];
            }),
            API.getCollections().catch(err => {
                console.error('❌ Failed to load collections:', err.message);
                return [];
            })
        ]);
        
        recipes = recipesData;
        collections = collectionsData;
        
        console.log('📊 Data loaded - Recipes:', recipes.length, 'Collections:', collections.length);
        
        renderRecipeList();
        loadFromURL();
        
        if (!currentRecipeId && !currentCollectionId) {
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
        backBtn.classList.remove('hidden');
        backBtnText.textContent = 'Recipes';
        
        enterEditMode();
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
                <input type="checkbox" id="col-${col.id}" ${isInCollection ? 'checked' : ''}>
                <label for="col-${col.id}">${escapeHtml(col.name)}</label>
            </div>
        `;
    }).join('');
    
    collectionModal.classList.remove('hidden');
}

// Save collection changes
async function saveCollectionChanges() {
    try {
        for (const col of collections) {
            const checkbox = document.getElementById(`col-${col.id}`);
            if (!checkbox) continue;
            
            if (!col.recipeIds) col.recipeIds = [];
            
            const shouldBeIn = checkbox.checked;
            const isIn = col.recipeIds.includes(currentRecipeId);
            
            if (shouldBeIn && !isIn) {
                col.recipeIds.push(currentRecipeId);
                console.log('🔄 Adding recipe to collection:', col.name);
                const result = await API.updateCollection(col.id, col);
                console.log('✅ Successfully added recipe to collection:', result);
            } else if (!shouldBeIn && isIn) {
                col.recipeIds = col.recipeIds.filter(id => id !== currentRecipeId);
                console.log('🔄 Removing recipe from collection:', col.name);
                const result = await API.updateCollection(col.id, col);
                console.log('✅ Successfully removed recipe from collection:', result);
            }
        }
        
        collectionModal.classList.add('hidden');
        renderRecipeList(filterInput.value);
        console.log('✅ All collection changes saved successfully');
    } catch (error) {
        console.error('❌ Error updating collections:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Error updating collections: ${error.message}`);
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

newRecipeBtn.addEventListener('click', createNewRecipe);
newCollectionBtn.addEventListener('click', createNewCollection);
editBtn.addEventListener('click', enterEditMode);
saveBtn.addEventListener('click', saveCurrentRecipe);
deleteBtn.addEventListener('click', deleteCurrentRecipe);
deleteBtn2.addEventListener('click', deleteCurrentRecipe);
copyLinkBtn.addEventListener('click', copyRecipeLink);
addToCollectionBtn.addEventListener('click', showCollectionModal);
modalSaveBtn.addEventListener('click', saveCollectionChanges);
modalCancelBtn.addEventListener('click', () => collectionModal.classList.add('hidden'));

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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditMode && currentRecipeId) {
            saveCurrentRecipe();
        }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewItem();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (currentRecipeId) {
            if (isEditMode) {
                saveCurrentRecipe();
            } else {
                enterEditMode();
            }
        }
    }
    
    if (e.key === 'Escape') {
        if (isEditMode && currentRecipeId) {
            enterViewMode();
        } else if (!collectionModal.classList.contains('hidden')) {
            collectionModal.classList.add('hidden');
        }
    }
});

// Initialize
loadAllData();
