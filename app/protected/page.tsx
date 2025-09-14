"use client";

import { ChatSystem } from "@/components/common/chat-system";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { ProfileButton } from "@/components/common/profile-button";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, stopGeneration, clearMessages } = useChat();

  return (
    <div className="relative h-screen">
      {/* Fixed profile button at top left */}
      <div className="fixed top-4 left-4 z-50">
        <ProfileButton />
      </div>

      {/* Fixed theme switcher at top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeSwitcher />
      </div>

      {/* Full-page Chat System */}
      <ChatSystem
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        onStopGeneration={stopGeneration}
        onClearMessages={clearMessages}
      />
    </div>
  );
}
