export interface FileAttachment {
  id: string;
  name: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  downloadUrl?: string;
  encrypted?: boolean;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
  isStreaming?: boolean;
  attachments?: FileAttachment[];
}

export interface ChatSystemProps {
  onSendMessage?: (message: string) => void;
  onStopGeneration?: () => void;
  onClearMessages?: () => void;
  messages?: Message[];
  isLoading?: boolean;
}
