interface PreservedState {
  route: string;
  scrollPosition: number;
  formData: Record<string, any>;
  userAction: string;
  componentState: Record<string, any>;
  timestamp: number;
  searchParams: string;
  hash: string;
}

interface FormField {
  name: string;
  value: string | number | boolean;
  type: string;
  checked?: boolean;
  selected?: boolean;
}

export class StatePreservationManager {
  private static instance: StatePreservationManager;
  private preservedStates: Map<string, PreservedState> = new Map();
  private autoSaveInterval?: NodeJS.Timeout;
  private isRestoring = false;

  static getInstance(): StatePreservationManager {
    if (!StatePreservationManager.instance) {
      StatePreservationManager.instance = new StatePreservationManager();
    }
    return StatePreservationManager.instance;
  }

  constructor() {
    this.startAutoSave();
    this.setupEventListeners();
  }

  private startAutoSave() {
    // Auto-save state every 5 seconds
    this.autoSaveInterval = setInterval(() => {
      this.saveCurrentState('auto-save');
    }, 5000);
  }

  private setupEventListeners() {
    // Save state before page unload
    window.addEventListener('beforeunload', () => {
      this.saveCurrentState('before-unload');
    });

    // Save state on route changes
    window.addEventListener('popstate', () => {
      this.saveCurrentState('route-change');
    });

    // Save state on form interactions
    document.addEventListener('input', (e) => {
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          e.target instanceof HTMLSelectElement) {
        this.debouncedSaveState();
      }
    });

