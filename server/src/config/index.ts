import {
  OPTIMIZATION_CHOICES,
  OPTIMIZATION_MODES,
  type OptimizationChoice,
  type OptimizationMode,
} from '../constants';

export interface PluginConfig {
  defaultChoice: OptimizationChoice;
  defaultMode: OptimizationMode;
  webpQuality: number;
  jpegQuality: number;
  pngCompressionLevel: number;
}

export default {
  default: (): PluginConfig => ({
    defaultChoice: 'original',
    defaultMode: 'compress',
    webpQuality: 82,
    jpegQuality: 80,
    pngCompressionLevel: 9,
  }),
  validator(config: Partial<PluginConfig>) {
    if (
      config.defaultChoice !== undefined &&
      !OPTIMIZATION_CHOICES.includes(config.defaultChoice)
    ) {
      throw new Error(`defaultChoice must be one of: ${OPTIMIZATION_CHOICES.join(', ')}`);
    }
    if (
      config.defaultMode !== undefined &&
      !OPTIMIZATION_MODES.includes(config.defaultMode)
    ) {
      throw new Error(`defaultMode must be one of: ${OPTIMIZATION_MODES.join(', ')}`);
    }
    if (config.webpQuality !== undefined) {
      if (
        typeof config.webpQuality !== 'number' ||
        !Number.isFinite(config.webpQuality) ||
        config.webpQuality < 1 ||
        config.webpQuality > 100
      ) {
        throw new Error('webpQuality must be between 1 and 100');
      }
    }
    if (config.jpegQuality !== undefined) {
      if (
        typeof config.jpegQuality !== 'number' ||
        !Number.isFinite(config.jpegQuality) ||
        config.jpegQuality < 1 ||
        config.jpegQuality > 100
      ) {
        throw new Error('jpegQuality must be between 1 and 100');
      }
    }
    if (config.pngCompressionLevel !== undefined) {
      if (
        typeof config.pngCompressionLevel !== 'number' ||
        !Number.isFinite(config.pngCompressionLevel) ||
        config.pngCompressionLevel < 0 ||
        config.pngCompressionLevel > 9
      ) {
        throw new Error('pngCompressionLevel must be between 0 and 9');
      }
    }
  },
};
