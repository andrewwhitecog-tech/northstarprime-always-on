/**
 * EventBus.js - Decoupled Pub/Sub Message Engine
 * Inspired by @fullstackpeter reel DJ-LgfoTTZk ("What is pub/sub in programming?")
 * 
 * Guarantees zero tight coupling between player controller, combat physics,
 * System 1 AI agents, AI Director, audio synthesis, and HUD telemetry.
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe a listener callback to an event channel.
   * @param {string} eventName
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    const handlers = this.listeners.get(eventName);
    handlers.add(callback);

    return () => {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  /**
   * Subscribe a callback that fires once then auto-unsubscribes.
   * @param {string} eventName 
   * @param {Function} callback 
   */
  subscribeOnce(eventName, callback) {
    const unsub = this.subscribe(eventName, (data) => {
      unsub();
      callback(data);
    });
  }

  /**
   * Publish an event payload to all subscribed listeners.
   * @param {string} eventName 
   * @param {Object} payload 
   */
  publish(eventName, payload = {}) {
    const timestamp = performance.now();
    const eventRecord = {
      event: eventName,
      payload,
      timestamp
    };

    // Keep bounded rolling history for telemetry & UI inspect
    this.history.push(eventRecord);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.listeners.has(eventName)) {
      const handlers = this.listeners.get(eventName);
      handlers.forEach(fn => {
        try {
          fn(payload, timestamp);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${eventName}":`, err);
        }
      });
    }

    // Also dispatch to wildcard listeners if any
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(fn => {
        try {
          fn(eventName, payload, timestamp);
        } catch (err) {
          console.error(`[EventBus] Error in wildcard handler for "${eventName}":`, err);
        }
      });
    }
  }

  /**
   * Get the latest N events for debug HUD
   * @param {number} count 
   * @returns {Array}
   */
  getRecentEvents(count = 10) {
    return this.history.slice(-count);
  }

  clear() {
    this.listeners.clear();
    this.history = [];
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}
if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
}
