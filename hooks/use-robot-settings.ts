"use client";

import { useState, useEffect } from "react";
import { RobotSettingsService } from "@/lib/local-storage-service";

/**
 * Custom hook for managing robot settings
 * Provides reactive state management for robot enabled/disabled state
 */
export const useRobotSettings = () => {
  const [isRobotEnabled, setIsRobotEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load initial state from localStorage
    const robotEnabled = RobotSettingsService.isRobotEnabled();
    setIsRobotEnabled(robotEnabled);
    setIsLoading(false);

    // Listen for storage changes (when settings are updated in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'loom_ai_robot_enabled') {
        const newValue = e.newValue ? JSON.parse(e.newValue) : true;
        setIsRobotEnabled(newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleRobot = () => {
    const newState = RobotSettingsService.toggleRobot();
    setIsRobotEnabled(newState);
    return newState;
  };

  const setRobotEnabled = (enabled: boolean) => {
    RobotSettingsService.setRobotEnabled(enabled);
    setIsRobotEnabled(enabled);
  };

  return {
    isRobotEnabled,
    isLoading,
    toggleRobot,
    setRobotEnabled,
  };
};


