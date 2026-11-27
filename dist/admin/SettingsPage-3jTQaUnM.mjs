import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Typography, Button, Flex, Box, Grid, Field, SingleSelect, SingleSelectOption } from "@strapi/design-system";
import { Check } from "@strapi/icons";
import { useFetchClient, useNotification, useRBAC, Page, Layouts } from "@strapi/strapi/admin";
import { u as useIntl, g as getTranslationKey, O as OptimizationQualityFields, P as PLUGIN_ID } from "./index-mS3p9j2N.mjs";
const SETTINGS_READ = [{ action: "plugin::image-optimizer.settings.read", subject: null }];
const SETTINGS_UPDATE = [{ action: "plugin::image-optimizer.settings.update", subject: null }];
const CHOICES = ["original", "global", "custom"];
const MODES = ["webp", "compress"];
const SettingsPage = () => {
  const { formatMessage } = useIntl();
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { allowedActions: readActions } = useRBAC(SETTINGS_READ);
  const { allowedActions: updateActions } = useRBAC(SETTINGS_UPDATE);
  const canReadGlobal = readActions.canRead;
  const canUpdateGlobal = updateActions.canUpdate;
  const [globalSettings, setGlobalSettings] = useState({
    defaultChoice: "original",
    defaultMode: "compress",
    webpQuality: 82,
    jpegQuality: 80,
    pngCompressionLevel: 9
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const load = async () => {
      if (!canReadGlobal) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: settings } = await get(`/${PLUGIN_ID}/settings`);
        setGlobalSettings(settings);
      } catch {
        toggleNotification({
          type: "danger",
          message: formatMessage({ id: getTranslationKey("settings.error") })
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
      await put(`/${PLUGIN_ID}/settings`, globalSettings);
      toggleNotification({
        type: "success",
        message: formatMessage({ id: getTranslationKey("settings.saved") })
      });
    } catch {
      toggleNotification({
        type: "danger",
        message: formatMessage({ id: getTranslationKey("settings.error") })
      });
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsx(Page.Loading, {});
  }
  if (!canReadGlobal) {
    return /* @__PURE__ */ jsxs(Page.Main, { children: [
      /* @__PURE__ */ jsx(Page.Title, { children: formatMessage({ id: getTranslationKey("settings.page.title") }) }),
      /* @__PURE__ */ jsx(
        Layouts.Header,
        {
          title: formatMessage({ id: getTranslationKey("settings.page.title") }),
          subtitle: formatMessage({ id: getTranslationKey("settings.page.description") })
        }
      ),
      /* @__PURE__ */ jsx(Layouts.Content, { children: /* @__PURE__ */ jsx(Typography, { textColor: "neutral600", children: formatMessage({ id: getTranslationKey("settings.global.noPermission") }) }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Page.Main, { children: [
    /* @__PURE__ */ jsx(Page.Title, { children: formatMessage({ id: getTranslationKey("settings.page.title") }) }),
    /* @__PURE__ */ jsx(
      Layouts.Header,
      {
        title: formatMessage({ id: getTranslationKey("settings.page.title") }),
        subtitle: formatMessage({ id: getTranslationKey("settings.page.description") }),
        primaryAction: canUpdateGlobal ? /* @__PURE__ */ jsx(Button, { onClick: handleSave, loading: isSaving, startIcon: /* @__PURE__ */ jsx(Check, {}), size: "S", children: formatMessage({ id: getTranslationKey("settings.save") }) }) : void 0
      }
    ),
    /* @__PURE__ */ jsx(Layouts.Content, { children: /* @__PURE__ */ jsx(Layouts.Root, { children: /* @__PURE__ */ jsxs(Flex, { direction: "column", alignItems: "stretch", gap: 6, children: [
      /* @__PURE__ */ jsxs(Box, { background: "neutral0", padding: 6, shadow: "filterShadow", hasRadius: true, children: [
        /* @__PURE__ */ jsx(Typography, { variant: "delta", tag: "h2", children: formatMessage({ id: getTranslationKey("settings.global.defaultChoiceTitle") }) }),
        /* @__PURE__ */ jsx(Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsx(Typography, { textColor: "neutral600", children: formatMessage({ id: getTranslationKey("settings.global.defaultChoiceDescription") }) }) }),
        /* @__PURE__ */ jsx(Grid.Root, { gap: 6, children: /* @__PURE__ */ jsx(Grid.Item, { col: 6, xs: 12, direction: "column", alignItems: "stretch", children: /* @__PURE__ */ jsxs(Field.Root, { name: "defaultChoice", children: [
          /* @__PURE__ */ jsx(Field.Label, { children: formatMessage({ id: getTranslationKey("settings.global.defaultChoice") }) }),
          /* @__PURE__ */ jsx(
            SingleSelect,
            {
              value: globalSettings.defaultChoice,
              onChange: (value) => setGlobalSettings((prev) => ({ ...prev, defaultChoice: value })),
              disabled: !canUpdateGlobal || isSaving,
              children: CHOICES.map((choice) => /* @__PURE__ */ jsx(SingleSelectOption, { value: choice, children: formatMessage({ id: getTranslationKey(`choice.${choice}`) }) }, choice))
            }
          ),
          /* @__PURE__ */ jsx(Field.Hint, { children: formatMessage({ id: getTranslationKey("settings.global.defaultChoiceHint") }) })
        ] }) }) })
      ] }),
      /* @__PURE__ */ jsxs(Box, { background: "neutral0", padding: 6, shadow: "filterShadow", hasRadius: true, children: [
        /* @__PURE__ */ jsx(Typography, { variant: "delta", tag: "h2", children: formatMessage({ id: getTranslationKey("settings.global.profileTitle") }) }),
        /* @__PURE__ */ jsx(Box, { paddingTop: 2, paddingBottom: 4, children: /* @__PURE__ */ jsx(Typography, { textColor: "neutral600", children: formatMessage({ id: getTranslationKey("settings.global.profileDescription") }) }) }),
        /* @__PURE__ */ jsxs(Grid.Root, { gap: 6, children: [
          /* @__PURE__ */ jsx(Grid.Item, { col: 6, xs: 12, direction: "column", alignItems: "stretch", children: /* @__PURE__ */ jsxs(Field.Root, { name: "defaultMode", children: [
            /* @__PURE__ */ jsx(Field.Label, { children: formatMessage({ id: getTranslationKey("settings.global.defaultMode") }) }),
            /* @__PURE__ */ jsx(
              SingleSelect,
              {
                value: globalSettings.defaultMode,
                onChange: (value) => setGlobalSettings((prev) => ({ ...prev, defaultMode: value })),
                disabled: !canUpdateGlobal || isSaving,
                children: MODES.map((mode) => /* @__PURE__ */ jsx(SingleSelectOption, { value: mode, children: formatMessage({ id: getTranslationKey(`settings.mode.${mode}`) }) }, mode))
              }
            ),
            /* @__PURE__ */ jsx(Field.Hint, { children: formatMessage({ id: getTranslationKey("settings.global.defaultModeHint") }) })
          ] }) }),
          /* @__PURE__ */ jsx(
            OptimizationQualityFields,
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
  return /* @__PURE__ */ jsx(SettingsPage, {});
};
export {
  ProtectedSettingsPage,
  SettingsPage
};
