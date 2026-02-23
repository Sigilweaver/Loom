import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToolsByCategory, TOOL_DEFINITIONS } from '@data/tools';
import { useUIStore } from '@state/uiStore';
import type { ToolCategory } from '@domain/workflow/entities/workflow';
import { Star, ArrowRightLeft, Wrench, Link, BarChart3, ChevronRight } from 'lucide-react';

interface Props {
  open: boolean;
  coords: { x: number; y: number } | null;
  onSelectTool: (toolType: string) => void;
  onClose: () => void;
  filterDirection?: 'input' | 'output' | undefined; // Filter tools by required socket direction
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  favorites: 'Favorites',
  connect: 'Connect',
  compute: 'Compute',
  reshape: 'Reshape',
  combine: 'Combine',
};

const CATEGORY_ICONS: Record<ToolCategory, React.ElementType> = {
  favorites: Star,
  connect: ArrowRightLeft,
  compute: Wrench,
  reshape: BarChart3,
  combine: Link,
};

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  favorites: 'var(--color-favorites)',
  connect: 'var(--color-tool-connect)',
  compute: 'var(--color-tool-compute)',
  reshape: 'var(--color-tool-reshape)',
  combine: 'var(--color-tool-combine)',
};

const CATEGORIES: ToolCategory[] = ['favorites', 'connect', 'compute', 'reshape', 'combine'];

export const CanvasToolSelectionMenu: React.FC<Props> = ({ open, coords, onSelectTool, onClose, filterDirection }) => {
  const favoriteTools = useUIStore((s) => s.favoriteTools);
  const [hoveredCategory, setHoveredCategory] = useState<ToolCategory | null>(null);
  const [submenuCoords, setSubmenuCoords] = useState<{ x: number; y: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState<ToolCategory | null>(null); // For touch tap support
  const containerRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  // Filter tools based on required socket direction
  const filterToolsByDirection = (tools: typeof TOOL_DEFINITIONS) => {
    if (!filterDirection) return tools;
    return tools.filter(tool => 
      tool.sockets.some(socket => socket.direction === filterDirection)
    );
  };

  // Clear any pending hide timeout
  const clearHideTimeout = () => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      clearHideTimeout();
      // Reset submenu state when menu closes
      setHoveredCategory(null);
      setSubmenuCoords(null);
      setActiveCategory(null);
      return;
    }

    // Reset submenu state when menu opens
    setHoveredCategory(null);
    setSubmenuCoords(null);
    setActiveCategory(null);

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const mainMenu = containerRef.current;
      const submenu = submenuRef.current;
      if (!mainMenu) return;
      
      const target = e.target as Node;
      // Close if clicking outside both main menu and submenu
      if (!mainMenu.contains(target) && (!submenu || !submenu.contains(target))) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    document.addEventListener('contextmenu', handlePointerDown, true);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      document.removeEventListener('contextmenu', handlePointerDown, true);
      document.removeEventListener('keydown', handleKey);
      clearHideTimeout();
    };
  }, [open, onClose]);

  const handleCategoryMouseEnter = (category: ToolCategory, e: React.MouseEvent<HTMLButtonElement>) => {
    clearHideTimeout();
    setHoveredCategory(category);
    setActiveCategory(category);
    const rect = e.currentTarget.getBoundingClientRect();
    setSubmenuCoords({
      x: rect.right + 4,
      y: rect.top,
    });
  };

  const handleCategoryMouseLeave = () => {
    // Delay hiding to allow moving to submenu
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setHoveredCategory(null);
      setSubmenuCoords(null);
    }, 150);
  };

  // Touch support: tap to toggle category submenu
  const handleCategoryTouchEnd = (category: ToolCategory, e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    clearHideTimeout();
    
    if (activeCategory === category) {
      // Tap again to close
      setActiveCategory(null);
      setHoveredCategory(null);
      setSubmenuCoords(null);
    } else {
      // Open this category
      setActiveCategory(category);
      setHoveredCategory(category);
      const rect = e.currentTarget.getBoundingClientRect();
      setSubmenuCoords({
        x: rect.right + 4,
        y: rect.top,
      });
    }
  };

  const handleSubmenuMouseEnter = () => {
    // Cancel any pending hide when entering submenu
    clearHideTimeout();
  };

  const handleSubmenuMouseLeave = () => {
    // Hide submenu when leaving
    clearHideTimeout();
    setHoveredCategory(null);
    setSubmenuCoords(null);
  };

  const handleToolClick = (toolType: string) => {
    onSelectTool(toolType);
    onClose();
  };

  const handleToolTouchEnd = (toolType: string, e: React.TouchEvent) => {
    e.preventDefault();
    onSelectTool(toolType);
    onClose();
  };

  if (!open || !coords) return null;

  const displayCategory = activeCategory || hoveredCategory;
  const tools = displayCategory ? filterToolsByDirection(getToolsByCategory(displayCategory, favoriteTools)) : [];

  return createPortal(
    <>
      {/* Main category menu */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: coords.x,
          top: coords.y,
          background: 'var(--color-canvas-controls-bg)',
          border: '1px solid var(--color-canvas-controls-border)',
          borderRadius: 6,
          boxShadow: 'var(--color-canvas-controls-shadow)',
          zIndex: 10000,
          width: 160,
          overflow: 'hidden',
        }}
      >
        {CATEGORIES.map((category) => {
          const categoryTools = filterToolsByDirection(getToolsByCategory(category, favoriteTools));
          if (categoryTools.length === 0) return null;

          const CategoryIcon = CATEGORY_ICONS[category];
          const categoryColor = CATEGORY_COLORS[category];
          const isActive = displayCategory === category;

          return (
            <button
              key={category}
              onMouseEnter={(e) => handleCategoryMouseEnter(category, e)}
              onMouseLeave={handleCategoryMouseLeave}
              onTouchEnd={(e) => handleCategoryTouchEnd(category, e)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: isActive ? 'var(--color-canvas-controls-btn-hover)' : 'transparent',
                color: 'var(--color-canvas-controls-btn-text)',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CategoryIcon size={16} style={{ flexShrink: 0, color: categoryColor }} />
                <span>{CATEGORY_LABELS[category]}</span>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {/* Submenu for tools */}
      {displayCategory && submenuCoords && tools.length > 0 && (
        <div
          ref={submenuRef}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
          style={{
            position: 'fixed',
            left: submenuCoords.x,
            top: submenuCoords.y,
            background: 'var(--color-canvas-controls-bg)',
            border: '1px solid var(--color-canvas-controls-border)',
            borderRadius: 6,
            boxShadow: 'var(--color-canvas-controls-shadow)',
            zIndex: 10001,
            width: 180,
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {tools.map((tool) => {
            const Icon = tool.icon;
            const toolColor = CATEGORY_COLORS[tool.category];
            return (
              <button
                key={tool.type}
                onClick={() => handleToolClick(tool.type)}
                onTouchEnd={(e) => handleToolTouchEnd(tool.type, e)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-canvas-controls-btn-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-canvas-controls-btn-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <Icon size={16} style={{ flexShrink: 0, color: toolColor }} />
                <span>{tool.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </>,
    document.body
  );
};
