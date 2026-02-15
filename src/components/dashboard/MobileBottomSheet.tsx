import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Snap points as percentage of viewport height from bottom
const SNAP_CLOSED = 0;      // fully closed
const SNAP_PEEK = 45;       // ~45% - initial peek
const SNAP_FULL = 92;       // ~92% - near full screen

const VELOCITY_THRESHOLD = 0.5; // px/ms - flick detection
const DRAG_THRESHOLD = 10;      // min px to count as drag vs tap

export function MobileBottomSheet({ isOpen, onClose, children }: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
    currentHeight: 0,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
    hasMoved: false,
  });
  const [sheetHeight, setSheetHeight] = useState(SNAP_CLOSED);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay so the CSS transition kicks in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSheetHeight(SNAP_PEEK);
        });
      });
    } else {
      setSheetHeight(SNAP_CLOSED);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const snapTo = useCallback((targetHeight: number) => {
    if (targetHeight <= 10) {
      setSheetHeight(SNAP_CLOSED);
      onClose();
    } else {
      setSheetHeight(targetHeight);
    }
  }, [onClose]);

  const getClosestSnap = useCallback((height: number, velocity: number) => {
    // If flicking down fast, close or go to peek
    if (velocity > VELOCITY_THRESHOLD) {
      if (height > SNAP_PEEK + 10) return SNAP_PEEK;
      return SNAP_CLOSED;
    }
    // If flicking up fast, expand
    if (velocity < -VELOCITY_THRESHOLD) {
      if (height < SNAP_PEEK - 10) return SNAP_PEEK;
      return SNAP_FULL;
    }

    // Otherwise snap to closest
    const snaps = [SNAP_CLOSED, SNAP_PEEK, SNAP_FULL];
    let closest = snaps[0];
    let minDist = Math.abs(height - closest);
    for (const snap of snaps) {
      const dist = Math.abs(height - snap);
      if (dist < minDist) {
        minDist = dist;
        closest = snap;
      }
    }
    return closest;
  }, []);

  const handlePointerStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const now = Date.now();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      isDragging: true,
      startY: e.clientY,
      startHeight: sheetHeight,
      currentHeight: sheetHeight,
      startTime: now,
      lastY: e.clientY,
      lastTime: now,
      hasMoved: false,
    };
    setIsDragging(true);
  }, [sheetHeight]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;

    const deltaY = dragRef.current.startY - e.clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const now = Date.now();

    if (Math.abs(e.clientY - dragRef.current.startY) > DRAG_THRESHOLD) {
      dragRef.current.hasMoved = true;
    }

    dragRef.current.lastY = e.clientY;
    dragRef.current.lastTime = now;

    const newHeight = Math.max(0, Math.min(SNAP_FULL + 5, dragRef.current.startHeight + deltaVh));
    dragRef.current.currentHeight = newHeight;
    setSheetHeight(newHeight);
  }, []);

  const handlePointerEnd = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // No-op if capture was not set.
    }

    const now = Date.now();
    const dt = now - dragRef.current.lastTime || 1;
    const dy = dragRef.current.lastY - dragRef.current.startY;
    // velocity in vh/ms (positive = dragging down)
    const velocity = (dy / window.innerHeight * 100) / dt;

    dragRef.current.isDragging = false;
    setIsDragging(false);

    if (!dragRef.current.hasMoved) return;

    const closest = getClosestSnap(dragRef.current.currentHeight, velocity);
    snapTo(closest);
  }, [getClosestSnap, snapTo]);

  // Handle overlay click
  const handleOverlayClick = useCallback(() => {
    snapTo(SNAP_CLOSED);
  }, [snapTo]);

  if (!isVisible) return null;

  const overlayOpacity = Math.min(sheetHeight / SNAP_PEEK, 1) * 0.4;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black"
        style={{
          opacity: overlayOpacity,
          transition: isDragging ? 'none' : 'opacity 300ms ease',
          pointerEvents: sheetHeight > 5 ? 'auto' : 'none',
        }}
        onClick={handleOverlayClick}
      />

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dashboard-panel rounded-t-[14px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
        style={{
          height: `${sheetHeight}vh`,
          transition: isDragging ? 'none' : 'height 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'height',
          maxHeight: '100vh',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Drag handle area */}
        <div className="relative flex-shrink-0">
          <div
            className="absolute inset-x-0 -top-3 -bottom-3 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={handlePointerStart}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          />
          <div className="pt-2 pb-1">
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-300" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {children}
        </div>
      </div>
    </>
  );
}
