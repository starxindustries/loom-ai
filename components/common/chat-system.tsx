"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { PromptBox } from "@/components/ui/chatgpt-prompt-input";
import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
import {
  SquareIcon,
  SendIcon,
  BotIcon,
  UserIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Message, ChatSystemProps } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { MDXRenderer } from "@/components/ui/mdx-renderer";

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
        className={`flex items-start gap-3 max-w-[70%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isUser ? "bg-muted" : "bg-muted"
          }`}
        >
          {isUser ? (
            profileImageUrl ? (
              <Image
                src={profileImageUrl}
                alt="User profile"
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <BotIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Message Content */}
        <div
          className={`px-4 py-3 rounded-lg ${
            isUser
              ? "bg-muted text-foreground"
              : "bg-background border text-foreground"
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
  onStopGeneration,
  onClearMessages,
  messages = [],
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptBoxRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    scrollToBottom();
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

  // Show initial prompt interface when no messages
  if (messages.length === 0) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-xl flex flex-col gap-10"
        >
          <motion.p
            className="text-center text-3xl text-foreground"
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
      </div>
    );
  }

  // Show chat interface when there are messages
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 mb-3">
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
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInputValue(e.target.value)
                }
                onKeyDown={handleTextareaKeyPress}
                placeholder="Type your message..."
                className="min-h-[48px] resize-none w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={1}
              />
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
