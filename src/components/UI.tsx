import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, USERS } from '../store';
import { Send, Plus, Link as LinkIcon, Image as ImageIcon, Map, CalendarDays, Search, X } from 'lucide-react';
import { supabase } from '../supabase';

// ──────────────────────────────────────────
// ② ミニマップ
// ──────────────────────────────────────────
const Minimap = () => {
  const notes = useStore(s => s.notes);
  const connections = useStore(s => s.connections);
  const focusedNoteId = useStore(s => s.focusedNoteId);
  const setFocusedNoteId = useStore(s => s.setFocusedNoteId);

  const SIZE = 160;
  const SCALE = 5; // 3D座標 → ピクセルのスケール

  // 全ノードの座標を中心(SIZE/2)を原点にマッピング
  const project = (x: number, y: number) => ({
    px: SIZE / 2 + (x * SIZE) / (SCALE * 2),
    py: SIZE / 2 - (y * SIZE) / (SCALE * 2),
  });

  return (
    <div style={{
      position: 'absolute',
      bottom: 120,
      right: 20,
      width: SIZE,
      height: SIZE,
      background: '#000',
      border: '2px solid #0ff',
      boxShadow: '4px 4px 0px rgba(0,255,255,0.3)',
    }}>
      <div style={{ position: 'absolute', top: 2, left: 4, fontSize: '9px', color: '#0ff', letterSpacing: '1px' }}>RADAR</div>
      <svg width={SIZE} height={SIZE} style={{ display: 'block' }}>
        {/* グリッドライン */}
        <line x1={SIZE/2} y1={0} x2={SIZE/2} y2={SIZE} stroke="#0ff" strokeOpacity={0.1} strokeWidth={1} />
        <line x1={0} y1={SIZE/2} x2={SIZE} y2={SIZE/2} stroke="#0ff" strokeOpacity={0.1} strokeWidth={1} />

        {/* 接続線 */}
        {connections.map(c => {
          const from = notes.find(n => n.id === c.from_note_id);
          const to = notes.find(n => n.id === c.to_note_id);
          if (!from || !to) return null;
          const p1 = project(from.position.x, from.position.y);
          const p2 = project(to.position.x, to.position.y);
          return <line key={c.id} x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="#0ff" strokeOpacity={0.3} strokeWidth={1} />;
        })}

        {/* ノード */}
        {notes.map(note => {
          const u = USERS.find(u => u.id === note.user_id) || USERS[0];
          const isChild = connections.some(c => c.to_note_id === note.id);
          const isFocused = focusedNoteId === note.id;
          const { px, py } = project(note.position.x, note.position.y);
          const r = isChild ? 2 : 4;
          return (
            <circle
              key={note.id}
              cx={px} cy={py} r={isFocused ? r + 2 : r}
              fill={u.color}
              opacity={isChild ? 0.6 : 1}
              stroke={isFocused ? '#fff' : 'none'}
              strokeWidth={1}
              style={{ cursor: 'pointer' }}
              onClick={() => setFocusedNoteId(note.id)}
            />
          );
        })}
      </svg>
    </div>
  );
};

