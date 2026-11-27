import type { Core } from '@strapi/strapi';
import {
  PLUGIN_ID,
  OPTIMIZATION_CHOICES,
  OPTIMIZATION_MODES,
  type OptimizationChoice,
  type OptimizationMode,
  type OptimizationSettings,
} from './constants';
import {
  consumeUploadPreference,
  createUploadContext,
  findUploadPreference,
  isUploadRoute,
  optimizerUploadContext,
  parseUploadPreferences,
} from './utils/upload-preferences-context';

const isValidChoice = (choice: unknown): choice is OptimizationChoice =>
  typeof choice === 'string' && OPTIMIZATION_CHOICES.includes(choice as OptimizationChoice);

const isValidMode = (mode: unknown): mode is OptimizationMode =>
  typeof mode === 'string' && OPTIMIZATION_MODES.includes(mode as OptimizationMode);

const isValidCustomSettings = (custom: unknown): custom is OptimizationSettings => {
  if (!custom || typeof custom !== 'object') {
    return false;
  }

  const value = custom as Partial<OptimizationSettings>;

  return (
    isValidMode(value.mode) &&
    typeof value.webpQuality === 'number' &&
    typeof value.jpegQuality === 'number' &&
    typeof value.pngCompressionLevel === 'number' &&
    typeof value.maxWidth === 'number' &&
    typeof value.maxHeight === 'number'
  );
};

const applyPreferenceToEntity = (
  entity: Record<string, unknown>,
  fileInfo: Record<string, unknown>
) => {
  const fileName = String(entity.name ?? fileInfo.name ?? '');
  const assetId =
    typeof fileInfo.optimizerAssetId === 'string' ? fileInfo.optimizerAssetId : undefined;

  const preference = consumeUploadPreference(fileName, assetId);

  if (preference) {
    entity.optimizationChoice = preference.choice;

    if (preference.custom && isValidCustomSettings(preference.custom)) {
      entity.optimizationCustom = preference.custom;
    } else {
      delete entity.optimizationCustom;
    }

    if (assetId) {
      entity.optimizerAssetId = assetId;
    }

    return;
  }

  if (fileInfo.optimizationChoice && isValidChoice(fileInfo.optimizationChoice)) {
    entity.optimizationChoice = fileInfo.optimizationChoice;
  }

  if (fileInfo.optimizationCustom && isValidCustomSettings(fileInfo.optimizationCustom)) {
    entity.optimizationCustom = fileInfo.optimizationCustom;
  }

  if (fileInfo.optimizationMode) {
    entity.optimizationMode = fileInfo.optimizationMode;
  }
};

export default async ({ strapi }: { strapi: Core.Strapi }) => {
  const permissionService =
    strapi.service('admin::permission') ??
    (strapi as Core.Strapi & {
      admin?: {
        services?: {
          permission?: {
            actionProvider?: { registerMany?: (actions: unknown[]) => Promise<void> };
          };
        };
      };
    }).admin?.services?.permission;

  await permissionService?.actionProvider?.registerMany?.([
    {
      section: 'plugins',
      displayName: 'Read Image Optimizer settings',
      uid: 'settings.read',
      pluginName: PLUGIN_ID,
    },
    {
      section: 'plugins',
      displayName: 'Update Image Optimizer settings',
      uid: 'settings.update',
      pluginName: PLUGIN_ID,
    },
  ]);

  const uploadService = strapi.plugin('upload').service('upload');
  const imageService = strapi.plugin('upload').service('image-manipulation');

  strapi.server.use(async (ctx, next) => {
    if (!isUploadRoute(ctx.method, ctx.path)) {
      return next();
    }

    const preferences = parseUploadPreferences(ctx.request.body as Record<string, unknown>);

    if (preferences.length === 0) {
      return next();
    }

    return optimizerUploadContext.run(createUploadContext(preferences), () => next());
  });

  const originalFormatFileInfo = uploadService.formatFileInfo.bind(uploadService);
  uploadService.formatFileInfo = async (
    fileProps: { filename: string; type: string; size: number },
    fileInfo: Record<string, unknown> = {},
    metas: Record<string, unknown> = {}
  ) => {
    const entity = await originalFormatFileInfo(fileProps, fileInfo, metas);
    applyPreferenceToEntity(entity as Record<string, unknown>, fileInfo);
    return entity;
  };

  const originalOptimize = imageService.optimize.bind(imageService);
  imageService.optimize = async (file: Record<string, unknown>) => {
    const preferenceService = strapi.plugin(PLUGIN_ID).service('preference');
    const optimizerService = strapi.plugin(PLUGIN_ID).service('optimizer');

    if (!file.optimizationChoice) {
      const fileName = String(file.name ?? '');
      const fallbackPreference = findUploadPreference(fileName);

      if (fallbackPreference) {
        file.optimizationChoice = fallbackPreference.choice;

        if (fallbackPreference.custom && isValidCustomSettings(fallbackPreference.custom)) {
          file.optimizationCustom = fallbackPreference.custom;
        }
      }
    }

    const resolved = await preferenceService.resolveOptimization(
      file as {
        optimizationChoice?: OptimizationChoice;
        optimizationCustom?: Partial<OptimizationSettings>;
        optimizationMode?: string;
      }
    );

    if (resolved.skip) {
      return file;
    }

    if (!resolved.mode || !resolved.settings) {
      return file;
    }

    const optimized = await optimizerService.process(
      file as Parameters<typeof optimizerService.process>[0],
      resolved.mode,
      resolved.settings
    );

    if (optimized) {
      return optimized;
    }

    return originalOptimize(file);
  };
};
