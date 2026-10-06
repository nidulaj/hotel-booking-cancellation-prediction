import { useSyncExternalStore } from "react";
import { SIDEBAR_KEY } from "./boot";

/**
 * Collapsed state lives on <html data-sidebar="collapsed"> so CSS can lay out the rail before
 * React hydrates; this store just mirrors that attribute for components that need it.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const isCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

export function toggleSidebar() {
  const next = !isCollapsed();
  if (next) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
  } catch {
    // Storage unavailable; the choice just isn't remembered.
  }
  listeners.forEach((l) => l());
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, isCollapsed, () => false);
}
