/**
 * Client-side JavaScript for Muslim Space Link
 * Provides interactive functionality for the admin interface
 */

(function() {
  'use strict';

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    initCopyToClipboard();
    initConfirmDialogs();
    initAutoRefresh();
  });

  /**
   * Copy link to clipboard
   */
  function initCopyToClipboard() {
    const copyButtons = document.querySelectorAll('[data-copy]');
    
    copyButtons.forEach(button => {
      button.addEventListener('click', async function(e) {
        e.preventDefault();
        const target = this.getAttribute('data-copy');
        const textToCopy = this.getAttribute('data-value') || 
          document.querySelector(target)?.textContent;
        
        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy.trim());
            showNotification('Copied to clipboard!', 'success');
          } catch (err) {
            showNotification('Failed to copy', 'error');
          }
        }
      });
    });
  }

  /**
   * Show confirmation dialogs for destructive actions
   */
  function initConfirmDialogs() {
    const confirmButtons = document.querySelectorAll('[data-confirm]');
    
    confirmButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        const message = this.getAttribute('data-confirm') || 'Are you sure?';
        if (!confirm(message)) {
          e.preventDefault();
          return false;
        }
      });
    });
  }

  /**
   * Auto-refresh page for stats (optional)
   */
  function initAutoRefresh() {
    const autoRefresh = document.querySelector('[data-auto-refresh]');
    if (autoRefresh) {
      const interval = parseInt(autoRefresh.getAttribute('data-auto-refresh')) || 30000;
      setTimeout(() => {
        window.location.reload();
      }, interval);
    }
  }

  /**
   * Show notification toast
   */
  function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * HTMX configuration
   */
  if (typeof htmx !== 'undefined') {
    htmx.config.defaultSwapStyle = 'innerHTML';
    htmx.config.defaultSettleDelay = 50;
  }

})();