"use client";

/**
 * Plaid Link, loaded from Plaid's CDN on first use (Plaid requires the
 * hosted script; it cannot be bundled). Docs: https://plaid.com/docs/link/web/
 */
const LINK_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

export interface PlaidLinkMetadata {
  institution?: { name?: string; institution_id?: string } | null;
}
export interface PlaidLinkError {
  error_code?: string;
  error_message?: string;
  display_message?: string | null;
}
interface PlaidHandler {
  open(): void;
  destroy(): void;
}
declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        receivedRedirectUri?: string;
        onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
        onExit: (error: PlaidLinkError | null, metadata: unknown) => void;
      }): PlaidHandler;
    };
  }
}

let loading: Promise<void> | null = null;

function loadLinkScript(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LINK_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load Plaid Link. Check your connection or ad blocker."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Where a Link session started, kept across an OAuth bank redirect. */
export interface PendingLink {
  linkToken: string;
  workspaceKind: "business" | "personal";
  connectionId?: string;
  returnTo: string;
}
const PENDING_KEY = "app:plaid-pending-link";

export const savePendingLink = (p: PendingLink) => {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // Without storage, OAuth banks cannot resume. Non-OAuth banks still work.
  }
};
export const takePendingLink = (): PendingLink | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLink) : null;
  } catch {
    return null;
  }
};

/** Open Link and resolve with the public token, or null if the user closed it. */
export async function openPlaidLink(token: string, receivedRedirectUri?: string): Promise<{ publicToken: string; metadata: PlaidLinkMetadata } | null> {
  await loadLinkScript();
  return new Promise((resolve, reject) => {
    const handler = window.Plaid!.create({
      token,
      receivedRedirectUri,
      onSuccess: (publicToken, metadata) => {
        handler.destroy();
        resolve({ publicToken, metadata });
      },
      onExit: (error) => {
        handler.destroy();
        if (error) reject(new Error(error.display_message || error.error_message || "Plaid Link closed with an error"));
        else resolve(null);
      },
    });
    handler.open();
  });
}
