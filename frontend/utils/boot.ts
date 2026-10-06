/**
 * Tiny scripts inlined in <head> so UI preferences apply before first paint (no flash).
 * Kept outside "use client" modules so the server layout receives the actual strings.
 */

export const SPLASH_KEY = "bs.splash.seen";
export const SIDEBAR_KEY = "bs.sidebar";

/** Below this width the sidebar starts collapsed unless the user has chosen otherwise. */
export const SIDEBAR_AUTO_COLLAPSE_PX = 1280;

export const BOOT_SCRIPT = `try{var d=document.documentElement;if(sessionStorage.getItem("${SPLASH_KEY}"))d.dataset.splash="seen";var s=localStorage.getItem("${SIDEBAR_KEY}");if(s==="collapsed"||(!s&&innerWidth<${SIDEBAR_AUTO_COLLAPSE_PX}))d.dataset.sidebar="collapsed"}catch(e){}`;
