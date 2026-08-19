import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CourtDrawing } from '../lib/types';

/**
 * A drawing in hand, on its way from the court to a progress note. Deliberately not
 * persisted: it only has to survive the one hop from Tekenveld to the note form, and a
 * half-finished sketch should not come back a week later.
 */
interface PendingDrawingShape {
  pendingDrawing: CourtDrawing | null;
  setPendingDrawing: (d: CourtDrawing | null) => void;
}

const Ctx = createContext<PendingDrawingShape | null>(null);

export function PendingDrawingProvider({ children }: { children: React.ReactNode }) {
  const [pendingDrawing, setPendingDrawing] = useState<CourtDrawing | null>(null);
  const value = useMemo(() => ({ pendingDrawing, setPendingDrawing }), [pendingDrawing]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePendingDrawing(): PendingDrawingShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePendingDrawing must be used within PendingDrawingProvider');
  return ctx;
}
