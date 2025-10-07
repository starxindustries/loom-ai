"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DownloadIcon, FileIcon, LockIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileAttachment } from "@/types";

interface FileDownloadBubbleProps {
  attachment: FileAttachment;
  onDownload?: (attachment: FileAttachment) => Promise<void>;
}

export const FileDownloadBubble: React.FC<FileDownloadBubbleProps> = ({
  attachment,
  onDownload,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return "🖼️";
    if (contentType.startsWith("video/")) return "🎥";
    if (contentType.startsWith("audio/")) return "🎵";
    if (contentType.includes("pdf")) return "📄";
    if (contentType.includes("word")) return "📝";
    if (contentType.includes("excel") || contentType.includes("spreadsheet")) return "📊";
    if (contentType.includes("powerpoint") || contentType.includes("presentation")) return "📽️";
    if (contentType.includes("zip") || contentType.includes("archive")) return "📦";
    return "📁";
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    
    setIsDownloading(true);
    setError(null);
    
    try {
      await onDownload(attachment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 p-3 bg-muted/50 rounded-lg border border-border/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg border border-border flex items-center justify-center">
            <span className="text-lg">{getFileIcon(attachment.contentType)}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {attachment.originalName}
            </h4>
            {attachment.encrypted && (
              <LockIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span>{formatFileSize(attachment.fileSize)}</span>
            <span>•</span>
            <span className="capitalize">
              {attachment.contentType.split("/")[1] || "file"}
            </span>
            {attachment.encrypted && (
              <>
                <span>•</span>
                <span className="text-green-600">Encrypted</span>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
              <AlertCircleIcon className="h-3 w-3" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            size="sm"
            variant="outline"
            className="h-8 text-xs"
          >
            <DownloadIcon className="h-3 w-3 mr-1" />
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