    // Save state on scroll
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.saveScrollPosition();
      }, 100);
    });
  }

  private debouncedSaveState = (() => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.saveCurrentState('form-interaction');
      }, 300);
    };
  })();

  saveCurrentState(reason: string): string {
    try {
      const stateId = `${Date.now()}_${reason}`;
      
      const state: PreservedState = {
        route: window.location.pathname,
        scrollPosition: window.scrollY,
        formData: this.captureFormData(),
        userAction: reason,
        componentState: this.captureComponentState(),
        timestamp: Date.now(),
        searchParams: window.location.search,
        hash: window.location.hash
      };

      // Store in memory
      this.preservedStates.set(stateId, state);

      // Store in session storage for persistence across reloads
      try {
        sessionStorage.setItem(`preserved_state_${stateId}`, JSON.stringify(state));
        sessionStorage.setItem('latest_state_id', stateId);
      } catch (e) {
        console.warn('Could not save to session storage:', e);
      }

      // Keep only last 5 states in memory
      if (this.preservedStates.size > 5) {
        const oldestKey = this.preservedStates.keys().next().value;
        this.preservedStates.delete(oldestKey);
        try {
          sessionStorage.removeItem(`preserved_state_${oldestKey}`);
        } catch (e) {
          // Ignore storage errors
        }
      }

      console.log(`💾 State saved: ${stateId} (${reason})`);
      return stateId;

    } catch (error) {
      console.error('❌ Failed to save state:', error);
      return '';
    }
  }

  private captureFormData(): Record<string, any> {
    const formData: Record<string, any> = {};
    
    try {
      // Capture all form inputs
      const inputs = document.querySelectorAll('input, textarea, select');
      
      inputs.forEach((input, index) => {
        if (input instanceof HTMLInputElement) {
          const field: FormField = {
            name: input.name || `input_${index}`,
            value: input.type === 'checkbox' || input.type === 'radio' ? input.checked : input.value,
            type: input.type,
            checked: input.checked
          };
          formData[field.name] = field;
        } else if (input instanceof HTMLTextAreaElement) {
          formData[input.name || `textarea_${index}`] = {
            name: input.name || `textarea_${index}`,
            value: input.value,
            type: 'textarea'
          };
        } else if (input instanceof HTMLSelectElement) {
          formData[input.name || `select_${index}`] = {
            name: input.name || `select_${index}`,
            value: input.value,
            type: 'select',
            selected: input.selectedIndex
          };
        }
      });

    } catch (error) {
      console.warn('Could not capture form data:', error);
    }

    return formData;
  }

  private captureComponentState(): Record<string, any> {
    const componentState: Record<string, any> = {};
    
    try {
      // Capture React component states from common patterns
      
      // Search for elements with data attributes that might contain state
      const stateElements = document.querySelectorAll('[data-state], [data-value], [data-selected]');
      
      stateElements.forEach((element, index) => {
        const key = element.getAttribute('data-key') || `component_${index}`;
        componentState[key] = {
          state: element.getAttribute('data-state'),
          value: element.getAttribute('data-value'),
          selected: element.getAttribute('data-selected'),
          className: element.className
        };
      });

      // Capture modal/dialog states
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-modal]');
      if (modals.length > 0) {
        componentState.modals = Array.from(modals).map(modal => ({
          isOpen: !modal.hasAttribute('hidden') && !modal.classList.contains('hidden'),
          className: modal.className,
          id: modal.id
        }));
      }

      // Capture active tabs
      const activeTabs = document.querySelectorAll('[role="tab"][aria-selected="true"], .tab-active');
      if (activeTabs.length > 0) {
        componentState.activeTabs = Array.from(activeTabs).map(tab => ({
          id: tab.id,
          textContent: tab.textContent,
          index: Array.from(tab.parentNode?.children || []).indexOf(tab)
        }));
      }

    } catch (error) {
      console.warn('Could not capture component state:', error);
    }

    return componentState;
  }

  private saveScrollPosition() {
    try {
      const latestStateId = sessionStorage.getItem('latest_state_id');
      if (latestStateId) {
        const stateStr = sessionStorage.getItem(`preserved_state_${latestStateId}`);
        if (stateStr) {
          const state = JSON.parse(stateStr);
          state.scrollPosition = window.scrollY;
          sessionStorage.setItem(`preserved_state_${latestStateId}`, JSON.stringify(state));
        }
      }
    } catch (error) {
      console.warn('Could not save scroll position:', error);
    }
  }

  async restoreState(stateId?: string): Promise<boolean> {
    if (this.isRestoring) return false;
    
    this.isRestoring = true;
    
    try {
      // Use provided stateId or get the latest one
      const targetStateId = stateId || sessionStorage.getItem('latest_state_id');
      if (!targetStateId) {
        console.log('No state to restore');
        return false;
      }

      // Get state from memory or session storage
      let state = this.preservedStates.get(targetStateId);
      if (!state) {
        const stateStr = sessionStorage.getItem(`preserved_state_${targetStateId}`);
        if (stateStr) {
          state = JSON.parse(stateStr);
        }
      }

      if (!state) {
        console.log('State not found:', targetStateId);
        return false;
      }

      console.log(`🔄 Restoring state: ${targetStateId}`);

      // Restore route if different
      const currentRoute = window.location.pathname + window.location.search + window.location.hash;
      const targetRoute = state.route + state.searchParams + state.hash;
      
      if (currentRoute !== targetRoute) {
        window.history.replaceState({}, '', targetRoute);
      }

      // Wait for any route changes to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore form data
      await this.restoreFormData(state.formData);

      // Restore component state
      await this.restoreComponentState(state.componentState);

      // Restore scroll position
      if (state.scrollPosition > 0) {
        window.scrollTo({
          top: state.scrollPosition,
          behavior: 'smooth'
        });
      }

      console.log('✅ State restoration complete');
      return true;

    } catch (error) {
      console.error('❌ Failed to restore state:', error);
      return false;
    } finally {
      this.isRestoring = false;
    }
  }

  private async restoreFormData(formData: Record<string, any>): Promise<void> {
    try {
      Object.values(formData).forEach((field: any) => {
        const element = document.querySelector(`[name="${field.name}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        
        if (!element) return;

        if (element instanceof HTMLInputElement) {
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = field.checked || false;
          } else {
            element.value = field.value || '';
          }
          
          // Trigger change event for React
          element.dispatchEvent(new Event('input', { bubbles: true }));
          
        } else if (element instanceof HTMLTextAreaElement) {
          element.value = field.value || '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          
        } else if (element instanceof HTMLSelectElement) {
          element.value = field.value || '';
          if (field.selected !== undefined) {
            element.selectedIndex = field.selected;
          }
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    } catch (error) {
      console.warn('Could not restore form data:', error);
    }
  }

  private async restoreComponentState(componentState: Record<string, any>): Promise<void> {
    try {
      // Restore modal states
      if (componentState.modals) {
        componentState.modals.forEach((modalState: any) => {
          const modal = document.getElementById(modalState.id) || 
                       document.querySelector(`.${modalState.className.split(' ')[0]}`);
          
          if (modal && modalState.isOpen) {
            modal.removeAttribute('hidden');
            modal.classList.remove('hidden');
          }
        });
      }

      // Restore active tabs
      if (componentState.activeTabs) {
        componentState.activeTabs.forEach((tabState: any) => {
          const tab = document.getElementById(tabState.id);
          if (tab) {
            tab.setAttribute('aria-selected', 'true');
            tab.classList.add('tab-active');
            tab.click(); // Trigger tab activation
          }
        });
      }

      // Restore other component states
      Object.entries(componentState).forEach(([key, value]: [string, any]) => {
        if (key === 'modals' || key === 'activeTabs') return;
        
        const element = document.querySelector(`[data-key="${key}"]`);
        if (element && value) {
          if (value.state) element.setAttribute('data-state', value.state);
          if (value.value) element.setAttribute('data-value', value.value);
          if (value.selected) element.setAttribute('data-selected', value.selected);
        }
      });

    } catch (error) {
      console.warn('Could not restore component state:', error);
    }
  }

  getPreservedStates(): PreservedState[] {
    return Array.from(this.preservedStates.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  clearPreservedStates() {
    this.preservedStates.clear();
    
    // Clear from session storage
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('preserved_state_')) {
          sessionStorage.removeItem(key);
        }
      });
      sessionStorage.removeItem('latest_state_id');
    } catch (error) {
      console.warn('Could not clear preserved states from storage:', error);
    }
  }

  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.clearPreservedStates();
  }
}

export default StatePreservationManager;
