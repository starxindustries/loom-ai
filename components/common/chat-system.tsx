"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { PromptBox } from "@/components/ui/chatgpt-prompt-input";
import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
import {
  SendIcon,
  BotIcon,
  UserIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import { Message, ChatSystemProps, FileAttachment } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { MDXRenderer } from "@/components/ui/mdx-renderer";
import { FileDownloadBubble } from "@/components/common/file-download-bubble";
import { SplineScene } from "../ui/robot";
import { Announcement, AnnouncementTitle } from "../ui/announcement";

const MessageBubble: React.FC<{
  message: Message;
  index: number;
  user?: SupabaseUser | null;
}> = ({
  message,
  index,
  user,
}) => {
    const isUser = message.role === "user";
    const profileImageUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

    const downloadEncryptedFile = async (attachment: FileAttachment) => {
      try {
        // Fetch the encrypted file data
        const response = await fetch(`/api/encrypted-files?id=${attachment.id}`);
        if (!response.ok) throw new Error('Failed to fetch file');

        const { fileData, encryption } = await response.json();

        // Get encryption profile and passphrase
        const profRes = await fetch('/api/user-encryption-profile');
        if (!profRes.ok) throw new Error('No encryption profile');
        const { profile } = await profRes.json();

        const stored = typeof window !== 'undefined' ? localStorage.getItem('loom_ai_passphrase') : null;
        if (!stored) throw new Error('No encryption key on device');

        // Derive KEK
        const passKey = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(stored),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        const salt = Uint8Array.from(atob(profile.master_salt), c => c.charCodeAt(0));
        const kek = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          passKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
        );

        // Unwrap DEK
        const wrappedDek = Uint8Array.from(atob(encryption.wrapped_dek), c => c.charCodeAt(0));
        const dekIv = Uint8Array.from(atob(encryption.dek_iv), c => c.charCodeAt(0));
        const dek = await crypto.subtle.unwrapKey(
          'raw',
          wrappedDek,
          kek,
          { name: 'AES-GCM', iv: dekIv },
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        // Decrypt file data
        const ciphertext = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
        const dataIv = Uint8Array.from(atob(encryption.data_iv), c => c.charCodeAt(0));
        const decryptedData = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: dataIv },
          dek,
          ciphertext
        );

        // Create download link
        const blob = new Blob([decryptedData], { type: attachment.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

      } catch (error) {
        console.error('Decryption failed:', error);
        throw error;
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: index * 0.05,
        }}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}
      >
        <div
          className={`flex items-start gap-3 max-w-[70%] ${isUser ? "flex-row-reverse" : "flex-row"
            }`}
        >
          {/* Avatar */}
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${isUser ? "bg-muted" : "bg-muted"
              }`}
          >
            {isUser ? (
              profileImageUrl ? (
                <Image
                  src={profileImageUrl}
                  alt="User profile"
                  quality={100}
                  loading="eager"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <Image
                src="/assests/logo/logo.png"
                alt="Robot"
                width={32}
                height={32}
                quality={100}
                priority
                unoptimized
                className="h-8 w-8 rounded-full object-cover grayscale invert"
              />
            )}
          </div>

          {/* Message Content */}
          <div
            className={`px-4 py-3 rounded-lg shadow-lg ${isUser
              ? "bg-muted text-foreground border border-primary/10"
              : " border text-foreground"
              }`}
          >
            {message.isTyping ? (
              <div className="flex space-x-1">
                <motion.div
                  className="w-2 h-2 bg-muted-foreground rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-muted-foreground rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-muted-foreground rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            ) : (
              <div className="text-sm leading-relaxed">
                <MDXRenderer content={message.content} />
                {message.isStreaming && (
                  <motion.span
                    className="inline-block w-2 h-4 bg-foreground ml-1"
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}

                {/* File Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.attachments.map((attachment) => (
                      <FileDownloadBubble
                        key={attachment.id}
                        attachment={attachment}
                        onDownload={downloadEncryptedFile}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs mt-2 text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

export const ChatSystem: React.FC<ChatSystemProps> = ({
  onSendMessage,
  messages = [],
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptBoxRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();
  }, []);

  useEffect(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSendMessage = (message: string) => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message.trim());
      setInputValue("");
      if (promptBoxRef.current) {
        promptBoxRef.current.value = "";
      }
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
      // Scroll to bottom after sending message
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleTextareaKeyPress = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e.currentTarget.value);
    }
  };

  const base64FromArrayBuffer = (ab: ArrayBuffer) => {
    const bytes = new Uint8Array(ab);
    let binary = "";
    const chunkSize = 0x8000; // 32KB chunks to avoid call stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const uploadEncryptedFile = async (file: File) => {
    try {
      setIsUploading(true);
      // Fetch encryption profile
      const profRes = await fetch('/api/user-encryption-profile');
      if (!profRes.ok) throw new Error('No encryption profile');
      const { profile } = await profRes.json();

      const stored = typeof window !== 'undefined' ? localStorage.getItem('loom_ai_passphrase') : null;
      if (!stored) throw new Error('No encryption key on device');

      // Derive KEK
      const passKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(stored),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const salt = Uint8Array.from(atob(profile.master_salt), c => c.charCodeAt(0));
      const kek = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        passKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
      );

      // Generate DEK
      const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

      // Encrypt file bytes
      const buf = await file.arrayBuffer();
      const dataIv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: dataIv }, dek, buf);

      // Wrap DEK
      const dekIv = crypto.getRandomValues(new Uint8Array(12));
      const wrappedDek = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv: dekIv });

      // Send to API
      const form = new FormData();
      form.append('file', file);
      form.append('payload', base64FromArrayBuffer(ciphertext));
      form.append('encryption', JSON.stringify({
        wrapped_dek: base64FromArrayBuffer(wrappedDek as ArrayBuffer),
        dek_salt: profile.master_salt,
        dek_iv: base64FromArrayBuffer(dekIv.buffer),
        data_iv: base64FromArrayBuffer(dataIv.buffer),
        kdf_algorithm: 'pbkdf2',
        kdf_iterations: 100000,
        encryption_algorithm: 'aes-256-gcm'
      }));
      // Optional simple hints from filename
      const hints: string[] = [];
      const lower = file.name.toLowerCase();
      if (lower.includes('license') || lower.includes('licence')) hints.push('driving licence', 'license');
      form.append('keyword_hints', hints.join(','));

      const resp = await fetch('/api/encrypted-files', { method: 'POST', body: form });
      if (!resp.ok) throw new Error('Upload failed');
      const data = await resp.json();

      // Add an acknowledgement message so AI "knows" a file is present
      handleSendMessage(`Store my file: ${file.name}. This is important and should be available later.`);
      return data;
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await uploadEncryptedFile(file);
  };

  // Show initial prompt interface when no messages
  if (messages.length === 0) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-xl flex flex-col gap-10 relative z-10"
        >
          <motion.p
            className="text-center text-3xl text-foreground text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            How Can I Help You
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          >
            <PromptBox
              ref={promptBoxRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
            />
          </motion.div>
        </motion.div>
        {/* //this is the scheme */}
        <div className="absolute inset-0 z-0 opacity-90">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-screen scale-125"
          />
        </div>
      </div>
    );
  }

  // Show chat interface when there are messages
  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                index={index}
                user={user}
              />
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full border-t bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60 shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Action Buttons */}
          {/* <div className="flex items-center justify-end gap-2 mb-3">
            {isLoading && onStopGeneration && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStopGeneration}
                className="h-8"
              >
                <SquareIcon className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
            {onClearMessages && messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearMessages}
                className="h-8"
              >
                <RotateCcwIcon className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div> */}

          <div
            className={`flex items-end gap-3 items-center justify-center relative ${isDragging ? 'ring-2 ring-primary/50 rounded-md' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInputValue(e.target.value)
                }
                onKeyDown={handleTextareaKeyPress}
                placeholder="Type your message..."
                className="min-h-[48px] resize-none w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={1}
              />
              {isDragging && (
                <div className="absolute -top-8 left-0 text-xs text-muted-foreground">
                  Drop file to store securely {isUploading ? '(uploading...)' : ''}
                </div>
              )}
            </div>
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              size="lg"
              className="h-12 px-6"
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
