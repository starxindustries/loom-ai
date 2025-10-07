/**
 * LocalStorage Service
 * Provides a consistent interface for managing localStorage data across the application
 */

export class LocalStorageService {
  private static isClient(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Get a value from localStorage
   * @param key - The key to retrieve
   * @param defaultValue - Default value if key doesn't exist
   * @returns The stored value or default value
   */
  static get<T>(key: string, defaultValue: T): T {
    if (!this.isClient()) {
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set a value in localStorage
   * @param key - The key to store
   * @param value - The value to store
   */
  static set<T>(key: string, value: T): void {
    if (!this.isClient()) {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }

  /**
   * Remove a value from localStorage
   * @param key - The key to remove
   */
  static remove(key: string): void {
    if (!this.isClient()) {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage key "${key}":`, error);
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param key - The key to check
   * @returns True if key exists, false otherwise
   */
  static has(key: string): boolean {
    if (!this.isClient()) {
      return false;
    }

    return localStorage.getItem(key) !== null;
  }

  /**
   * Clear all localStorage data
   */
  static clear(): void {
    if (!this.isClient()) {
      return;
    }

    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
}

// Specific service for robot settings
export class RobotSettingsService {
  private static readonly ROBOT_ENABLED_KEY = 'loom_ai_robot_enabled';

  /**
   * Get robot enabled state from localStorage
   * @returns True if robot is enabled, false otherwise
   */
  static isRobotEnabled(): boolean {
    return LocalStorageService.get(this.ROBOT_ENABLED_KEY, true); // Default to enabled
  }

  /**
   * Set robot enabled state in localStorage
   * @param enabled - Whether robot should be enabled
   */
  static setRobotEnabled(enabled: boolean): void {
    LocalStorageService.set(this.ROBOT_ENABLED_KEY, enabled);
  }

  /**
   * Toggle robot enabled state
   * @returns The new state after toggling
   */
  static toggleRobot(): boolean {
    const currentState = this.isRobotEnabled();
    const newState = !currentState;
    this.setRobotEnabled(newState);
    return newState;
  }
}


