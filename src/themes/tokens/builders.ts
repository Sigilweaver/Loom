import { InteractiveElementStyle } from '../../types/theme';
import { ColorPalette } from '../../types/theme';

// Simple, deterministic builders. No color math; accept finished tokens.

export function buildFieldStates(tokens: {
  bg: { base: string; hover?: string; active?: string; disabled: string };
  border: { base: string; hover?: string; active?: string; disabled: string };
  text: { base: string; hover?: string; active?: string; disabled: string };
  focusShadow?: string;
}): InteractiveElementStyle {
  return {
    default: { background: tokens.bg.base, border: tokens.border.base, text: tokens.text.base },
    hover: { background: tokens.bg.hover ?? tokens.bg.base, border: tokens.border.hover ?? tokens.border.base, text: tokens.text.hover ?? tokens.text.base },
    active: { background: tokens.bg.active ?? tokens.bg.base, border: tokens.border.active ?? tokens.border.base, text: tokens.text.active ?? tokens.text.base },
    disabled: { background: tokens.bg.disabled, border: tokens.border.disabled, text: tokens.text.disabled },
    ...(tokens.focusShadow ? { focus: { background: tokens.bg.base, border: tokens.border.active ?? tokens.border.base, text: tokens.text.base, shadow: tokens.focusShadow } } : {}),
  } as const;
}

export function buildButtonStates(tokens: {
  bg: { default: string; hover: string; active: string; disabled: string };
  border: { default: string; hover: string; active: string; disabled: string };
  text: { default: string; hover: string; active: string; disabled: string };
}): InteractiveElementStyle {
  return {
    default: { background: tokens.bg.default, border: tokens.border.default, text: tokens.text.default },
    hover: { background: tokens.bg.hover, border: tokens.border.hover, text: tokens.text.hover },
    active: { background: tokens.bg.active, border: tokens.border.active, text: tokens.text.active },
    disabled: { background: tokens.bg.disabled, border: tokens.border.disabled, text: tokens.text.disabled },
  } as const;
}

// Example convenience wrappers using a palette; still no math, just token picking.
export function buildPrimaryButtonFromPalette(p: ColorPalette): InteractiveElementStyle {
  return buildButtonStates({
    bg: { default: p.brand.primary[500], hover: p.brand.primary[400], active: p.brand.primary[600], disabled: p.gray[300] },
    border: { default: p.brand.primary[600], hover: p.brand.primary[500], active: p.brand.primary[700], disabled: p.gray[400] },
    text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[500] },
  });
}

export function buildSecondaryButtonFromPalette(p: ColorPalette): InteractiveElementStyle {
  return buildButtonStates({
    bg: { default: p.gray[300], hover: p.gray[400], active: p.gray[200], disabled: p.gray[200] },
    border: { default: p.gray[400], hover: p.gray[500], active: p.gray[300], disabled: p.gray[300] },
    text: { default: p.gray[800], hover: p.gray[900], active: p.gray[700], disabled: p.gray[400] },
  });
}

export function buildTertiaryButtonFromPalette(p: ColorPalette): InteractiveElementStyle {
  return buildButtonStates({
    bg: { default: p.foundation.transparent, hover: p.gray[300], active: p.gray[400], disabled: p.foundation.transparent },
    border: { default: p.gray[400], hover: p.gray[500], active: p.gray[500], disabled: p.gray[300] },
    text: { default: p.gray[950], hover: p.gray[950], active: p.gray[950], disabled: p.gray[400] },
  });
}

export function buildDangerButtonFromPalette(p: ColorPalette): InteractiveElementStyle {
  return buildButtonStates({
    bg: { default: p.semantic.error[500], hover: p.semantic.error[400], active: p.semantic.error[600], disabled: p.gray[300] },
    border: { default: p.semantic.error[600], hover: p.semantic.error[500], active: p.semantic.error[700], disabled: p.gray[400] },
    text: { default: p.foundation.white, hover: p.foundation.white, active: p.foundation.white, disabled: p.gray[500] },
  });
}
