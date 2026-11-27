"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const designSystem = require("@strapi/design-system");
const icons = require("@strapi/icons");
const admin = require("@strapi/strapi/admin");
const index = require("./index-CCRpMKhX.js");
const SETTINGS_READ = [{ action: "plugin::image-optimizer.settings.read", subject: null }];
const SETTINGS_UPDATE = [{ action: "plugin::image-optimizer.settings.update", subject: null }];
const CHOICES = ["original", "global", "custom"];
const MODES = ["webp", "compress"];
const SettingsPage = () => {
  const { formatMessage } = index.useIntl();
  const { get, put } = admin.useFetchClient();
  const { toggleNotification } = admin.useNotification();
  const { allowedActions: readActions } = admin.useRBAC(SETTINGS_READ);
  const { allowedActions: updateActions } = admin.useRBAC(SETTINGS_UPDATE);
  const canReadGlobal = readActions.canRead;
  const canUpdateGlobal = updateActions.canUpdate;
  const [globalSettings, setGlobalSettings] = React.useState({
    defaultChoice: "original",
    defaultMode: "compress",
    webpQuality: 82,
    jpegQuality: 80,
    pngCompressionLevel: 9
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  React.useEffect(() => {
    const load = async () => {
      if (!canReadGlobal) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: settings } = await get(`/${index.PLUGIN_ID}/settings`);
        setGlobalSettings(settings);
      } catch {
        toggleNotification({
          type: "danger",
          message: formatMessage({ id: index.getTranslationKey("settings.error") })
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [canReadGlobal, formatMessage, get, toggleNotification]);
  const handleSave = async () => {
    if (!canUpdateGlobal) {
      return;
    }
    setIsSaving(true);
    try {
      await put(`/${index.PLUGIN_ID}/settings`, globalSettings);
      toggleNotification({
        type: "success",
        message: formatMessage({ id: index.getTranslationKey("settings.saved") })
      });
    } catch {
      toggleNotification({
        type: "danger",
        message: formatMessage({ id: index.getTranslationKey("settings.error") })
      });
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntime.jsx(admin.Page.Loading, {});
  }
  if (!canReadGlobal) {
    return /* @__PURE__ */ jsxRuntime.jsxs(admin.Page.Main, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(admin.Page.Title, { children: formatMessage({ id: index.getTranslationKey("settings.page.title") }) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        admin.Layouts.Header,
        {
          title: formatMessage({ id: index.getTranslationKey("settings.page.title") }),
          subtitle: formatMessage({ id: index.getTranslationKey("settings.page.description") })
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(admin.Layouts.Content, { children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: formatMessage({ id: index.getTranslationKey("settings.global.noPermission") }) }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(admin.Page.Main, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(admin.Page.Title, { children: formatMessage({ id: index.getTranslationKey("settings.page.title") }) }),
    /* @__PURE__ */ jsxRuntime.jsx(
      admin.Layouts.Header,
      {
        title: formatMessage({ id: index.getTranslationKey("settings.page.title") }),
        subtitle: formatMessage({ id: index.getTranslationKey("settings.page.description") }),
        primaryAction: canUpdateGlobal ? /* @__PURE__ */ jsxRuntime.jsx(designSystem.Button, { onClick: handleSave, loading: isSaving, startIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.Check, {}), size: "S", children: formatMessage({ id: index.getTranslationKey("settings.save") }) }) : void 0
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(admin.Layouts.Content, { children: /* @__PURE__ */ jsxRuntime.jsx(admin.Layouts.Root, { children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { direction: "column", alignItems: "stretch", gap: 6, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { background: "neutral0", padding: 6, shadow: "filterShadow", hasRadius: true, children: [
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "delta", tag: "h2", children: formatMessage({ id: index.getTranslationKey("settings.global.defaultChoiceTitle") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: formatMessage({ id: index.getTranslationKey("settings.global.defaultChoiceDescription") }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Grid.Root, { gap: 6, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Grid.Item, { col: 6, xs: 12, direction: "column", alignItems: "stretch", children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Field.Root, { name: "defaultChoice", children: [
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Label, { children: formatMessage({ id: index.getTranslationKey("settings.global.defaultChoice") }) }),
          /* @__PURE__ */ jsxRuntime.jsx(
            designSystem.SingleSelect,
            {
              value: globalSettings.defaultChoice,
              onChange: (value) => setGlobalSettings((prev) => ({ ...prev, defaultChoice: value })),
              disabled: !canUpdateGlobal || isSaving,
              children: CHOICES.map((choice) => /* @__PURE__ */ jsxRuntime.jsx(designSystem.SingleSelectOption, { value: choice, children: formatMessage({ id: index.getTranslationKey(`choice.${choice}`) }) }, choice))
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Hint, { children: formatMessage({ id: index.getTranslationKey("settings.global.defaultChoiceHint") }) })
        ] }) }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { background: "neutral0", padding: 6, shadow: "filterShadow", hasRadius: true, children: [
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "delta", tag: "h2", children: formatMessage({ id: index.getTranslationKey("settings.global.profileTitle") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: formatMessage({ id: index.getTranslationKey("settings.global.profileDescription") }) }) }),
        /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Grid.Root, { gap: 6, children: [
          /* @__PURE__ */ jsxRuntime.jsx(designSystem.Grid.Item, { col: 6, xs: 12, direction: "column", alignItems: "stretch", children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Field.Root, { name: "defaultMode", children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Label, { children: formatMessage({ id: index.getTranslationKey("settings.global.defaultMode") }) }),
            /* @__PURE__ */ jsxRuntime.jsx(
              designSystem.SingleSelect,
              {
                value: globalSettings.defaultMode,
                onChange: (value) => setGlobalSettings((prev) => ({ ...prev, defaultMode: value })),
                disabled: !canUpdateGlobal || isSaving,
                children: MODES.map((mode) => /* @__PURE__ */ jsxRuntime.jsx(designSystem.SingleSelectOption, { value: mode, children: formatMessage({ id: index.getTranslationKey(`settings.mode.${mode}`) }) }, mode))
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Hint, { children: formatMessage({ id: index.getTranslationKey("settings.global.defaultModeHint") }) })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx(
            index.OptimizationQualityFields,
            {
              value: globalSettings,
              fields: globalSettings.defaultMode === "webp" ? ["webp"] : ["webp", "jpeg", "png"],
              onChange: (patch) => setGlobalSettings((prev) => ({ ...prev, ...patch })),
              disabled: !canUpdateGlobal || isSaving,
              namePrefix: "global"
            }
          )
        ] })
      ] })
    ] }) }) })
  ] });
};
const ProtectedSettingsPage = () => {
  return /* @__PURE__ */ jsxRuntime.jsx(SettingsPage, {});
};
exports.ProtectedSettingsPage = ProtectedSettingsPage;
exports.SettingsPage = SettingsPage;
