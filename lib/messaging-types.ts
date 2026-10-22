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

export const MESSAGE_STARTER =
  "Hi! Where should we meet?";
export const DRIVER_MESSAGE_STARTER =
  "Hi! Where would you like me to pick you up?";
export const REQUEST_MESSAGE_HINT =
  "You can message the driver after requesting.";
export const requestedRideUrl = (rideId: string, requestId?: string) =>
  `/activity/${encodeURIComponent(rideId)}?${new URLSearchParams({
    ...(requestId ? { request: requestId } : {}),
  })}`;
