/**
 * Deliberately NOT in the 'use client' banner module: the root layout is a server
 * component, and importing a plain constant across the client boundary hands the server
 * a client-reference proxy instead of the string — which silently serialised the
 * pre-paint script as `localStorage.getItem({})`. Shared values that both sides read
 * have to live in a neutral module like this one.
 */
export const BETA_BANNER_KEY = 'scouty:beta-banner-dismissed';

/** Class the pre-paint script stamps on <html>; globals.css hides the bar on it. */
export const BETA_BANNER_DISMISSED_CLASS = 'beta-banner-dismissed';
