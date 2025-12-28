/**
 * Core Palettes
 * 
 * Color palettes for the built-in themes: light, dark, and sigilweaver.
 */

import { ColorPalette } from '../../types/theme';

/**
 * Light Theme Palette
 * Clean and bright colors for daytime use
 */
export const lightPalette: ColorPalette = {
  foundation: { white: '#ffffff', black: '#000000', transparent: 'transparent' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' },
  brand: {
    primary: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
    secondary: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7c3aed', 800: '#6d28d9', 900: '#581c87' },
  },
  semantic: {
    success: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
    warning: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
    error: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
    info: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  },
  tools: {
    inout: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
    preparation: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
    join: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7c3aed', 800: '#6d28d9', 900: '#581c87' },
    aggregate: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
    favorites: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12' },
  },
};

/**
 * Dark Theme Palette
 * Easy on the eyes for nighttime use
 */
export const darkPalette: ColorPalette = {
  foundation: { white: '#ffffff', black: '#000000', transparent: 'transparent' },
  gray: { 50: '#030712', 100: '#111827', 200: '#1f2937', 300: '#374151', 400: '#4b5563', 500: '#6b7280', 600: '#9ca3af', 700: '#d1d5db', 800: '#e5e7eb', 900: '#f3f4f6', 950: '#f9fafb' },
  brand: {
    primary: { 50: '#0c4a6e', 100: '#075985', 200: '#0369a1', 300: '#0284c7', 400: '#0ea5e9', 500: '#38bdf8', 600: '#7dd3fc', 700: '#bae6fd', 800: '#e0f2fe', 900: '#f0f9ff' },
    secondary: { 50: '#581c87', 100: '#6d28d9', 200: '#7c3aed', 300: '#9333ea', 400: '#a855f7', 500: '#c084fc', 600: '#d8b4fe', 700: '#e9d5ff', 800: '#f3e8ff', 900: '#faf5ff' },
  },
  semantic: {
    success: { 50: '#064e3b', 100: '#065f46', 200: '#047857', 300: '#059669', 400: '#10b981', 500: '#34d399', 600: '#6ee7b7', 700: '#a7f3d0', 800: '#d1fae5', 900: '#ecfdf5' },
    warning: { 50: '#78350f', 100: '#92400e', 200: '#b45309', 300: '#d97706', 400: '#f59e0b', 500: '#fbbf24', 600: '#fcd34d', 700: '#fde68a', 800: '#fef3c7', 900: '#fffbeb' },
    error: { 50: '#7f1d1d', 100: '#991b1b', 200: '#b91c1c', 300: '#dc2626', 400: '#ef4444', 500: '#f87171', 600: '#fca5a5', 700: '#fecaca', 800: '#fee2e2', 900: '#fef2f2' },
    info: { 50: '#1e3a8a', 100: '#1e40af', 200: '#1d4ed8', 300: '#2563eb', 400: '#3b82f6', 500: '#60a5fa', 600: '#93c5fd', 700: '#bfdbfe', 800: '#dbeafe', 900: '#eff6ff' },
  },
  tools: {
    inout: { 50: '#064e3b', 100: '#065f46', 200: '#047857', 300: '#059669', 400: '#10b981', 500: '#34d399', 600: '#6ee7b7', 700: '#a7f3d0', 800: '#d1fae5', 900: '#ecfdf5' },
    preparation: { 50: '#1e3a8a', 100: '#1e40af', 200: '#1d4ed8', 300: '#2563eb', 400: '#3b82f6', 500: '#60a5fa', 600: '#93c5fd', 700: '#bfdbfe', 800: '#dbeafe', 900: '#eff6ff' },
    join: { 50: '#581c87', 100: '#6d28d9', 200: '#7c3aed', 300: '#9333ea', 400: '#a855f7', 500: '#c084fc', 600: '#d8b4fe', 700: '#e9d5ff', 800: '#f3e8ff', 900: '#faf5ff' },
    aggregate: { 50: '#7c2d12', 100: '#9a3412', 200: '#c2410c', 300: '#ea580c', 400: '#f97316', 500: '#fb923c', 600: '#fdba74', 700: '#fed7aa', 800: '#ffedd5', 900: '#fff7ed' },
    favorites: { 50: '#713f12', 100: '#854d0e', 200: '#a16207', 300: '#ca8a04', 400: '#eab308', 500: '#facc15', 600: '#fde047', 700: '#fef08a', 800: '#fef9c3', 900: '#fefce8' },
  },
};

/**
 * Sigilweaver Theme Palette
 * Mystical purple-tinted dark palette for the signature theme
 */
export const sigilweaverPalette: ColorPalette = {
  foundation: { white: '#ffffff', black: '#000000', transparent: 'transparent' },
  gray: { 50: '#1a0b2e', 100: '#2a1a3e', 200: '#3a2a52', 300: '#4a3a66', 400: '#6a5a86', 500: '#8a7aa6', 600: '#aaa0c6', 700: '#cac0e6', 800: '#eae0f6', 900: '#f5f0ff', 950: '#ffffff' },
  brand: {
    primary: { 50: '#4c2a6b', 100: '#5c3a7b', 200: '#6b3fa0', 300: '#7c4fb0', 400: '#8b5cf6', 500: '#9d6ff8', 600: '#a78bfa', 700: '#b794fb', 800: '#c4b5fd', 900: '#ddd6fe' },
    secondary: { 50: '#b45309', 100: '#d97706', 200: '#f59e0b', 300: '#fbbf24', 400: '#fcd34d', 500: '#fde68a', 600: '#fef3c7', 700: '#fffbeb', 800: '#fffef7', 900: '#ffffff' },
  },
  semantic: {
    success: { 50: '#064e3b', 100: '#065f46', 200: '#047857', 300: '#059669', 400: '#10b981', 500: '#34d399', 600: '#6ee7b7', 700: '#a7f3d0', 800: '#d1fae5', 900: '#ecfdf5' },
    warning: { 50: '#78350f', 100: '#92400e', 200: '#b45309', 300: '#d97706', 400: '#f59e0b', 500: '#fbbf24', 600: '#fcd34d', 700: '#fde68a', 800: '#fef3c7', 900: '#fffbeb' },
    error: { 50: '#450a0a', 100: '#7f1d1d', 200: '#991b1b', 300: '#b91c1c', 400: '#dc2626', 500: '#b91c1c', 600: '#dc2626', 700: '#ef4444', 800: '#fee2e2', 900: '#fef2f2' },
    info: { 50: '#1e3a8a', 100: '#1e40af', 200: '#1d4ed8', 300: '#2563eb', 400: '#3b82f6', 500: '#60a5fa', 600: '#93c5fd', 700: '#bfdbfe', 800: '#dbeafe', 900: '#eff6ff' },
  },
  tools: {
    inout: { 50: '#064e3b', 100: '#065f46', 200: '#047857', 300: '#059669', 400: '#10b981', 500: '#34d399', 600: '#6ee7b7', 700: '#a7f3d0', 800: '#d1fae5', 900: '#ecfdf5' },
    preparation: { 50: '#1e3a8a', 100: '#1e40af', 200: '#1d4ed8', 300: '#2563eb', 400: '#3b82f6', 500: '#60a5fa', 600: '#93c5fd', 700: '#bfdbfe', 800: '#dbeafe', 900: '#eff6ff' },
    join: { 50: '#4c1d95', 100: '#5b21b6', 200: '#6d28d9', 300: '#7c3aed', 400: '#8b5cf6', 500: '#a78bfa', 600: '#c4b5fd', 700: '#ddd6fe', 800: '#ede9fe', 900: '#f5f3ff' },
    aggregate: { 50: '#78350f', 100: '#92400e', 200: '#b45309', 300: '#d97706', 400: '#f59e0b', 500: '#fbbf24', 600: '#fcd34d', 700: '#fde68a', 800: '#fef3c7', 900: '#fffbeb' },
    favorites: { 50: '#713f12', 100: '#854d0e', 200: '#a16207', 300: '#ca8a04', 400: '#eab308', 500: '#facc15', 600: '#fde047', 700: '#fef08a', 800: '#fef9c3', 900: '#fefce8' },
  },
};
