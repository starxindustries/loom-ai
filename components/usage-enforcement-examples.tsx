/**
 * React components demonstrating usage enforcement integration
 * These examples show how to integrate usage limits with UI components
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useUsageLimitCheck, UsageLimitUtils } from '../lib/usage-limit-middleware';
import { uploadFileClientSide, uploadMultipleFilesClientSide } from '../lib/file-operations-with-usage-enforcement';
import { createMemoryClientSide } from '../lib/memory-with-usage-enforcement';
import { UpgradePrompt } from '../types/subscription';

/**
 * Memory creation component with usage enforcement
 */
export function MemoryCreationForm() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const { checkLimit } = useUsageLimitCheck();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) return;

    setIsLoading(true);
    setUpgradePrompt(null);

    try {
      // Check usage limit before creating memory
      const canProceed = await checkLimit('memory');
      
      if (!canProceed) {
        // The checkLimit function will handle showing the upgrade prompt
        return;
      }

      // Create memory with client-side enforcement
      const success = await createMemoryClientSide(
        content,
        (prompt) => setUpgradePrompt(prompt)
      );

      if (success) {
        setContent('');
        // Show success message or refresh data
      }
    } catch (error) {
      console.error('Error creating memory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Redirect to billing page or show upgrade modal
    window.location.href = '/billing';
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="memory-content" className="block text-sm font-medium">
            Memory Content
          </label>
          <textarea
            id="memory-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            rows={4}
            placeholder="Enter your memory content..."
            disabled={isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Memory'}
        </button>
      </form>

      {/* Upgrade prompt modal */}
      {upgradePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">{upgradePrompt.title}</h3>
            <p className="text-gray-600 mb-4">{upgradePrompt.message}</p>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Current usage: {upgradePrompt.currentUsage} / {upgradePrompt.limit}
              </p>
            </div>

            {upgradePrompt.suggestedPlans.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Suggested Plans:</h4>
                <div className="space-y-2">
                  {upgradePrompt.suggestedPlans.map((plan) => (
                    <div key={plan.id} className="border rounded p-2">
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-sm text-gray-600">
                        ${plan.priceMonthly}/month - {plan.memoryLimit} memories, {plan.fileLimit} files
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleUpgrade}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Upgrade Now
              </button>
              <button
                onClick={() => setUpgradePrompt(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * File upload component with usage enforcement
 */
export function FileUploadForm() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ uploaded: 0, total: 0 });
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const { checkLimit } = useUsageLimitCheck();

  const handleFileUpload = async (files: FileList | File[]) => {
    setIsUploading(true);
    setUpgradePrompt(null);

    try {
      const result = await uploadMultipleFilesClientSide(
        files,
        (prompt) => setUpgradePrompt(prompt),
        (uploaded, total) => setUploadProgress({ uploaded, total })
      );

      if (result.success) {
        // Show success message or refresh file list
        console.log('Files uploaded successfully:', result.results);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress({ uploaded: 0, total: 0 });
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drag and drop area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400'}
        `}
      >
        <div className="space-y-2">
          <div className="text-gray-600">
            {isUploading ? 'Uploading files...' : 'Drag and drop files here, or'}
          </div>
          
          <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
            Choose Files
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>

        {isUploading && uploadProgress.total > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600">
              Uploading {uploadProgress.uploaded} of {uploadProgress.total} files
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(uploadProgress.uploaded / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Upgrade prompt modal (same as memory component) */}
      {upgradePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">{upgradePrompt.title}</h3>
            <p className="text-gray-600 mb-4">{upgradePrompt.message}</p>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Current usage: {upgradePrompt.currentUsage} / {upgradePrompt.limit}
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => window.location.href = '/billing'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Upgrade Now
              </button>
              <button
                onClick={() => setUpgradePrompt(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Usage stats display component
 */
export function UsageStatsDisplay() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const usageStats = await UsageLimitUtils.getCurrentUsageStats();
        setStats(usageStats);
      } catch (error) {
        console.error('Error loading usage stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Listen for usage limit exceeded events
    const handleUsageLimitExceeded = (event: CustomEvent) => {
      console.log('Usage limit exceeded:', event.detail);
      // Handle the upgrade prompt
    };

    window.addEventListener('usage-limit-exceeded', handleUsageLimitExceeded as EventListener);

    return () => {
      window.removeEventListener('usage-limit-exceeded', handleUsageLimitExceeded as EventListener);
    };
  }, []);

  if (isLoading) {
    return <div>Loading usage stats...</div>;
  }

  if (!stats) {
    return <div>Unable to load usage stats</div>;
  }

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold">Usage Statistics</h3>
      
      <div className="space-y-3">
        {/* Memory usage */}
        <div>
          <div className="flex justify-between text-sm">
            <span>Memory Records</span>
            <span>{stats.memoryCount} / {stats.memoryLimit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.memoryPercentage >= 90 ? 'bg-red-500' :
                stats.memoryPercentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.memoryPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* File usage */}
        <div>
          <div className="flex justify-between text-sm">
            <span>File Records</span>
            <span>{stats.fileCount} / {stats.fileLimit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.filePercentage >= 90 ? 'bg-red-500' :
                stats.filePercentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stats.filePercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {(stats.memoryPercentage >= 90 || stats.filePercentage >= 90) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-sm text-yellow-800">
            You're approaching your usage limits. Consider upgrading your plan.
          </p>
          <button
            onClick={() => window.location.href = '/billing'}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            View Plans →
          </button>
        </div>
      )}
    </div>
  );
}