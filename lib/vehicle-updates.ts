// Invalidation only: never broadcast or persist vehicle/account details.
const channelName = "cocowheels:vehicle-saved";

export function notifyVehicleSaved() {
  window.dispatchEvent(new Event(channelName));
  try {
    const channel = new BroadcastChannel(channelName);
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
  window.addEventListener("cocowheels:identity-changed", refresh);
  window.addEventListener("focus", visible);
  window.addEventListener("pageshow", visible);
  document.addEventListener("visibilitychange", visible);
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event) => {
      if (event.data === "saved") refresh();
    };
  } catch {
    // BroadcastChannel may be unavailable or blocked by the browser.
  }
  return () => {
    window.removeEventListener(channelName, refresh);
    window.removeEventListener("cocowheels:identity-changed", refresh);
    window.removeEventListener("focus", visible);
    window.removeEventListener("pageshow", visible);
    document.removeEventListener("visibilitychange", visible);
    channel?.close();
  };
}
