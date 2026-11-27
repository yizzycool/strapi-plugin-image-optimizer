import fs from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { file as fileUtils } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { type OptimizationMode, type OptimizationSettings } from '../constants';

const { bytesToKbytes } = fileUtils;

const SKIP_FORMATS = new Set(['svg', 'gif']);
const KNOWN_IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|tiff?|avif|bmp|heic|heif)$/i;

interface UploadFile {
  filepath?: string;
  getStream?: () => fs.ReadStream;
  tmpWorkingDirectory?: string;
  hash: string;
  name: string;
  ext: string;
  mime: string;
  width?: number | null;
  height?: number | null;
  size?: number;
  sizeInBytes?: number;
  optimizationChoice?: string;
  optimizationCustom?: Partial<OptimizationSettings>;
  optimizationMode?: string;
}

const getMetadata = async (file: UploadFile) => {
  if (!file.filepath) {
    return new Promise<sharp.Metadata>((resolve, reject) => {
      const pipeline = sharp();
      pipeline.metadata().then(resolve).catch(reject);
      file.getStream?.().pipe(pipeline);
    });
  }

  return sharp(file.filepath).metadata();
};

const writeStreamToFile = (stream: NodeJS.ReadableStream, path: string) =>
  new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(path);
    stream.on('error', reject);
    stream.pipe(writeStream);
    writeStream.on('close', resolve);
    writeStream.on('error', reject);
  });

const buildOutputPath = (file: UploadFile, suffix: string) => {
  if (file.tmpWorkingDirectory) {
    return join(file.tmpWorkingDirectory, `${suffix}-${file.hash}`);
  }
  return `${suffix}-${file.hash}`;
};

const getOrientedDimensions = (metadata: sharp.Metadata) => {
  const rawWidth = metadata.width ?? 0;
  const rawHeight = metadata.height ?? 0;
  const orientation = metadata.orientation ?? 1;

  // EXIF orientations 5-8 rotate the image by 90 or 270 degrees.
  if (orientation >= 5 && orientation <= 8) {
    return { width: rawHeight, height: rawWidth };
  }

  return { width: rawWidth, height: rawHeight };
};

const applyResize = (
  transformer: sharp.Sharp,
  settings: OptimizationSettings,
  metadata: sharp.Metadata
): { transformer: sharp.Sharp; resized: boolean } => {
  const targetWidth = settings.maxWidth;
  const targetHeight = settings.maxHeight;
  const { width: sourceWidth, height: sourceHeight } = getOrientedDimensions(metadata);

  if (!targetWidth || !targetHeight || !sourceWidth || !sourceHeight) {
    return { transformer, resized: false };
  }

  if (targetWidth === sourceWidth && targetHeight === sourceHeight) {
    return { transformer, resized: false };
  }

  return {
    transformer: transformer.resize(targetWidth, targetHeight, {
      fit: 'inside',
    }),
    resized: true,
  };
};

const applyTransform = (
  transformer: sharp.Sharp,
  format: string | undefined,
  mode: OptimizationMode,
  settings: OptimizationSettings
) => {
  if (mode === 'webp') {
    return transformer.webp({ quality: settings.webpQuality });
  }

  switch (format) {
    case 'jpeg':
    case 'jpg':
      return transformer.jpeg({ quality: settings.jpegQuality, mozjpeg: true });
    case 'png':
      return transformer.png({ compressionLevel: settings.pngCompressionLevel });
    case 'webp':
      return transformer.webp({ quality: settings.webpQuality });
    case 'tiff':
      return transformer.tiff({ quality: settings.jpegQuality });
    case 'avif':
      return transformer.avif({ quality: settings.jpegQuality });
    default:
      return transformer;
  }
};

const buildWebpFileName = (name: string, ext?: string) => {
  if (ext && name.toLowerCase().endsWith(ext.toLowerCase())) {
    return `${name.slice(0, name.length - ext.length)}.webp`;
  }

  const baseName = name.replace(KNOWN_IMAGE_EXT_REGEX, '');
  return `${baseName}.webp`;
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async process(
    file: UploadFile,
    mode: OptimizationMode,
    settings: OptimizationSettings
  ): Promise<UploadFile | null> {
    const metadata = await getMetadata(file);
    const format = metadata.format;

    if (!format || SKIP_FORMATS.has(format)) {
      return null;
    }

    const originalSize = metadata.size ?? file.sizeInBytes ?? 0;
    const outputPath = buildOutputPath(file, mode === 'webp' ? 'webp' : 'optimized');
    let newInfo: sharp.OutputInfo | undefined;

    const createTransformer = () => {
      if (!file.filepath) {
        return sharp({ animated: format === 'gif' });
      }
      return sharp(file.filepath, { animated: format === 'gif' });
    };

    let transformer = createTransformer().rotate();
    const resizedResult = applyResize(transformer, settings, metadata);
    transformer = applyTransform(resizedResult.transformer, format, mode, settings);

    if (!file.filepath) {
      transformer = transformer.on('info', (info) => {
        newInfo = info;
      });
      await writeStreamToFile(file.getStream!().pipe(transformer), outputPath);
    } else {
      newInfo = await transformer.toFile(outputPath);
    }

    const { width, height, size, pageHeight } = (newInfo ?? {}) as Partial<
      sharp.OutputInfo & { pageHeight?: number }
    >;

    if (size && originalSize && size >= originalSize && mode !== 'webp' && !resizedResult.resized) {
      await fs.promises.unlink(outputPath).catch(() => {});
      return null;
    }

    const newFile: UploadFile = {
      ...file,
      filepath: outputPath,
      getStream: () => fs.createReadStream(outputPath),
      width: width ?? file.width,
      height: (pageHeight ?? height) ?? file.height,
      size: size ? bytesToKbytes(size) : file.size,
      sizeInBytes: size ?? file.sizeInBytes,
    };

    if (mode === 'webp') {
      newFile.ext = '.webp';
      newFile.mime = 'image/webp';
      newFile.name = buildWebpFileName(file.name, file.ext);
    }

    return newFile;
  },
});
