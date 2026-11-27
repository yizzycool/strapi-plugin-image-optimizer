import React, { useSyncExternalStore } from 'react';
import { DesignSystemProvider, darkTheme, lightTheme } from '@strapi/design-system';
import { IntlProvider } from 'react-intl';
import { UploadEnhancerBridge } from './UploadEnhancerBridge';
import { PLUGIN_ID } from '../pluginId';
import enTranslations from '../translations/en.json';
import trTranslations from '../translations/tr.json';
import {
  getEditingAssetId,
  subscribeUploadAssets,
} from '../utils/uploadAssetStore';

const THEME_KEY = 'STRAPI_THEME';
const LANGUAGE_KEY = 'strapi-admin-language';

const prefixMessages = (trad: Record<string, string>) =>
  Object.entries(trad).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[`${PLUGIN_ID}.${key}`] = value;
    return acc;
  }, {});

const MESSAGES_BY_LOCALE: Record<string, Record<string, string>> = {
  en: prefixMessages(enTranslations),
  tr: prefixMessages(trTranslations),
};

const getActiveLocale = () => {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  const raw = stored || document.documentElement.lang || 'en';
  const normalized = raw.toLowerCase();
  const shortCode = normalized.split('-')[0];

  return MESSAGES_BY_LOCALE[normalized]
    ? normalized
    : MESSAGES_BY_LOCALE[shortCode]
      ? shortCode
      : 'en';
};

const getTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);

  if (stored === 'dark') {
    return darkTheme;
  }

  if (stored === 'system' || !stored) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme;
  }

  return lightTheme;
};

export const BridgeProviders = ({ children }: { children: React.ReactNode }) => {
  const editingAssetId = useSyncExternalStore(subscribeUploadAssets, getEditingAssetId);
  const [theme, setTheme] = React.useState(getTheme);
  const [locale, setLocale] = React.useState(getActiveLocale);

  React.useEffect(() => {
    setTheme(getTheme());
    setLocale(getActiveLocale());
  }, [editingAssetId]);

  React.useEffect(() => {
    const syncState = () => {
      setTheme(getTheme());
      setLocale(getActiveLocale());
    };
    window.addEventListener('storage', syncState);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', syncState);

    return () => {
      window.removeEventListener('storage', syncState);
      media.removeEventListener('change', syncState);
    };
  }, []);

  const messages = MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE.en;

  return (
    <IntlProvider locale={locale} messages={messages} defaultLocale="en">
      <DesignSystemProvider locale={locale} theme={theme}>
        {children}
      </DesignSystemProvider>
    </IntlProvider>
  );
};

export const UploadEnhancerRoot = () => (
  <BridgeProviders>
    <UploadEnhancerBridge />
  </BridgeProviders>
);
