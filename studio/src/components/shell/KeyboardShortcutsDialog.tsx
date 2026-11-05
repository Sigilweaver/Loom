/**
 * Keyboard shortcut reference, opened with "?" or the header keyboard button.
 */
import { Fragment } from 'react';
import { useUIStore } from '@state/uiStore';
import { SHORTCUT_GROUPS, isMacPlatform, keyLabel } from '../../utils/shortcuts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/Dialog';

export default function KeyboardShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUIStore((s) => s.setShortcutsHelpOpen);
  const mac = isMacPlatform();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="!max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Workflow shortcuts also work while a field has focus.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-5 px-6 py-4 overflow-y-auto sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} aria-labelledby={`shortcuts-${group.title}`}>
              <h3
                id={`shortcuts-${group.title}`}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-theme-text-tertiary"
              >
                {group.title}
              </h3>
              <dl className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <dt className="text-theme-text-secondary">{shortcut.description}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <Fragment key={key}>
                          {i > 0 && <span className="text-theme-text-tertiary">+</span>}
                          <kbd className="min-w-[1.5rem] rounded border border-theme-border-secondary bg-theme-surface-panel px-1.5 py-0.5 text-center font-mono text-[11px] text-theme-text-primary">
                            {keyLabel(key, mac)}
                          </kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
