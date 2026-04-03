/**
 * FacetStore - Global state management for cross-view synchronization
 * Manages shared state across Graph, Tree, List, and Knowledge views
 */
class FacetStore {
  constructor() {
    this.state = {
      selectedCharacterIds: [],
      selectedTags: [],
      selectedFamily: null,
      selectedChapter: null,
      selectedCategory: null,
      selectedRelationTypes: [],
      query: '',
      selectionMode: 'highlight',
      sourceView: 'graph',
      breadcrumb: [{ label: '默认概览', type: 'overview' }]
    };
    
    this.listeners = new Map();
    this.viewSubscriptions = new Map();
    this._batchUpdate = false;
    this._pendingChanges = new Set();
  }

  /**
   * Subscribe a view to state changes
   * @param {string} viewName - Name of the view (graph, tree, list, knowledge)
   * @param {Function} callback - Callback function(state, changedKeys)
   * @param {Array} keys - Specific keys to listen for (optional)
   */
  subscribe(viewName, callback, keys = null) {
    if (!this.listeners.has(viewName)) {
      this.listeners.set(viewName, []);
    }
    this.listeners.get(viewName).push({ callback, keys });
    this.viewSubscriptions.set(viewName, keys);
  }

  /**
   * Unsubscribe a view from state changes
   */
  unsubscribe(viewName) {
    this.listeners.delete(viewName);
    this.viewSubscriptions.delete(viewName);
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Update state (single key or object)
   */
  set(updates, sourceView = 'unknown') {
    const changedKeys = [];
    
    if (typeof updates === 'string') {
      throw new Error('FacetStore.set() requires an object. Use setValue(key, value) for single values.');
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changedKeys.push(key);
      }
    });

    if (changedKeys.length) {
      this.state.sourceView = sourceView;
      if (this._batchUpdate) {
        changedKeys.forEach(key => this._pendingChanges.add(key));
      } else {
        this._notify(changedKeys);
      }
    }
  }

  /**
   * Set a single value
   */
  setValue(key, value, sourceView = 'unknown') {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.state.sourceView = sourceView;
      if (this._batchUpdate) {
        this._pendingChanges.add(key);
      } else {
        this._notify([key]);
      }
    }
  }

  /**
   * Toggle a character selection
   */
  toggleCharacter(characterId, sourceView = 'unknown') {
    const currentIds = new Set(this.state.selectedCharacterIds);
    if (currentIds.has(characterId)) {
      currentIds.delete(characterId);
    } else {
      currentIds.add(characterId);
    }
    this.setValue('selectedCharacterIds', Array.from(currentIds), sourceView);
  }

  /**
   * Set multiple character IDs at once
   */
  setCharacters(characterIds, sourceView = 'unknown') {
    this.setValue('selectedCharacterIds', Array.from(characterIds), sourceView);
  }

  /**
   * Clear all character selections
   */
  clearCharacters(sourceView = 'unknown') {
    this.setValue('selectedCharacterIds', [], sourceView);
  }

  /**
   * Toggle a tag selection
   */
  toggleTag(tag, sourceView = 'unknown') {
    const currentTags = new Set(this.state.selectedTags);
    if (currentTags.has(tag)) {
      currentTags.delete(tag);
    } else {
      currentTags.add(tag);
    }
    this.setValue('selectedTags', Array.from(currentTags), sourceView);
  }

  /**
   * Set breadcrumb trail
   */
  setBreadcrumb(breadcrumb, sourceView = 'unknown') {
    this.setValue('breadcrumb', breadcrumb, sourceView);
  }

  /**
   * Push a breadcrumb item
   */
  pushBreadcrumb(item, sourceView = 'unknown') {
    const newBreadcrumb = [...this.state.breadcrumb, item];
    this.setValue('breadcrumb', newBreadcrumb, sourceView);
  }

  /**
   * Reset to initial state
   */
  reset(sourceView = 'unknown') {
    this.set({
      selectedCharacterIds: [],
      selectedTags: [],
      selectedFamily: null,
      selectedChapter: null,
      selectedCategory: null,
      selectedRelationTypes: [],
      query: '',
      selectionMode: 'highlight',
      breadcrumb: [{ label: '默认概览', type: 'overview' }]
    }, sourceView);
  }

  /**
   * Begin batch update (prevents notification until batchEnd)
   */
  batchStart() {
    this._batchUpdate = true;
    this._pendingChanges.clear();
  }

  /**
   * End batch update and notify all listeners
   */
  batchEnd(sourceView = 'unknown') {
    this._batchUpdate = false;
    if (this._pendingChanges.size) {
      const changes = Array.from(this._pendingChanges);
      this._pendingChanges.clear();
      this.state.sourceView = sourceView;
      this._notify(changes);
    }
  }

  /**
   * Check if a character is selected
   */
  isCharacterSelected(characterId) {
    return this.state.selectedCharacterIds.includes(characterId);
  }

  /**
   * Check if a tag is selected
   */
  isTagSelected(tag) {
    return this.state.selectedTags.includes(tag);
  }

  /**
   * Get selection summary
   */
  getSelectionSummary() {
    return {
      characterCount: this.state.selectedCharacterIds.length,
      tagCount: this.state.selectedTags.length,
      hasSelection: this.state.selectedCharacterIds.length > 0 || this.state.selectedTags.length > 0,
      mode: this.state.selectionMode
    };
  }

  /**
   * Notify all listeners of state changes
   * @private
   */
  _notify(changedKeys) {
    this.listeners.forEach((subscriptions, viewName) => {
      subscriptions.forEach(({ callback, keys }) => {
        if (keys === null || changedKeys.some(key => keys.includes(key))) {
          try {
            callback(this.getState(), changedKeys);
          } catch (err) {
            console.error(`FacetStore: Error notifying ${viewName}:`, err);
          }
        }
      });
    });
  }
}

// Create singleton instance
const facetStore = new FacetStore();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FacetStore, facetStore };
}
