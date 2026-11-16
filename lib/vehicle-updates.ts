// Invalidation only: never broadcast or persist artwork/account details.
const channelName = "cocowheels:vehicle-saved";
const avatarChannel = "cocowheels:avatar-saved";

export function notifyVehicleSaved() {
  notifySaved(channelName);
}

export function notifyAvatarSaved() {
  notifySaved(avatarChannel);
}

function notifySaved(name: string) {
  window.dispatchEvent(new Event(name));
  try {
    const channel = new BroadcastChannel(name);
    channel.postMessage("saved");
    channel.close();
  } catch {
    // Same-tab notification still works; returning tabs refresh on focus.
  }
}

export function subscribeVehicleSaved(refresh: () => void) {
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  window.addEventListener(channelName, refresh);
  window.addEventListener(avatarChannel, refresh);
  window.addEventListener("cocowheels:identity-changed", refresh);
  window.addEventListener("focus", visible);
  window.addEventListener("pageshow", visible);
  document.addEventListener("visibilitychange", visible);
  const channels: BroadcastChannel[] = [];
  for (const name of [channelName, avatarChannel]) {
    try {
      const channel = new BroadcastChannel(name);
      channel.onmessage = (event) => { if (event.data === "saved") refresh(); };
      channels.push(channel);
    } catch { /* Returning tabs still refresh on focus. */ }
  }
  return () => {
    window.removeEventListener(channelName, refresh);
    window.removeEventListener(avatarChannel, refresh);
    window.removeEventListener("cocowheels:identity-changed", refresh);
    window.removeEventListener("focus", visible);
    window.removeEventListener("pageshow", visible);
    document.removeEventListener("visibilitychange", visible);
    channels.forEach(channel => channel.close());
  };
}
