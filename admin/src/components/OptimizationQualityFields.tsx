import React, { useEffect, useState } from 'react';
import { Field, Grid, TextInput } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { getTranslationKey, type OptimizationSettings } from '../pluginId';
import { type QualityField } from '../utils/optimizationFields';

interface OptimizationQualityFieldsProps {
  value: Pick<OptimizationSettings, 'webpQuality' | 'jpegQuality' | 'pngCompressionLevel'>;
  fields: QualityField[];
  onChange: (patch: Partial<OptimizationSettings>) => void;
  disabled?: boolean;
  namePrefix?: string;
}

interface QualityInputItemProps {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (nextValue: number) => void;
}

const clampInt = (raw: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(raw)));

const QualityInputItem = ({
  name,
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: QualityInputItemProps) => {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    if (raw.trim() === '') {
      return;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      onCommit(Math.round(parsed));
    }
  };

  const handleBlur = () => {
    if (inputValue.trim() === '') {
      setInputValue(String(value));
      return;
    }

    const parsed = Number(inputValue);
    const next = Number.isFinite(parsed) ? clampInt(parsed, min, max) : value;
    setInputValue(String(next));
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
      <Field.Root name={name}>
        <Field.Label>{label}</Field.Label>
        <TextInput
          type="number"
          min={min}
          max={max}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
        />
      </Field.Root>
    </Grid.Item>
  );
};

export const OptimizationQualityFields = ({
  value,
  fields,
  onChange,
  disabled = false,
  namePrefix = '',
}: OptimizationQualityFieldsProps) => {
  const { formatMessage } = useIntl();

  return (
    <>
      {fields.includes('webp') && (
        <QualityInputItem
          name={`${namePrefix}webpQuality`}
          label={formatMessage({
            id: getTranslationKey('settings.global.webpQuality'),
            defaultMessage: 'WebP quality',
          })}
          value={value.webpQuality}
          min={1}
          max={100}
          disabled={disabled}
          onCommit={(webpQuality) => onChange({ webpQuality })}
        />
      )}

      {fields.includes('jpeg') && (
        <QualityInputItem
          name={`${namePrefix}jpegQuality`}
          label={formatMessage({
            id: getTranslationKey('settings.global.jpegQuality'),
            defaultMessage: 'JPEG quality',
          })}
          value={value.jpegQuality}
          min={1}
          max={100}
          disabled={disabled}
          onCommit={(jpegQuality) => onChange({ jpegQuality })}
        />
      )}

      {fields.includes('png') && (
        <QualityInputItem
          name={`${namePrefix}pngCompression`}
          label={formatMessage({
            id: getTranslationKey('settings.global.pngCompression'),
            defaultMessage: 'PNG compression level',
          })}
          value={value.pngCompressionLevel}
          min={0}
          max={9}
          disabled={disabled}
          onCommit={(pngCompressionLevel) => onChange({ pngCompressionLevel })}
        />
      )}
    </>
  );
};
