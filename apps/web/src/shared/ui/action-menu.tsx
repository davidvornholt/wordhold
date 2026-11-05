import { EllipsisIcon } from 'lucide-react';
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from './button';

export type ActionMenuItem = {
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly opensDialog?: boolean;
};

type ActionMenuProps = {
  readonly label: string;
  readonly items: ReadonlyArray<ActionMenuItem>;
  // A dialog opened from the menu returns focus here, because the item that
  // opened it is unmounted by then.
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
};

const itemClass =
  'flex min-h-11 w-full items-center whitespace-nowrap px-4 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2';

const nextIndex = (
  key: string,
  current: number,
  count: number,
): number | null => {
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};

// Opens upward, because it serves bars that sit at the bottom of the viewport.
// The items leave the tab order, and the arrow keys move between them instead,
// as the ARIA menu button pattern expects.
export const ActionMenu = ({ label, items, triggerRef }: ActionMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    // Not on blur: Safari doesn't focus a clicked button, so a click on the
    // trigger would close the menu and then reopen it.
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  const closeToTrigger = () => {
    triggerRef.current?.focus();
    setOpen(false);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      // Tabbing then continues from the trigger, since the focused item is about
      // to unmount.
      closeToTrigger();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeToTrigger();
      return;
    }
    const elements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const next = nextIndex(
      event.key,
      elements.indexOf(event.target as HTMLElement),
      elements.length,
    );
    if (next !== null) {
      event.preventDefault();
      elements[next]?.focus();
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => (open ? closeToTrigger() : setOpen(true))}
        ref={triggerRef}
        title={label}
        variant="icon"
      >
        <EllipsisIcon aria-hidden={true} className="size-4" />
      </Button>
      {open ? (
        <div
          aria-label={label}
          className="absolute right-0 bottom-full z-10 mb-2 border border-border bg-card shadow-lg"
          id={menuId}
          onKeyDown={onMenuKeyDown}
          ref={menuRef}
          role="menu"
          tabIndex={-1}
        >
          {items.map((item) => (
            <button
              aria-haspopup={item.opensDialog === true ? 'dialog' : undefined}
              className={
                item.destructive === true
                  ? `${itemClass} text-destructive`
                  : itemClass
              }
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
