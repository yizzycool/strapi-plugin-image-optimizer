import { createRoot, type Root } from 'react-dom/client';
import React from 'react';
import { UploadEnhancerRoot } from '../components/BridgeProviders';
import {
  clearUploadSession,
  getEditingAssetId,
  patchUploadFetch,
  registerAsset,
  setGlobalSettings,
  setUploadAssetCards,
  setUploadDialogElement,
  type UploadAssetEntry,
} from './uploadAssetStore';

let bridgeRoot: Root | null = null;
let bridgeHost: HTMLElement | null = null;
let mountedDialog: Element | null = null;
let started = false;
let globalSettingsLoaded = false;
let globalSettingsPromise: Promise<void> | null = null;

const parseStoredToken = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' && parsed ? parsed : null;
  } catch {
    return raw;
  }
};

const getAuthToken = (): string | null => {
  const fromLocal = parseStoredToken(localStorage.getItem('jwtToken'));
  if (fromLocal) {
    return fromLocal;
  }

  const fromSession = parseStoredToken(sessionStorage.getItem('jwtToken'));
  if (fromSession) {
    return fromSession;
  }

  const match = document.cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const loadGlobalSettings = async () => {
  if (globalSettingsLoaded) {
    return;
  }

  if (globalSettingsPromise) {
    return globalSettingsPromise;
  }

  globalSettingsPromise = (async () => {
    try {
      const backendURL = (window.strapi as { backendURL?: string } | undefined)?.backendURL;
      const token = getAuthToken();
      if (!backendURL || !token) {
        return;
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${backendURL}/image-optimizer/default-mode`, { headers });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        defaultChoice?: 'original' | 'global' | 'custom';
        defaultMode?: 'webp' | 'compress';
        webpQuality?: number;
        jpegQuality?: number;
        pngCompressionLevel?: number;
      };

      setGlobalSettings({
        defaultChoice: data.defaultChoice ?? 'original',
        defaultMode: data.defaultMode ?? 'compress',
        webpQuality: data.webpQuality ?? 82,
        jpegQuality: data.jpegQuality ?? 80,
        pngCompressionLevel: data.pngCompressionLevel ?? 9,
      });
      globalSettingsLoaded = true;
    } catch {
      // Keep fallback defaults; retry next time an upload dialog opens.
    } finally {
      globalSettingsPromise = null;
    }
  })();

  return globalSettingsPromise;
};

const getNativeActionButtons = (container: Element): HTMLButtonElement[] =>
  [...container.querySelectorAll('button')].filter(
    (btn): btn is HTMLButtonElement => !btn.closest('[data-optimizer-action-host]')
  );

const isPendingLocalCard = (card: Element) => {
  if (card.querySelector('input[type="checkbox"], [role="checkbox"]')) {
    return false;
  }

  const nativeButtons = getNativeActionButtons(card);
  if (nativeButtons.length === 0) {
    return false;
  }

  if (card.querySelector('img[src^="blob:"]')) {
    return true;
  }

  return nativeButtons.length >= 2;
};

const ASSET_CARD_SELECTOR = 'article[role="button"]';

const isUploadPendingModal = (root: Element) => {
  // Exclude Media Picker (AssetDialog) which uses tabs ("Browse" / "Selected").
  if (root.querySelector('[role="tablist"]')) {
    return false;
  }

  // Exclude dialogs showing selectable Media Library / Picker cards.
  if (root.querySelector('article input[type="checkbox"], article [role="checkbox"]')) {
    return false;
  }

  const candidateCards = root.querySelectorAll(ASSET_CARD_SELECTOR);
  return [...candidateCards].some(isPendingLocalCard);
};

const isLikelyImageCard = (card: Element) => {
  if (card.querySelector('img')) {
    return true;
  }

  const text = card.textContent?.toLowerCase() ?? '';
  return /\.(jpe?g|png|webp|bmp|tiff?|avif)/i.test(text) || /\b(jpe?g|png|webp|bmp|tiff?|avif)\b/i.test(text);
};

const isOptimizerMutationNode = (node: Node): boolean => {
  if (!(node instanceof Element)) {
    return false;
  }

  return Boolean(
    node.id === 'image-optimizer-upload-bridge' ||
      node.closest('#image-optimizer-upload-bridge, [data-optimizer-action-host], [data-optimizer-footer-host]')
  );
};

const shouldSyncForMutations = (mutations: MutationRecord[]) => {
  return mutations.some((mutation) => {
    if (isOptimizerMutationNode(mutation.target)) {
      return false;
    }

    if (mutation.type === 'attributes' && isOptimizerMutationNode(mutation.target)) {
      return false;
    }

    for (const node of mutation.addedNodes) {
      if (!isOptimizerMutationNode(node)) {
        return true;
      }
    }

    for (const node of mutation.removedNodes) {
      if (!isOptimizerMutationNode(node)) {
        return true;
      }
    }

    return mutation.type === 'characterData';
  });
};

const extractAssetName = (card: Element) => {
  const titleEl = card.querySelector('h2, [class*="CardTitle"]');
  const titleText = titleEl?.textContent?.trim() ?? '';

  if (titleText && /\.(jpe?g|png|webp|gif|svg|bmp|tiff|avif)/i.test(titleText)) {
    return titleText.match(/[\w.-]+\.(jpe?g|png|webp|gif|svg|bmp|tiff|avif)/i)?.[0] ?? titleText;
  }

  const cardText = card.textContent ?? '';
  const dottedMatch = cardText.match(/[\w.-]+\.(jpe?g|png|webp|gif|svg|bmp|tiff|avif)/i);
  if (dottedMatch) {
    return dottedMatch[0];
  }

  const subtitleEl = card.querySelector('[class*="CardSubtitle"]');
  const subtitleText = subtitleEl?.textContent?.trim() ?? '';
  const extOnly = subtitleText.match(/^([a-z0-9]+)/i)?.[1]?.toLowerCase();

  if (titleText && extOnly) {
    const extMap: Record<string, string> = {
      jpg: 'jpg',
      jpeg: 'jpg',
      png: 'png',
      webp: 'webp',
      gif: 'gif',
      svg: 'svg',
      bmp: 'bmp',
      tiff: 'tiff',
      avif: 'avif',
    };
    const normalizedExt = extMap[extOnly] ?? extOnly;

    if (titleText.toLowerCase().endsWith(`.${normalizedExt}`)) {
      return titleText;
    }

    return `${titleText}.${normalizedExt}`;
  }

  return titleText || null;
};

const extractAssetDimensions = (card: Element) => {
  const img = card.querySelector('img');

  if (img instanceof HTMLImageElement && img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }

  const cardText = card.textContent ?? '';
  const match = cardText.match(/(\d+)\s*[×✕xX]\s*(\d+)/);

  if (match) {
    return { width: Number(match[1]), height: Number(match[2]) };
  }

  return undefined;
};

const findUploadDialog = () => {
  const candidates = [
    ...document.querySelectorAll('[role="dialog"]'),
    ...document.querySelectorAll('[aria-modal="true"]'),
  ];

  return candidates.find(isUploadPendingModal) ?? null;
};

const cleanupEnhancerDom = () => {
  document.querySelectorAll('[data-optimizer-footer-host]').forEach((el) => el.remove());
  document.querySelectorAll('[data-optimizer-action-host]').forEach((el) => el.remove());
};

const unmountBridge = () => {
  bridgeRoot?.unmount();
  bridgeRoot = null;
  bridgeHost?.remove();
  bridgeHost = null;
  mountedDialog = null;
  cleanupEnhancerDom();
  setUploadDialogElement(null);
  setUploadAssetCards([]);
};

const ensureBridge = (dialog: Element) => {
  if (mountedDialog === dialog && bridgeRoot) {
    return;
  }

  if (getEditingAssetId()) {
    return;
  }

  unmountBridge();
  mountedDialog = dialog;

  const dialogElement = dialog as HTMLElement;
  if (getComputedStyle(dialogElement).position === 'static') {
    dialogElement.style.position = 'relative';
  }

  setUploadDialogElement(dialogElement);

  bridgeHost = document.createElement('div');
  bridgeHost.id = 'image-optimizer-upload-bridge';
  bridgeHost.style.cssText = 'display:none;';
  dialog.appendChild(bridgeHost);

  bridgeRoot = createRoot(bridgeHost);
  bridgeRoot.render(React.createElement(UploadEnhancerRoot));
};

const ensureActionHost = (actionsContainer: HTMLElement, editButton: Element, assetId: string) => {
  const selector = `[data-optimizer-action-host="${assetId}"]`;
  let actionHost = actionsContainer.querySelector(selector) as HTMLElement | null;

  if (!actionHost) {
    actionHost = document.createElement('span');
    actionHost.dataset.optimizerActionHost = assetId;
    actionHost.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;';
    editButton.insertAdjacentElement('afterend', actionHost);
  }

  return actionHost;
};

const ensureFooterHost = (cardElement: HTMLElement, assetId: string) => {
  const parent = cardElement.parentElement;

  if (!parent) {
    return null;
  }

  const selector = `[data-optimizer-footer-host="${assetId}"]`;
  let footerHost = parent.querySelector(selector) as HTMLElement | null;

  if (!footerHost) {
    footerHost = document.createElement('div');
    footerHost.dataset.optimizerFooterHost = assetId;
    parent.appendChild(footerHost);
  }

  return footerHost;
};

const collectCards = (dialog: Element): UploadAssetEntry[] => {
  const entries: UploadAssetEntry[] = [];
  const seenCards = new Set<Element>();

  dialog.querySelectorAll(ASSET_CARD_SELECTOR).forEach((card) => {
    if (seenCards.has(card) || !isPendingLocalCard(card)) {
      return;
    }

    seenCards.add(card);

    if (!isLikelyImageCard(card)) {
      return;
    }

    const assetName = extractAssetName(card);
    if (!assetName || /\.(svg|gif)$/i.test(assetName)) {
      return;
    }

    const nativeButtons = getNativeActionButtons(card);
    // In Strapi's AssetCardBase (local=true), the last native action button is Edit.
    const editButton = nativeButtons[nativeButtons.length - 1];
    const actionsContainer = editButton?.parentElement as HTMLElement | null;
    if (!editButton || !actionsContainer) {
      return;
    }

    let assetId = card.getAttribute('data-optimizer-asset-id');
    if (!assetId) {
      assetId = crypto.randomUUID();
      card.setAttribute('data-optimizer-asset-id', assetId);
    }

    const dimensions = extractAssetDimensions(card);

    registerAsset(assetId, assetName, dimensions);

    entries.push({
      assetId,
      assetName,
      width: dimensions?.width,
      height: dimensions?.height,
      actionsContainer: ensureActionHost(actionsContainer, editButton, assetId),
      footerHost: ensureFooterHost(card as HTMLElement, assetId) ?? undefined,
    });
  });

  return entries;
};

const syncUploadModal = () => {
  const dialog = findUploadDialog();

  if (!dialog) {
    if (getEditingAssetId()) {
      return;
    }

    clearUploadSession();
    unmountBridge();
    return;
  }

  if (!globalSettingsLoaded) {
    void loadGlobalSettings();
  }

  ensureBridge(dialog);
  setUploadAssetCards(collectCards(dialog));
};

let syncScheduled = false;

const scheduleSyncUploadModal = () => {
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    syncUploadModal();
  });
};

export const initUploadEnhancer = () => {
  if (started || typeof window === 'undefined') {
    return;
  }

  started = true;
  patchUploadFetch();

  const boot = () => {
    void loadGlobalSettings();
    syncUploadModal();

    const observer = new MutationObserver((mutations) => {
      if (shouldSyncForMutations(mutations)) {
        scheduleSyncUploadModal();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
};
