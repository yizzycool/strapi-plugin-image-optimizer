import React, { useEffect, useState } from 'react';
import { Field, Grid, TextInput, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { getTranslationKey, type OptimizationSettings } from '../pluginId';

interface OptimizationResizeFieldsProps {
  value: Pick<OptimizationSettings, 'maxWidth' | 'maxHeight'>;
  sourceWidth?: number;
  sourceHeight?: number;
  onChange: (patch: Partial<OptimizationSettings>) => void;
  disabled?: boolean;
  namePrefix?: string;
}

export const OptimizationResizeFields = ({
  value,
  sourceWidth,
  sourceHeight,
  onChange,
  disabled = false,
  namePrefix = '',
}: OptimizationResizeFieldsProps) => {
  const { formatMessage } = useIntl();
  const [widthInput, setWidthInput] = useState(String(value.maxWidth));
  const [heightInput, setHeightInput] = useState(String(value.maxHeight));

  useEffect(() => {
    setWidthInput(String(value.maxWidth));
  }, [value.maxWidth]);

  useEffect(() => {
    setHeightInput(String(value.maxHeight));
  }, [value.maxHeight]);

  const aspectRatio =
    sourceWidth && sourceHeight && sourceHeight > 0 ? sourceWidth / sourceHeight : null;

  const commitWidth = (nextWidth: number) => {
    if (!aspectRatio) {
      onChange({ maxWidth: nextWidth });
      return;
    }

    onChange({
      maxWidth: nextWidth,
      maxHeight: Math.max(1, Math.round(nextWidth / aspectRatio)),
    });
  };

  const commitHeight = (nextHeight: number) => {
    if (!aspectRatio) {
      onChange({ maxHeight: nextHeight });
      return;
    }

    onChange({
      maxHeight: nextHeight,
      maxWidth: Math.max(1, Math.round(nextHeight * aspectRatio)),
    });
  };

  const handleWidthChange = (rawValue: string) => {
    setWidthInput(rawValue);
    if (rawValue.trim() === '') {
      return;
    }

    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 1) {
      commitWidth(Math.round(parsed));
    }
  };

  const handleHeightChange = (rawValue: string) => {
    setHeightInput(rawValue);
    if (rawValue.trim() === '') {
      return;
    }

    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 1) {
      commitHeight(Math.round(parsed));
    }
  };

  const handleWidthBlur = () => {
    if (widthInput.trim() === '') {
      setWidthInput(String(value.maxWidth));
      return;
    }

    const parsed = Number(widthInput);
    const nextWidth = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : Math.max(1, value.maxWidth);
    setWidthInput(String(nextWidth));
    commitWidth(nextWidth);
  };

  const handleHeightBlur = () => {
    if (heightInput.trim() === '') {
      setHeightInput(String(value.maxHeight));
      return;
    }

    const parsed = Number(heightInput);
    const nextHeight = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : Math.max(1, value.maxHeight);
    setHeightInput(String(nextHeight));
    commitHeight(nextHeight);
  };

  return (
    <>
      <Grid.Item col={12} direction="column" alignItems="stretch">
        <Typography variant="pi" fontWeight="bold" textColor="neutral800">
          {formatMessage({
            id: getTranslationKey('settings.resize.title'),
            defaultMessage: 'Output dimensions',
          })}
        </Typography>
      </Grid.Item>

      <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
        <Field.Root name={`${namePrefix}maxWidth`}>
          <Field.Label>
            {formatMessage({
              id: getTranslationKey('settings.resize.width'),
              defaultMessage: 'Width (px)',
            })}
          </Field.Label>
          <TextInput
            type="number"
            min={1}
            value={widthInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleWidthChange(e.target.value)}
            onBlur={handleWidthBlur}
            disabled={disabled}
          />
        </Field.Root>
      </Grid.Item>

      <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
        <Field.Root name={`${namePrefix}maxHeight`}>
          <Field.Label>
            {formatMessage({
              id: getTranslationKey('settings.resize.height'),
              defaultMessage: 'Height (px)',
            })}
          </Field.Label>
          <TextInput
            type="number"
            min={1}
            value={heightInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleHeightChange(e.target.value)}
            onBlur={handleHeightBlur}
            disabled={disabled}
          />
        </Field.Root>
      </Grid.Item>

      <Grid.Item col={12} direction="column" alignItems="stretch">
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslationKey('settings.resize.hint'),
            defaultMessage:
              'Defaults to the original image size. Change either value to resize; the other updates to keep aspect ratio.',
          })}
        </Typography>
      </Grid.Item>
    </>
  );
};
