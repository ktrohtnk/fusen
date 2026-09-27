import React, { useState } from 'react';
import { useStore, USERS } from '../store';
import { Send, Plus, Link as LinkIcon, X } from 'lucide-react';

export const UI = () => {
  const { currentUser, setCurrentUser, addNote, focusedNoteId, setFocusedNoteId } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');

  if (!currentUser) {
    return (
      <div className="ui-layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26, 31, 46, 0.9)' }}>
        <div className="ui-content" style={{ background: 'white', padding: '40px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 'normal' }}>Who are you?</h1>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {USERS.map(u => (
              <button
                key={u.id}
                onClick={() => setCurrentUser(u)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: `2px solid ${u.color}`,
                  background: 'transparent',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#333',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = `${u.color}33`}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {u.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop: '24px', color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
            This is a closed thought space for K, H, and A. <br/>Thoughts drift, connect, and remain forever.
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    // If we have a focused note, this new note attaches to it
    addNote(text, url, focusedNoteId || undefined);
    
    setText('');
    setUrl('');
    setIsCreating(false);
  };

  return (
    <div className="ui-layer">
      {/* Top Bar */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '32px', height: '32px', borderRadius: '50%', 
          background: currentUser.color, display: 'flex', alignItems: 'center', 
          justifyContent: 'center', fontWeight: 'bold', color: '#333'
        }}>
          {currentUser.name}
        </div>
        <div style={{ color: 'white', opacity: 0.5, fontSize: '14px' }}>Thought Space</div>
      </div>

      {/* Floating Action Button */}
      {!isCreating && (
        <button
          className="ui-content"
          onClick={() => setIsCreating(true)}
          style={{
            position: 'absolute',
            bottom: 40,
            right: 40,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'white',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333'
          }}
        >
          {focusedNoteId ? <LinkIcon size={24} /> : <Plus size={24} />}
        </button>
      )}

      {/* Create Modal overlay */}
      {isCreating && (
        <div className="ui-content" style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: '320px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderTop: `4px solid ${currentUser.color}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', color: '#333' }}>
              {focusedNoteId ? 'Attach a thought' : 'Drop a thought'}
            </div>
            <button 
              onClick={() => setIsCreating(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              autoFocus
              placeholder="What's on your mind?"
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
            <input
              type="url"
              placeholder="URL (optional)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              style={{
                background: '#333',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                cursor: text.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: text.trim() ? 1 : 0.5
              }}
            >
              <Send size={18} />
              {focusedNoteId ? 'Attach' : 'Drop'}
            </button>
          </form>
        </div>
      )}

      {/* Deselect overlay hint */}
      {focusedNoteId && !isCreating && (
        <div 
          className="ui-content"
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          onClick={() => setFocusedNoteId(null)}
        >
          Click to unfocus
        </div>
      )}
    </div>
  );
};
