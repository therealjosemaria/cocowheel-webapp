export type ConversationSummary = {
  requestId: string;
  peer: string;
  unread: number;
  stopped: boolean;
};
export type ChatMessage = {
  id: number;
  mine: boolean;
  text: string;
  createdAt: string;
};
export type Conversation = { messages: ChatMessage[]; stopped: boolean };
export const conversationTarget = (id: string) =>
  `messages-${encodeURIComponent(id)}`;
