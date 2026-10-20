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
  "Hi! Where should we meet, and what’s your car’s number plate?";
export const REQUEST_MESSAGE_HINT =
  "You can message the driver after requesting.";
export const requestedRideUrl = (rideId: string, requestId?: string) =>
  `/activity/${encodeURIComponent(rideId)}?${new URLSearchParams({
    ...(requestId ? { request: requestId } : {}),
    compose: "1",
  })}`;
