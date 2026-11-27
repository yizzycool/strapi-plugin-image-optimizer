import type { Core } from '@strapi/strapi';
import {
  OPTIMIZATION_CHOICES,
  OPTIMIZATION_MODES,
  type OptimizationChoice,
  type OptimizationMode,
} from '../constants';

const isValidChoice = (choice: unknown): choice is OptimizationChoice =>
  typeof choice === 'string' && OPTIMIZATION_CHOICES.includes(choice as OptimizationChoice);

const isValidMode = (mode: unknown): mode is OptimizationMode =>
  typeof mode === 'string' && OPTIMIZATION_MODES.includes(mode as OptimizationMode);

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getDefaultMode(ctx) {
    const settings = await strapi.plugin('image-optimizer').service('preference').getGlobalSettings();
    ctx.body = {
      defaultChoice: settings.defaultChoice,
      defaultMode: settings.defaultMode,
      webpQuality: settings.webpQuality,
      jpegQuality: settings.jpegQuality,
      pngCompressionLevel: settings.pngCompressionLevel,
    };
  },

  async getSettings(ctx) {
    const settings = await strapi.plugin('image-optimizer').service('preference').getGlobalSettings();
    ctx.body = settings;
  },

  async updateSettings(ctx) {
    const { webpQuality, jpegQuality, pngCompressionLevel, defaultMode, defaultChoice } =
      ctx.request.body ?? {};

    if (defaultMode !== undefined && !isValidMode(defaultMode)) {
      return ctx.badRequest('Invalid default mode');
    }

    if (defaultChoice !== undefined && !isValidChoice(defaultChoice)) {
      return ctx.badRequest('Invalid default choice');
    }

    if (
      webpQuality !== undefined &&
      (!Number.isFinite(Number(webpQuality)) || Number(webpQuality) < 1 || Number(webpQuality) > 100)
    ) {
      return ctx.badRequest('Invalid WebP quality');
    }

    if (
      jpegQuality !== undefined &&
      (!Number.isFinite(Number(jpegQuality)) || Number(jpegQuality) < 1 || Number(jpegQuality) > 100)
    ) {
      return ctx.badRequest('Invalid JPEG quality');
    }

    if (
      pngCompressionLevel !== undefined &&
      (!Number.isFinite(Number(pngCompressionLevel)) ||
        Number(pngCompressionLevel) < 0 ||
        Number(pngCompressionLevel) > 9)
    ) {
      return ctx.badRequest('Invalid PNG compression level');
    }

    const payload: Record<string, unknown> = {};

    if (webpQuality !== undefined) payload.webpQuality = Number(webpQuality);
    if (jpegQuality !== undefined) payload.jpegQuality = Number(jpegQuality);
    if (pngCompressionLevel !== undefined) payload.pngCompressionLevel = Number(pngCompressionLevel);
    if (defaultMode !== undefined) payload.defaultMode = defaultMode;
    if (defaultChoice !== undefined) payload.defaultChoice = defaultChoice;

    await strapi.plugin('image-optimizer').service('preference').setGlobalSettings(payload);

    const settings = await strapi.plugin('image-optimizer').service('preference').getGlobalSettings();
    ctx.body = settings;
  },
});
