export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  isStreaming?: boolean;
}

export interface ChatSystemProps {
  onSendMessage?: (message: string) => void;
  onStopGeneration?: () => void;
  onClearMessages?: () => void;
  messages?: Message[];
  isLoading?: boolean;
}
