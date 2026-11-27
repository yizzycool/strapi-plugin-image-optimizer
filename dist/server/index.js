"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const async_hooks = require("async_hooks");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const utils = require("@strapi/utils");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const fs__default = /* @__PURE__ */ _interopDefault(fs);
const sharp__default = /* @__PURE__ */ _interopDefault(sharp);
const PLUGIN_ID = "image-optimizer";
const OPTIMIZATION_CHOICES = ["original", "global", "custom"];
const OPTIMIZATION_MODES = ["webp", "compress"];
const register = async ({ strapi }) => {
  await strapi.admin.services.permission.actionProvider.registerMany([
    {
      section: "plugins",
      displayName: "Read Image Optimizer settings",
      uid: "settings.read",
      pluginName: PLUGIN_ID
    },
    {
      section: "plugins",
      displayName: "Update Image Optimizer settings",
      uid: "settings.update",
      pluginName: PLUGIN_ID
    }
  ]);
};
const uploadContext = new async_hooks.AsyncLocalStorage();
const optimizerUploadContext = new async_hooks.AsyncLocalStorage();
let fallbackContext = null;
const createUploadContext = (preferences) => ({
  preferences,
  nextIndex: 0
});
const setFallbackUploadPreferences = (preferences) => {
  fallbackContext = createUploadContext(preferences);
};
const clearFallbackUploadPreferences = () => {
  fallbackContext = null;
};
const getActivePreferences = () => {
  const store = optimizerUploadContext.getStore();
  if (store?.preferences.length) {
    return store;
  }
  return fallbackContext;
};
const parseUploadPreferences = (body) => {
  const raw = body?.imageOptimizerPreferences;
  if (!raw) {
    return [];
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
};
const findUploadPreference = (fileName, assetId) => {
  const store = getActivePreferences();
  if (!store) {
    return null;
  }
  const match = store.preferences.find((entry) => {
    if (assetId && entry.assetId === assetId) {
      return true;
    }
    return entry.fileName === fileName;
  });
  return match?.preference ?? null;
};
const consumeUploadPreference = (fileName, assetId) => {
  const store = getActivePreferences();
  if (!store) {
    return null;
  }
  const indexed = store.preferences[store.nextIndex];
  if (indexed) {
    store.nextIndex += 1;
    return indexed.preference;
  }
  return findUploadPreference(fileName, assetId);
};
const isUploadRoute = (method, path2) => {
  if (method.toUpperCase() !== "POST") {
    return false;
  }
  const normalizedPath = path2.replace(/\/+$/, "") || "/";
  return normalizedPath === "/upload";
};
const isValidChoice$2 = (choice) => typeof choice === "string" && OPTIMIZATION_CHOICES.includes(choice);
const isValidMode$2 = (mode) => typeof mode === "string" && OPTIMIZATION_MODES.includes(mode);
const isValidCustomSettings = (custom) => {
  if (!custom || typeof custom !== "object") {
    return false;
  }
  const value = custom;
  return isValidMode$2(value.mode) && typeof value.webpQuality === "number" && typeof value.jpegQuality === "number" && typeof value.pngCompressionLevel === "number" && typeof value.maxWidth === "number" && typeof value.maxHeight === "number";
};
const runWithUser = (userId, fn) => {
  if (userId === void 0) {
    return fn();
  }
  return uploadContext.run({ userId }, fn);
};
const applyPreferenceToEntity = (entity, fileInfo) => {
  const fileName = String(entity.name ?? fileInfo.name ?? "");
  const assetId = typeof fileInfo.optimizerAssetId === "string" ? fileInfo.optimizerAssetId : void 0;
  const preference2 = consumeUploadPreference(fileName, assetId);
  if (preference2) {
    entity.optimizationChoice = preference2.choice;
    if (preference2.custom && isValidCustomSettings(preference2.custom)) {
      entity.optimizationCustom = preference2.custom;
    } else {
      delete entity.optimizationCustom;
    }
    if (assetId) {
      entity.optimizerAssetId = assetId;
    }
    return;
  }
  if (fileInfo.optimizationChoice && isValidChoice$2(fileInfo.optimizationChoice)) {
    entity.optimizationChoice = fileInfo.optimizationChoice;
  }
  if (fileInfo.optimizationCustom && isValidCustomSettings(fileInfo.optimizationCustom)) {
    entity.optimizationCustom = fileInfo.optimizationCustom;
  }
  if (fileInfo.optimizationMode) {
    entity.optimizationMode = fileInfo.optimizationMode;
  }
};
const bootstrap = async ({ strapi }) => {
  const uploadService = strapi.plugin("upload").service("upload");
  const imageService = strapi.plugin("upload").service("image-manipulation");
  strapi.server.use(async (ctx, next) => {
    if (!isUploadRoute(ctx.method, ctx.path)) {
      return next();
    }
    const preferences = parseUploadPreferences(ctx.request.body);
    if (preferences.length === 0) {
      return next();
    }
    setFallbackUploadPreferences(preferences);
    try {
      return await optimizerUploadContext.run(createUploadContext(preferences), () => next());
    } finally {
      clearFallbackUploadPreferences();
    }
  });
  const originalFormatFileInfo = uploadService.formatFileInfo.bind(uploadService);
  uploadService.formatFileInfo = async (fileProps, fileInfo = {}, metas = {}) => {
    const entity = await originalFormatFileInfo(fileProps, fileInfo, metas);
    applyPreferenceToEntity(entity, fileInfo);
    return entity;
  };
  const originalUpload = uploadService.upload.bind(uploadService);
  uploadService.upload = async (args, opts) => {
    return runWithUser(opts?.user?.id, () => originalUpload(args, opts));
  };
  const originalReplace = uploadService.replace.bind(uploadService);
  uploadService.replace = async (id, args, opts) => {
    return runWithUser(opts?.user?.id, () => originalReplace(id, args, opts));
  };
  const originalOptimize = imageService.optimize.bind(imageService);
  imageService.optimize = async (file) => {
    const preferenceService = strapi.plugin(PLUGIN_ID).service("preference");
    const optimizerService = strapi.plugin(PLUGIN_ID).service("optimizer");
    if (!file.optimizationChoice) {
      const fileName = String(file.name ?? "");
      const fallbackPreference = findUploadPreference(fileName);
      if (fallbackPreference) {
        file.optimizationChoice = fallbackPreference.choice;
        if (fallbackPreference.custom && isValidCustomSettings(fallbackPreference.custom)) {
          file.optimizationCustom = fallbackPreference.custom;
        }
      }
    }
    const resolved = await preferenceService.resolveOptimization(
      file
    );
    if (resolved.skip) {
      return file;
    }
    if (!resolved.mode || !resolved.settings) {
      return file;
    }
    const optimized = await optimizerService.process(
      file,
      resolved.mode,
      resolved.settings
    );
    if (optimized) {
      return optimized;
    }
    return originalOptimize(file);
  };
};
const config = {
  default: () => ({
    defaultChoice: "original",
    defaultMode: "compress",
    webpQuality: 82,
    jpegQuality: 80,
    pngCompressionLevel: 9
  }),
  validator(config2) {
    if (config2.webpQuality !== void 0) {
      if (config2.webpQuality < 1 || config2.webpQuality > 100) {
        throw new Error("webpQuality must be between 1 and 100");
      }
    }
    if (config2.jpegQuality !== void 0) {
      if (config2.jpegQuality < 1 || config2.jpegQuality > 100) {
        throw new Error("jpegQuality must be between 1 and 100");
      }
    }
    if (config2.pngCompressionLevel !== void 0) {
      if (config2.pngCompressionLevel < 0 || config2.pngCompressionLevel > 9) {
        throw new Error("pngCompressionLevel must be between 0 and 9");
      }
    }
  }
};
const isValidChoice$1 = (choice) => typeof choice === "string" && OPTIMIZATION_CHOICES.includes(choice);
const isValidMode$1 = (mode) => typeof mode === "string" && OPTIMIZATION_MODES.includes(mode);
const preference$1 = ({ strapi }) => ({
  async getDefaultMode(ctx) {
    const settings = await strapi.plugin("image-optimizer").service("preference").getGlobalSettings();
    ctx.body = {
      defaultChoice: settings.defaultChoice,
      defaultMode: settings.defaultMode,
      webpQuality: settings.webpQuality,
      jpegQuality: settings.jpegQuality,
      pngCompressionLevel: settings.pngCompressionLevel
    };
  },
  async getPreference(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized();
    }
    const preferenceService = strapi.plugin("image-optimizer").service("preference");
    const mode = await preferenceService.getUserPreference(userId);
    const settings = await preferenceService.getGlobalSettings();
    ctx.body = {
      mode: mode ?? settings.defaultMode,
      defaultMode: settings.defaultMode,
      defaultChoice: settings.defaultChoice
    };
  },
  async updatePreference(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) {
      return ctx.unauthorized();
    }
    const { mode } = ctx.request.body ?? {};
    if (!isValidMode$1(mode)) {
      return ctx.badRequest("Invalid optimization mode");
    }
    await strapi.plugin("image-optimizer").service("preference").setUserPreference(userId, mode);
    ctx.body = { mode };
  },
  async getSettings(ctx) {
    const settings = await strapi.plugin("image-optimizer").service("preference").getGlobalSettings();
    ctx.body = settings;
  },
  async updateSettings(ctx) {
    const { webpQuality, jpegQuality, pngCompressionLevel, defaultMode, defaultChoice } = ctx.request.body ?? {};
    if (defaultMode !== void 0 && !isValidMode$1(defaultMode)) {
      return ctx.badRequest("Invalid default mode");
    }
    if (defaultChoice !== void 0 && !isValidChoice$1(defaultChoice)) {
      return ctx.badRequest("Invalid default choice");
    }
    if (webpQuality !== void 0 && (webpQuality < 1 || webpQuality > 100)) {
      return ctx.badRequest("Invalid WebP quality");
    }
    if (jpegQuality !== void 0 && (jpegQuality < 1 || jpegQuality > 100)) {
      return ctx.badRequest("Invalid JPEG quality");
    }
    if (pngCompressionLevel !== void 0 && (pngCompressionLevel < 0 || pngCompressionLevel > 9)) {
      return ctx.badRequest("Invalid PNG compression level");
    }
    const payload = {};
    if (webpQuality !== void 0) payload.webpQuality = Number(webpQuality);
    if (jpegQuality !== void 0) payload.jpegQuality = Number(jpegQuality);
    if (pngCompressionLevel !== void 0) payload.pngCompressionLevel = Number(pngCompressionLevel);
    if (defaultMode !== void 0) payload.defaultMode = defaultMode;
    if (defaultChoice !== void 0) payload.defaultChoice = defaultChoice;
    await strapi.plugin("image-optimizer").service("preference").setGlobalSettings(payload);
    const settings = await strapi.plugin("image-optimizer").service("preference").getGlobalSettings();
    ctx.body = settings;
  }
});
const controllers = {
  preference: preference$1
};
const routes = {
  admin: {
    type: "admin",
    routes: [
      {
        method: "GET",
        path: "/default-mode",
        handler: "preference.getDefaultMode",
        config: {
          policies: ["admin::isAuthenticatedAdmin"]
        }
      },
      {
        method: "GET",
        path: "/preference",
        handler: "preference.getPreference",
        config: {
          policies: ["admin::isAuthenticatedAdmin"]
        }
      },
      {
        method: "PUT",
        path: "/preference",
        handler: "preference.updatePreference",
        config: {
          policies: ["admin::isAuthenticatedAdmin"]
        }
      },
      {
        method: "GET",
        path: "/settings",
        handler: "preference.getSettings",
        config: {
          policies: [
            "admin::isAuthenticatedAdmin",
            {
              name: "admin::hasPermissions",
              config: {
                actions: ["plugin::image-optimizer.settings.read"]
              }
            }
          ]
        }
      },
      {
        method: "PUT",
        path: "/settings",
        handler: "preference.updateSettings",
        config: {
          policies: [
            "admin::isAuthenticatedAdmin",
            {
              name: "admin::hasPermissions",
              config: {
                actions: ["plugin::image-optimizer.settings.update"]
              }
            }
          ]
        }
      }
    ]
  }
};
const GLOBAL_SETTINGS_KEY = "global-settings";
const userPreferenceKey = (userId) => `user-pref-${userId}`;
const isValidChoice = (choice) => typeof choice === "string" && OPTIMIZATION_CHOICES.includes(choice);
const isValidMode = (mode) => typeof mode === "string" && OPTIMIZATION_MODES.includes(mode);
const normalizeLegacyMode = (mode) => {
  if (mode === "none") {
    return "none";
  }
  return isValidMode(mode) ? mode : null;
};
const buildSettings = (mode, source) => ({
  mode,
  webpQuality: source.webpQuality ?? 82,
  jpegQuality: source.jpegQuality ?? 80,
  pngCompressionLevel: source.pngCompressionLevel ?? 9,
  maxWidth: source.maxWidth ?? 0,
  maxHeight: source.maxHeight ?? 0
});
const preference = ({ strapi }) => ({
  async getUserPreference(userId) {
    const stored = await strapi.store({
      type: "plugin",
      name: PLUGIN_ID,
      key: userPreferenceKey(userId)
    }).get();
    if (stored?.mode && isValidMode(stored.mode)) {
      return stored.mode;
    }
    return null;
  },
  async setUserPreference(userId, mode) {
    await strapi.store({
      type: "plugin",
      name: PLUGIN_ID,
      key: userPreferenceKey(userId)
    }).set({ value: { mode } });
  },
  async getGlobalSettings() {
    const configDefaults = strapi.config.get(`plugin::${PLUGIN_ID}`);
    const stored = await strapi.store({
      type: "plugin",
      name: PLUGIN_ID,
      key: GLOBAL_SETTINGS_KEY
    }).get();
    const merged = {
      ...configDefaults,
      ...stored ?? {}
    };
    if (merged.defaultMode === "none") {
      merged.defaultMode = "webp";
    }
    if (!isValidChoice(merged.defaultChoice)) {
      merged.defaultChoice = configDefaults.defaultChoice;
    }
    if (!isValidMode(merged.defaultMode)) {
      merged.defaultMode = configDefaults.defaultMode;
    }
    return merged;
  },
  async setGlobalSettings(settings) {
    const current = await this.getGlobalSettings();
    const next = { ...current, ...settings };
    await strapi.store({
      type: "plugin",
      name: PLUGIN_ID,
      key: GLOBAL_SETTINGS_KEY
    }).set({ value: next });
  },
  async resolveOptimization(file) {
    const global = await this.getGlobalSettings();
    if (!file.optimizationChoice && file.optimizationMode) {
      const legacyMode = normalizeLegacyMode(file.optimizationMode);
      if (legacyMode === "none") {
        return { skip: true };
      }
      if (legacyMode) {
        return {
          skip: false,
          mode: legacyMode,
          settings: buildSettings(legacyMode, global)
        };
      }
    }
    const choice = isValidChoice(file.optimizationChoice) ? file.optimizationChoice : global.defaultChoice;
    if (choice === "original") {
      return { skip: true };
    }
    if (choice === "global") {
      return {
        skip: false,
        mode: global.defaultMode,
        settings: buildSettings(global.defaultMode, global)
      };
    }
    const custom = file.optimizationCustom ?? {};
    const mode = isValidMode(custom.mode) ? custom.mode : global.defaultMode;
    return {
      skip: false,
      mode,
      settings: buildSettings(mode, {
        webpQuality: custom.webpQuality ?? global.webpQuality,
        jpegQuality: custom.jpegQuality ?? global.jpegQuality,
        pngCompressionLevel: custom.pngCompressionLevel ?? global.pngCompressionLevel,
        maxWidth: custom.maxWidth ?? 0,
        maxHeight: custom.maxHeight ?? 0
      })
    };
  }
});
const { bytesToKbytes } = utils.file;
const SKIP_FORMATS = /* @__PURE__ */ new Set(["svg", "gif"]);
const getMetadata = async (file) => {
  if (!file.filepath) {
    return new Promise((resolve, reject) => {
      const pipeline = sharp__default.default();
      pipeline.metadata().then(resolve).catch(reject);
      file.getStream?.().pipe(pipeline);
    });
  }
  return sharp__default.default(file.filepath).metadata();
};
const writeStreamToFile = (stream, path2) => new Promise((resolve, reject) => {
  const writeStream = fs__default.default.createWriteStream(path2);
  stream.on("error", reject);
  stream.pipe(writeStream);
  writeStream.on("close", resolve);
  writeStream.on("error", reject);
});
const buildOutputPath = (file, suffix) => {
  if (file.tmpWorkingDirectory) {
    return path.join(file.tmpWorkingDirectory, `${suffix}-${file.hash}`);
  }
  return `${suffix}-${file.hash}`;
};
const applyResize = (transformer, settings, metadata) => {
  const targetWidth = settings.maxWidth;
  const targetHeight = settings.maxHeight;
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  if (!targetWidth || !targetHeight || !sourceWidth || !sourceHeight) {
    return transformer;
  }
  if (targetWidth === sourceWidth && targetHeight === sourceHeight) {
    return transformer;
  }
  return transformer.resize(targetWidth, targetHeight, {
    fit: "fill"
  });
};
const applyTransform = (transformer, format, mode, settings) => {
  if (mode === "webp") {
    return transformer.webp({ quality: settings.webpQuality });
  }
  switch (format) {
    case "jpeg":
    case "jpg":
      return transformer.jpeg({ quality: settings.jpegQuality, mozjpeg: true });
    case "png":
      return transformer.png({ compressionLevel: settings.pngCompressionLevel });
    case "webp":
      return transformer.webp({ quality: settings.webpQuality });
    case "tiff":
      return transformer.tiff({ quality: settings.jpegQuality });
    case "avif":
      return transformer.avif({ quality: settings.jpegQuality });
    default:
      return transformer;
  }
};
const optimizer = ({ strapi }) => ({
  async process(file, mode, settings) {
    const metadata = await getMetadata(file);
    const format = metadata.format;
    if (!format || SKIP_FORMATS.has(format)) {
      return null;
    }
    const originalSize = metadata.size ?? file.sizeInBytes ?? 0;
    const outputPath = buildOutputPath(file, mode === "webp" ? "webp" : "optimized");
    let newInfo;
    const createTransformer = () => {
      if (!file.filepath) {
        return sharp__default.default({ animated: format === "gif" });
      }
      return sharp__default.default(file.filepath, { animated: format === "gif" });
    };
    let transformer = createTransformer();
    transformer = applyResize(transformer, settings, metadata);
    transformer = applyTransform(transformer, format, mode, settings);
    if (!file.filepath) {
      transformer = transformer.on("info", (info) => {
        newInfo = info;
      });
      await writeStreamToFile(file.getStream().pipe(transformer), outputPath);
    } else {
      newInfo = await transformer.toFile(outputPath);
    }
    const { width, height, size, pageHeight } = newInfo ?? {};
    if (size && originalSize && size >= originalSize && mode !== "webp") {
      return null;
    }
    const newFile = {
      ...file,
      filepath: outputPath,
      getStream: () => fs__default.default.createReadStream(outputPath),
      width: width ?? file.width,
      height: pageHeight ?? height ?? file.height,
      size: size ? bytesToKbytes(size) : file.size,
      sizeInBytes: size ?? file.sizeInBytes
    };
    if (mode === "webp") {
      newFile.ext = ".webp";
      newFile.mime = "image/webp";
      const baseName = file.name.replace(/\.[^.]+$/, "");
      newFile.name = `${baseName}.webp`;
    }
    return newFile;
  }
});
const services = {
  preference,
  optimizer
};
const index = {
  register,
  bootstrap,
  config,
  controllers,
  routes,
  services
};
exports.default = index;
