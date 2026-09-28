import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore, USERS } from '../store';

const ITEM_HEIGHT = 48; // px per item
const VISIBLE_ITEMS = 5; // 上下に何個見えるか（奇数推奨）
const HALF = Math.floor(VISIBLE_ITEMS / 2);

export const DrumTimeline = () => {
  const notes = useStore(s => s.notes);
  const connections = useStore(s => s.connections);
  const focusedNoteId = useStore(s => s.focusedNoteId);
  const setFocusedNoteId = useStore(s => s.setFocusedNoteId);

  // 古い順にソート
  const sorted = [...notes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const [centerIndex, setCenterIndex] = useState(0);
  const [offset, setOffset] = useState(0); // ドラッグ中の一時オフセット(px)
  const dragStartY = useRef<number | null>(null);
  const drumRef = useRef<HTMLDivElement>(null);

  // フォーカスが変わったらドラムを合わせる
  useEffect(() => {
    if (focusedNoteId) {
      const idx = sorted.findIndex(n => n.id === focusedNoteId);
      if (idx !== -1) setCenterIndex(idx);
    }
  }, [focusedNoteId]);

  const clamp = (v: number) => Math.max(0, Math.min(sorted.length - 1, v));

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    setOffset(e.clientY - dragStartY.current);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    const steps = Math.round(-delta / ITEM_HEIGHT);
    setCenterIndex(prev => clamp(prev + steps));
    setOffset(0);
    dragStartY.current = null;
  }, [sorted.length]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const steps = Math.sign(e.deltaY);
    setCenterIndex(prev => clamp(prev + steps));
  }, [sorted.length]);

  const onClickItem = (idx: number) => {
    if (idx === centerIndex) {
      // 中央アイテムをクリックしたらフォーカス
      setFocusedNoteId(sorted[idx].id);
    } else {
      setCenterIndex(idx);
    }
  };

  if (sorted.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 20,
        width: '200px',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* ラベル */}
      <div style={{ color: '#0ff', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px', textShadow: '1px 1px 0px #f0f' }}>
        [ DRUM LOG ]
      </div>

      {/* ドラム本体 */}
      <div
        ref={drumRef}
        style={{
          position: 'relative',
          height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px`,
          overflow: 'hidden',
          cursor: 'grab',
          perspective: '400px',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* 中央のハイライト枠 */}
        <div style={{
          position: 'absolute',
          top: `${HALF * ITEM_HEIGHT}px`,
          left: 0, right: 0,
          height: `${ITEM_HEIGHT}px`,
          background: 'rgba(0,255,255,0.06)',
          borderTop: '2px solid #0ff',
          borderBottom: '2px solid #0ff',
          pointerEvents: 'none',
          zIndex: 2,
        }} />

        {/* 上下グラデーションで奥行き感 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, #0a0f1a 0%, transparent 30%, transparent 70%, #0a0f1a 100%)',
          pointerEvents: 'none',
          zIndex: 3,
        }} />

        {/* アイテム群 */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          transformOrigin: 'center center',
          transform: `translateY(${offset}px)`,
          transition: dragStartY.current !== null ? 'none' : 'transform 0.2s ease-out',
        }}>
          {sorted.map((note, idx) => {
            const u = USERS.find(u => u.id === note.user_id) || USERS[0];
            const isChild = connections.some(c => c.to_note_id === note.id);
            const isCenterFocused = focusedNoteId === note.id;

            // ドラムの回転角度で奥行きを表現
            const relIdx = idx - centerIndex;
            const maxAngle = 50; // 最大傾き（度）
            const angleStep = maxAngle / (VISIBLE_ITEMS / 2);
            const angle = relIdx * angleStep;
            const absRel = Math.abs(relIdx);

            // 見える範囲外は非表示
            if (absRel > HALF + 1) return null;

            const opacity = Math.max(0, 1 - absRel * 0.28);
            const scale = Math.max(0.6, 1 - absRel * 0.1);

            return (
              <div
                key={note.id}
                onClick={() => onClickItem(idx)}
                style={{
                  position: 'absolute',
                  top: `${idx * ITEM_HEIGHT}px`,
                  left: 0, right: 0,
                  height: `${ITEM_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0 10px',
                  cursor: 'pointer',
                  transformOrigin: 'center center',
                  transform: `
                    translateY(${-centerIndex * ITEM_HEIGHT}px)
                    rotateX(${-angle}deg)
                    scale(${scale})
                  `,
                  opacity,
                  transition: dragStartY.current !== null ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                  zIndex: VISIBLE_ITEMS - absRel,
                  willChange: 'transform',
                }}
              >
                {/* カラードット */}
                <div style={{
                  width: isChild ? '6px' : '10px',
                  height: isChild ? '6px' : '10px',
                  background: u.color,
                  flexShrink: 0,
                  boxShadow: isCenterFocused ? `0 0 8px ${u.color}` : (absRel === 0 ? `0 0 4px ${u.color}` : 'none'),
                }} />

                {/* テキスト */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: absRel === 0 ? '13px' : '11px',
                    color: absRel === 0 ? (isCenterFocused ? u.color : '#fff') : '#888',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '0.5px',
                    textShadow: isCenterFocused ? `0 0 8px ${u.color}` : 'none',
                  }}>
                    {note.text || (note.image_url ? '[IMAGE]' : '---')}
                  </div>
                  <div style={{ fontSize: '9px', color: '#444', letterSpacing: '0.5px' }}>
                    {u.name} · {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* 中央だったら矢印 */}
                {absRel === 0 && (
                  <div style={{ color: '#0ff', fontSize: '10px', flexShrink: 0, opacity: 0.7 }}>▶</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* インジケーター */}
      <div style={{ textAlign: 'center', color: '#555', fontSize: '9px', marginTop: '2px', letterSpacing: '1px' }}>
        {centerIndex + 1} / {sorted.length}
      </div>
    </div>
  );
};