// ──────────────────────────────────────────
// ③ 検索コマンドパレット
// ──────────────────────────────────────────
const SearchPalette = ({ onClose }: { onClose: () => void }) => {
  const notes = useStore(s => s.notes);
  const connections = useStore(s => s.connections);
  const setFocusedNoteId = useStore(s => s.setFocusedNoteId);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim() === '' ? [] : notes.filter(n => {
    const u = USERS.find(u => u.id === n.user_id);
    const dateStr = new Date(n.created_at).toLocaleDateString();
    return (
      n.text?.toLowerCase().includes(query.toLowerCase()) ||
      u?.name.toLowerCase().includes(query.toLowerCase()) ||
      dateStr.includes(query)
    );
  }).slice(0, 12);

  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '480px',
      background: '#0a0f1a',
      border: '4px solid #0ff',
      boxShadow: '8px 8px 0px rgba(0,255,255,0.4)',
      zIndex: 100,
    }} className="ui-content">
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #0ff', padding: '12px 16px', gap: '8px' }}>
        <Search size={16} color="#0ff" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="SEARCH BY TEXT / USER / DATE..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#fff', fontSize: '14px', fontFamily: 'inherit', letterSpacing: '1px'
          }}
        />
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff', fontFamily: 'inherit' }}>[ESC]</button>
      </div>

      {results.length === 0 && query.trim() !== '' && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '12px' }}>NO SIGNAL FOUND</div>
      )}
      {query.trim() === '' && (
        <div style={{ padding: '12px 16px', color: '#555', fontSize: '11px', letterSpacing: '1px' }}>TYPE TO SEARCH BY TEXT, USERNAME, OR DATE (e.g. 2026/9/28)</div>
      )}

      {results.map(note => {
        const u = USERS.find(u => u.id === note.user_id) || USERS[0];
        const isChild = connections.some(c => c.to_note_id === note.id);
        return (
          <div
            key={note.id}
            onClick={() => { setFocusedNoteId(note.id); onClose(); }}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #111',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#0ff15'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ color: u.color, fontSize: '10px', minWidth: '40px' }}>{isChild ? '↳SAT' : '●STAR'}</span>
            <span style={{ color: u.color, fontWeight: 'bold', fontSize: '12px', minWidth: '16px' }}>{u.name}</span>
            <span style={{ color: '#fff', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {note.text || (note.image_url ? '[IMAGE]' : '---')}
            </span>
            <span style={{ color: '#555', fontSize: '10px' }}>
              {new Date(note.created_at).toLocaleDateString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ──────────────────────────────────────────
// ⑤ カレンダービュー
// ──────────────────────────────────────────
const CalendarView = ({ onClose }: { onClose: () => void }) => {
  const notes = useStore(s => s.notes);
  const connections = useStore(s => s.connections);
  const setFocusedNoteId = useStore(s => s.setFocusedNoteId);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const notesByDate: Record<string, typeof notes> = {};
  notes.forEach(n => {
    const key = new Date(n.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!notesByDate[key]) notesByDate[key] = [];
    notesByDate[key].push(n);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '540px',
      background: '#0a0f1a',
      border: '4px solid #f0f',
      boxShadow: '8px 8px 0px rgba(255,0,255,0.4)',
      zIndex: 100,
    }} className="ui-content">
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '2px solid #f0f' }}>
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: '2px solid #f0f', color: '#f0f', cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>
          ◀
        </button>
        <div style={{ color: '#f0f', letterSpacing: '2px', fontSize: '14px', textShadow: '2px 2px 0px #0ff' }}>
          {year} / {String(month + 1).padStart(2, '0')}
        </div>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: '2px solid #f0f', color: '#f0f', cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>
          ▶
        </button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f0f', fontFamily: 'inherit', fontSize: '14px' }}>[X]</button>
      </div>

      {/* 曜日ヘッダー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #333' }}>
        {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
          <div key={d} style={{ textAlign: 'center', padding: '6px', fontSize: '9px', color: '#555', letterSpacing: '1px' }}>{d}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} style={{ padding: '8px', minHeight: '60px', borderRight: '1px solid #111', borderBottom: '1px solid #111' }} />;
          const dateKey = new Date(year, month, day).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const dayNotes = notesByDate[dateKey] || [];
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

          return (
            <div key={day} style={{
              padding: '4px',
              minHeight: '60px',
              borderRight: '1px solid #111',
              borderBottom: '1px solid #111',
              background: isToday ? 'rgba(0,255,255,0.05)' : 'transparent',
            }}>
              <div style={{ fontSize: '10px', color: isToday ? '#0ff' : '#555', marginBottom: '4px', textAlign: 'right' }}>{day}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayNotes.slice(0, 3).map(note => {
                  const u = USERS.find(u => u.id === note.user_id) || USERS[0];
                  const isChild = connections.some(c => c.to_note_id === note.id);
                  return (
                    <div
                      key={note.id}
                      onClick={() => { setFocusedNoteId(note.id); onClose(); }}
                      style={{
                        background: u.color,
                        color: '#000',
                        fontSize: '8px',
                        padding: '1px 3px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: isChild ? 0.7 : 1,
                      }}
                    >
                      {isChild ? '↳' : '●'} {note.text || '[IMG]'}
                    </div>
                  );
                })}
                {dayNotes.length > 3 && (
                  <div style={{ fontSize: '8px', color: '#555' }}>+{dayNotes.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────
// メインUI
// ──────────────────────────────────────────
export const UI = () => {
  const { currentUser, setCurrentUser, addNote, focusedNoteId, setFocusedNoteId, notes, connections } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // キーボードショートカット (Space or Cmd+K で検索)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowCalendar(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!currentUser) {
    return (
      <div className="ui-layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1a' }}>
        <div className="ui-content" style={{
          background: '#0a0f1a',
          border: '4px solid #fff',
          boxShadow: '8px 8px 0px rgba(0,255,255,0.5)',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '500px',
          color: '#fff',
        }}>
          <h1 style={{ margin: '0 0 32px 0', fontSize: '24px', letterSpacing: '4px', color: '#0ff', textShadow: '2px 2px 0px #f0f' }}>SYSTEM LOGIN</h1>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => setCurrentUser(u)}
                style={{ width: '64px', height: '64px', border: `4px solid ${u.color}`, background: '#000', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', color: u.color, boxShadow: `4px 4px 0px ${u.color}50` }}
                onMouseOver={e => { e.currentTarget.style.background = u.color; e.currentTarget.style.color = '#000'; e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = `2px 2px 0px ${u.color}50`; }}
                onMouseOut={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = u.color; e.currentTarget.style.transform = 'translate(0,0)'; e.currentTarget.style.boxShadow = `4px 4px 0px ${u.color}50`; }}
              >
                {u.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop: '40px', color: '#888', fontSize: '12px', lineHeight: '1.8', letterSpacing: '1px' }}>
            THIS IS A CLOSED SPACE FUSEN FOR A, B, C, D, E, AND F.<br />
            <span style={{ color: '#aaa' }}>THOUGHTS DRIFT, CONNECT, AND REMAIN FOREVER.</span>
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !selectedImage) return;
    setIsUploading(true);
    let imageUrl = '';
    if (selectedImage && supabase) {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { error } = await supabase.storage.from('images').upload(fileName, selectedImage);
      if (!error) {
        const { data } = supabase.storage.from('images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }
    }
    addNote(text, url, focusedNoteId || undefined, imageUrl || undefined);
    setText(''); setUrl(''); setSelectedImage(null); setIsUploading(false); setIsCreating(false);
  };

  return (
    <div className="ui-layer">
      {/* トップバー */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', background: currentUser.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000' }}>
          {currentUser.name}
        </div>
        <div style={{ color: 'white', opacity: 0.8, fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px' }}>FUSEN</div>
      </div>

      {/* 右上ツールバー */}
      <div className="ui-content" style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => { setShowSearch(v => !v); setShowCalendar(false); }}
          title="Search (Cmd+K)"
          style={{ background: showSearch ? '#0ff' : '#0a0f1a', border: '2px solid #0ff', color: showSearch ? '#000' : '#0ff', padding: '8px', cursor: 'pointer' }}
          onMouseOver={e => { e.currentTarget.style.background = '#0ff'; e.currentTarget.style.color = '#000'; }}
          onMouseOut={e => { if (!showSearch) { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = '#0ff'; } }}
        >
          <Search size={16} />
        </button>
        <button
          onClick={() => { setShowCalendar(v => !v); setShowSearch(false); }}
          title="Calendar"
          style={{ background: showCalendar ? '#f0f' : '#0a0f1a', border: '2px solid #f0f', color: showCalendar ? '#000' : '#f0f', padding: '8px', cursor: 'pointer' }}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f'; e.currentTarget.style.color = '#000'; }}
          onMouseOut={e => { if (!showCalendar) { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = '#f0f'; } }}
        >
          <CalendarDays size={16} />
        </button>
        <button
          onClick={() => setShowMinimap(v => !v)}
          title="Minimap"
          style={{ background: showMinimap ? '#fff' : '#0a0f1a', border: '2px solid #fff', color: showMinimap ? '#000' : '#fff', padding: '8px', cursor: 'pointer' }}
          onMouseOver={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}
          onMouseOut={e => { if (!showMinimap) { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = '#fff'; } }}
        >
          <Map size={16} />
        </button>
      </div>

      {/* フォーカス解除ボタン */}
      {focusedNoteId && !isCreating && (
        <button className="ui-content" onClick={() => setFocusedNoteId(null)}
          style={{ position: 'absolute', top: 70, left: 20, background: '#0a0f1a', color: '#0ff', border: '2px solid #0ff', boxShadow: '4px 4px 0px rgba(0,255,255,0.5)', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase' }}
          onMouseOver={e => { e.currentTarget.style.background = '#0ff'; e.currentTarget.style.color = '#000'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = '#0ff'; }}
        >
          ← CANCEL FOCUS
        </button>
      )}

      {/* ② ミニマップ */}
      {showMinimap && <Minimap />}

      {/* ③ 検索パレット */}
      {showSearch && <SearchPalette onClose={() => setShowSearch(false)} />}

      {/* ⑤ カレンダービュー */}
      {showCalendar && <CalendarView onClose={() => setShowCalendar(false)} />}

      {/* FAB */}
      {!isCreating && (
        <button className="ui-content" onClick={() => setIsCreating(true)}
          style={{ position: 'absolute', bottom: 40, right: 20, width: '64px', height: '64px', background: '#0a0f1a', border: `4px solid ${currentUser.color}`, boxShadow: `6px 6px 0px ${currentUser.color}50`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentUser.color }}
          onMouseOver={e => { e.currentTarget.style.background = currentUser.color; e.currentTarget.style.color = '#000'; e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = `4px 4px 0px ${currentUser.color}50`; }}
          onMouseOut={e => { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = currentUser.color; e.currentTarget.style.transform = 'translate(0,0)'; e.currentTarget.style.boxShadow = `6px 6px 0px ${currentUser.color}50`; }}
        >
          {focusedNoteId ? <LinkIcon size={28} /> : <Plus size={28} />}
        </button>
      )}

      {/* 投稿モーダル */}
      {isCreating && (
        <div className="ui-content" style={{ position: 'absolute', bottom: 40, right: 20, width: '320px', background: '#0a0f1a', padding: '20px', boxShadow: `8px 8px 0px ${currentUser.color}50`, border: `4px solid ${currentUser.color}`, color: '#e0e0e0', fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', color: currentUser.color, letterSpacing: '2px', textShadow: '2px 2px 0px #000' }}>
              {focusedNoteId ? 'ATTACH SIGNAL' : 'DROP SIGNAL'}
            </div>
            <button onClick={() => { setIsCreating(false); setSelectedImage(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff', fontFamily: 'inherit', fontSize: '16px' }}>
              [X]
            </button>
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea autoFocus placeholder="Transmit your thought..." value={text} onChange={e => setText(e.target.value)}
              style={{ width: '100%', minHeight: '100px', padding: '12px', border: `2px solid ${currentUser.color}`, background: '#000', color: '#fff', resize: 'none', fontFamily: 'inherit', fontSize: '12px' }}
            />
            <input type="url" placeholder="URL (optional)" value={url} onChange={e => setUrl(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${currentUser.color}`, background: '#000', color: '#fff', fontFamily: 'inherit', fontSize: '12px' }}
            />
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setSelectedImage(e.target.files[0]); }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ background: selectedImage ? currentUser.color : '#111', border: `2px solid ${currentUser.color}`, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: selectedImage ? '#000' : currentUser.color, fontFamily: 'inherit', fontSize: '11px', gap: '4px' }}>
                <ImageIcon size={14} />
                {selectedImage ? 'SELECTED' : 'IMAGE'}
              </button>
              <button type="submit" disabled={(!text.trim() && !selectedImage) || isUploading}
                style={{ background: currentUser.color, color: '#000', border: 'none', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 2, fontFamily: 'inherit', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px', opacity: (!text.trim() && !selectedImage) || isUploading ? 0.5 : 1 }}>
                {isUploading ? 'UPLOADING...' : <><Send size={14} /> {focusedNoteId ? 'ATTACH' : 'DROP'}</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
