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
    }
};

// Data management
let recipes = [];
let collections = [];
let currentRecipeId = null;
let currentCollectionId = null;
let currentView = 'collections';
let isEditMode = true;

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const floatingMenuBtn = document.getElementById('floatingMenuBtn');
const filterInput = document.getElementById('filterInput');
const sidebarContent = document.getElementById('sidebarContent');
const collectionsList = document.getElementById('collectionsList');
const recipeList = document.getElementById('recipeList');
const newItemBtn = document.getElementById('newItemBtn');
const newItemText = document.getElementById('newItemText');
const collectionsViewBtn = document.getElementById('collectionsViewBtn');
const recipesViewBtn = document.getElementById('recipesViewBtn');
const emptyState = document.getElementById('emptyState');
const collectionView = document.getElementById('collectionView');
const editorView = document.getElementById('editorView');
const titleInput = document.getElementById('titleInput');
const titleDisplay = document.getElementById('titleDisplay');
const markdownTextarea = document.getElementById('markdownTextarea');
const previewContent = document.getElementById('previewContent');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const deleteBtn2 = document.getElementById('deleteBtn2');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const collectionsBtn = document.getElementById('collectionsBtn');
const editControls = document.getElementById('editControls');
const editModeControls = document.getElementById('editModeControls');
const cancelBtn = document.getElementById('cancelBtn');
const backBtn = document.getElementById('backBtn');
const backBtnText = document.getElementById('backBtnText');
const backToCollections = document.getElementById('backToCollections');
const collectionTitle = document.getElementById('collectionTitle');
const collectionDescription = document.getElementById('collectionDescription');
const collectionRecipes = document.getElementById('collectionRecipes');
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

// View toggle
collectionsViewBtn.addEventListener('click', () => {
    switchToCollectionsView();
});

recipesViewBtn.addEventListener('click', () => {
    switchToRecipesView();
});

function switchToCollectionsView() {
    currentView = 'collections';
    collectionsViewBtn.classList.add('active');
    recipesViewBtn.classList.remove('active');
    collectionsList.classList.remove('hidden');
    recipeList.classList.add('hidden');
    newItemText.textContent = 'New Collection';
    filterInput.placeholder = 'Search collections...';
    renderCollectionsList();
    showEmptyState();
}

function switchToRecipesView() {
    currentView = 'recipes';
    collectionsViewBtn.classList.remove('active');
    recipesViewBtn.classList.add('active');
    collectionsList.classList.add('hidden');
    recipeList.classList.remove('hidden');
    newItemText.textContent = 'New Recipe';
    filterInput.placeholder = 'Search recipes...';
    renderRecipeList();
    showEmptyState();
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
            loadCollection(id, false);
        }
    }
}

window.addEventListener('popstate', (e) => {
    if (e.state) {
        if (e.state.type === 'recipe') {
            loadRecipe(e.state.id, false);
        } else if (e.state.type === 'collection') {
            loadCollection(e.state.id, false);
        }
    } else {
        showEmptyState();
    }
});

// Render collections list
function renderCollectionsList(filter = '') {
    const lowerFilter = filter.toLowerCase();
    const filtered = collections.filter(col => 
        col.name.toLowerCase().includes(lowerFilter)
    );

    collectionsList.innerHTML = filtered.map(col => {
        const recipeCount = col.recipeIds ? col.recipeIds.length : 0;
        return `
            <div 
                class="collection-item ${col.id === currentCollectionId ? 'active' : ''}" 
                data-id="${col.id}"
                role="listitem"
                tabindex="0">
                <div class="collection-item-name">${escapeHtml(col.name)}</div>
                <div class="collection-item-count">${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}</div>
            </div>
        `;
    }).join('');

    collectionsList.querySelectorAll('.collection-item').forEach(item => {
        item.addEventListener('click', () => loadCollection(item.dataset.id));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadCollection(item.dataset.id);
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

    recipeList.innerHTML = filtered.map(recipe => `
        <div 
            class="recipe-item ${recipe.id === currentRecipeId ? 'active' : ''}" 
            data-id="${recipe.id}"
            role="listitem"
            tabindex="0">
            <div class="recipe-item-title">${escapeHtml(recipe.title || 'Untitled')}</div>
            <div class="recipe-item-date">${formatDate(recipe.updatedAt)}</div>
        </div>
    `).join('');

    recipeList.querySelectorAll('.recipe-item').forEach(item => {
        item.addEventListener('click', () => loadRecipe(item.dataset.id));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadRecipe(item.dataset.id);
            }
        });
    });
}

