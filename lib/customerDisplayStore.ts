// lib/customerDisplayStore.ts
//
// Minimal pub/sub store used to push the live cart/order state from the
// New Order screen to the customer-facing display.
//
// TODAY (before the Sunmi device arrives): the display is previewed as a
// normal Expo Router web route (`app/display.tsx`), running in the same
// JS process, so it subscribes directly to this store in memory.
//
// TOMORROW (once the Sunmi SDK is wired in): the native dual-screen
// bridge will mount a second React root off the same JS bundle — this
// store keeps working unchanged, since it's still the same JS process.

export interface DisplayCartItem {
  id: string;
  name: string;
  variationName?: string;
  quantity: number;
  price: number;
  addons?: { name: string; price: number }[];
}

export interface DisplayState {
  restaurantName: string;
  logoUrl: string;
  items: DisplayCartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

const emptyState: DisplayState = {
  restaurantName: '',
  logoUrl: '',
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
};

let currentState: DisplayState = { ...emptyState };
type Listener = (state: DisplayState) => void;
const listeners: Set<Listener> = new Set();

// Web-only: browser tabs are separate JS processes, so two tabs don't
// share the in-memory state above. This channel bridges tab-to-tab for
// TESTING PURPOSES ONLY. On the real Sunmi device, both screens run in
// the same process/memory space, so this bridge isn't needed there —
// it's a no-op on native (BroadcastChannel doesn't exist).
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('posup-customer-display')
  : null;

channel?.addEventListener('message', (event) => {
  currentState = event.data;
  listeners.forEach(l => l(currentState));
});

export function publishDisplayState(next: Partial<DisplayState>): void {
  currentState = { ...currentState, ...next };
  listeners.forEach(l => l(currentState));
  channel?.postMessage(currentState);
}

export function resetDisplayState(): void {
  currentState = { ...emptyState };
  listeners.forEach(l => l(currentState));
}

export function getDisplayState(): DisplayState {
  return currentState;
}

export function subscribeDisplayState(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}