// Load collection
function loadCollection(id, updateUrl = true) {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;

    currentCollectionId = id;
    currentView = 'collection-detail';
    
    emptyState.classList.add('hidden');
    editorView.classList.add('hidden');
    editControls.classList.add('hidden');
    editModeControls.classList.add('hidden');
    
    collectionView.classList.remove('hidden');
    
    collectionTitle.textContent = collection.name;
    collectionDescription.textContent = collection.description || '';
    
    const collectionRecipeIds = collection.recipeIds || [];
    const collectionRecipeList = recipes.filter(r => collectionRecipeIds.includes(r.id));
    
    collectionRecipes.innerHTML = collectionRecipeList.length > 0 
        ? collectionRecipeList.map(recipe => `
            <div class="collection-recipe-card" data-id="${recipe.id}" tabindex="0">
                <div class="collection-recipe-title">${escapeHtml(recipe.title || 'Untitled')}</div>
                <div class="collection-recipe-date">${formatDate(recipe.updatedAt)}</div>
            </div>
        `).join('')
        : '<p style="color: #999; font-style: italic;">No recipes in this collection yet</p>';
    
    collectionRecipes.querySelectorAll('.collection-recipe-card').forEach(card => {
        card.addEventListener('click', () => loadRecipe(card.dataset.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadRecipe(card.dataset.id);
            }
        });
    });
    
    renderCollectionsList();
    
    if (updateUrl) {
        updateURL('collection', id);
    }
}

// Load recipe
function loadRecipe(id, updateUrl = true) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    currentRecipeId = id;
    currentView = 'recipe-detail';
    titleInput.value = recipe.title;
    markdownTextarea.value = recipe.content;
    
    emptyState.classList.add('hidden');
    collectionView.classList.add('hidden');
    
    editorView.classList.remove('hidden');
    
    backBtn.classList.remove('hidden');
    if (currentCollectionId) {
        const collection = collections.find(c => c.id === currentCollectionId);
        backBtnText.textContent = collection ? collection.name : 'Back';
    } else {
        backBtnText.textContent = 'All Recipes';
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

// Show empty state
function showEmptyState() {
    emptyState.classList.remove('hidden');
    collectionView.classList.add('hidden');
    editorView.classList.add('hidden');
    editControls.classList.add('hidden');
    editModeControls.classList.add('hidden');
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
        
        renderCollectionsList();
        renderRecipeList();
        loadFromURL();
        
        if (!currentRecipeId && !currentCollectionId) {
            showEmptyState();
        }
    } catch (error) {
        console.error('💥 Critical error loading data:', error);
        alert('Failed to connect to server. Please check your connection and try refreshing the page.');
    }
}

// Create new item
async function createNewItem() {
    if (currentView === 'collections') {
        await createNewCollection();
    } else {
        await createNewRecipe();
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
        renderCollectionsList(filterInput.value);
    } catch (error) {
        alert('Error creating collection');
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
        
        editorView.classList.remove('hidden');
        emptyState.classList.add('hidden');
        collectionView.classList.add('hidden');
        backBtn.classList.remove('hidden');
        
        enterEditMode();
        renderRecipeList(filterInput.value);
        updateURL('recipe', newRecipe.id);
    } catch (error) {
        alert('Error creating recipe');
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
            loadCollection(currentCollectionId, false);
        } else {
            showEmptyState();
        }
        updateURL(null, null);
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
                await API.updateCollection(col.id, col);
            } else if (!shouldBeIn && isIn) {
                col.recipeIds = col.recipeIds.filter(id => id !== currentRecipeId);
                await API.updateCollection(col.id, col);
            }
        }
        
        collectionModal.classList.add('hidden');
        renderCollectionsList(filterInput.value);
    } catch (error) {
        alert('Error updating collections');
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
    if (currentView === 'collections') {
        renderCollectionsList(e.target.value);
    } else {
        renderRecipeList(e.target.value);
    }
});

newItemBtn.addEventListener('click', createNewItem);
editBtn.addEventListener('click', enterEditMode);
saveBtn.addEventListener('click', saveCurrentRecipe);
deleteBtn.addEventListener('click', deleteCurrentRecipe);
deleteBtn2.addEventListener('click', deleteCurrentRecipe);
copyLinkBtn.addEventListener('click', copyRecipeLink);
collectionsBtn.addEventListener('click', showCollectionModal);
modalSaveBtn.addEventListener('click', saveCollectionChanges);
modalCancelBtn.addEventListener('click', () => collectionModal.classList.add('hidden'));

backBtn.addEventListener('click', () => {
    if (currentCollectionId) {
        loadCollection(currentCollectionId);
    } else {
        switchToRecipesView();
    }
});

backToCollections.addEventListener('click', () => {
    switchToCollectionsView();
});

cancelBtn.addEventListener('click', () => {
    if (titleInput.value || markdownTextarea.value) {
        enterViewMode();
    } else {
        if (currentCollectionId) {
            loadCollection(currentCollectionId);
        } else {
            showEmptyState();
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
