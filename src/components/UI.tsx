import React, { useState, useRef } from 'react';
import { useStore, USERS } from '../store';
import { Send, Plus, Link as LinkIcon, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../supabase';

export const UI = () => {
  const { currentUser, setCurrentUser, addNote, focusedNoteId, setFocusedNoteId, notes, connections } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // すべての思考（恒星も衛星も）を取得し、古い順（最新が下）にソート
  const timelineNotes = [...notes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!currentUser) {
    return (
      <div className="ui-layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%231a1f2e\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'2\'/%3E%3C/g%3E%3C/svg%3E"), #0a0f1a' }}>
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
              <button
                key={u.id}
                onClick={() => setCurrentUser(u)}
                style={{
                  width: '64px',
                  height: '64px',
                  border: `4px solid ${u.color}`,
                  background: '#000',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: u.color,
                  boxShadow: `4px 4px 0px ${u.color}50`,
                  transition: 'none',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = u.color;
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.transform = 'translate(2px, 2px)';
                  e.currentTarget.style.boxShadow = `2px 2px 0px ${u.color}50`;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#000';
                  e.currentTarget.style.color = u.color;
                  e.currentTarget.style.transform = 'translate(0px, 0px)';
                  e.currentTarget.style.boxShadow = `4px 4px 0px ${u.color}50`;
                }}
              >
                {u.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop: '40px', color: '#888', fontSize: '12px', lineHeight: '1.8', letterSpacing: '1px' }}>
            THIS IS A CLOSED SPACE FUSEN FOR A, B, C, D, E, AND F.<br/>
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

    // If we have a focused note, this new note attaches to it
    addNote(text, url, focusedNoteId || undefined, imageUrl || undefined);
    
    setText('');
    setUrl('');
    setSelectedImage(null);
    setIsUploading(false);
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
        <div style={{ color: 'white', opacity: 0.8, fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px' }}>FUSEN</div>
      </div>

      {/* わかりやすいフォーカス解除（戻る）ボタン */}
      {focusedNoteId && !isCreating && (
        <button
          className="ui-content"
          onClick={() => setFocusedNoteId(null)}
          style={{
            position: 'absolute',
            top: 70,
            left: 20,
            background: '#0a0f1a',
            color: '#0ff',
            border: '2px solid #0ff',
            boxShadow: '4px 4px 0px rgba(0,255,255,0.5)',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            textTransform: 'uppercase',
            zIndex: 10
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#0ff';
            e.currentTarget.style.color = '#000';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#0a0f1a';
            e.currentTarget.style.color = '#0ff';
          }}
        >
          ← CANCEL FOCUS
        </button>
      )}

      {/* タイムライン */}
      <div 
        className="ui-content"
        style={{ 
          position: 'absolute', 
          top: focusedNoteId ? 120 : 80, 
          left: 20, 
          bottom: 40,
          width: '240px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingRight: '10px'
        }}
      >
        <div style={{ color: '#0ff', fontSize: '14px', marginBottom: '8px', textShadow: '2px 2px 0px #f0f' }}>[ TIMELINE ]</div>
        {timelineNotes.map(note => {
          const u = USERS.find(u => u.id === note.user_id) || USERS[0];
          const isChild = connections.some(c => c.to_note_id === note.id);

          return (
            <div 
              key={note.id}
              onClick={() => setFocusedNoteId(note.id)}
              style={{
                background: focusedNoteId === note.id ? u.color : '#0a0f1a',
                color: focusedNoteId === note.id ? '#000' : '#fff',
                padding: '12px',
                cursor: 'pointer',
                border: `2px solid ${u.color}`,
                boxShadow: `4px 4px 0px ${u.color}50`,
                marginLeft: isChild ? '24px' : '0px',
                opacity: isChild ? 0.85 : 1,
              }}
              onMouseOver={(e) => {
                if (focusedNoteId !== note.id) {
                  e.currentTarget.style.background = `${u.color}33`;
                }
              }}
              onMouseOut={(e) => {
                if (focusedNoteId !== note.id) {
                  e.currentTarget.style.background = '#0a0f1a';
                }
              }}
            >
              <div style={{ color: focusedNoteId === note.id ? '#000' : '#aaa', fontSize: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {isChild ? '↳ SAT ' : '● STAR '}
                  <span style={{ marginLeft: '4px' }}>
                    {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </div>
              <div style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.text || (note.image_url ? '[IMAGE]' : (isChild ? 'NO_DATA' : 'NO_DATA'))}
              </div>
            </div>
          );
        })}
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
            width: '64px',
            height: '64px',
            background: '#0a0f1a',
            border: `4px solid ${currentUser.color}`,
            boxShadow: `6px 6px 0px ${currentUser.color}50`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: currentUser.color,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = currentUser.color;
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.transform = 'translate(2px, 2px)';
            e.currentTarget.style.boxShadow = `4px 4px 0px ${currentUser.color}50`;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#0a0f1a';
            e.currentTarget.style.color = currentUser.color;
            e.currentTarget.style.transform = 'translate(0px, 0px)';
            e.currentTarget.style.boxShadow = `6px 6px 0px ${currentUser.color}50`;
          }}
        >
          {focusedNoteId ? <LinkIcon size={28} /> : <Plus size={28} />}
        </button>
      )}

      {/* Create Modal overlay */}
      {isCreating && (
        <div className="ui-content" style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: '320px',
          background: '#0a0f1a',
          padding: '20px',
          boxShadow: `8px 8px 0px ${currentUser.color}50`,
          border: `4px solid ${currentUser.color}`,
          color: '#e0e0e0',
          fontFamily: 'inherit'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', color: currentUser.color, letterSpacing: '2px', textShadow: '2px 2px 0px #000' }}>
              {focusedNoteId ? 'ATTACH SIGNAL' : 'DROP SIGNAL'}
            </div>
            <button 
              onClick={() => {
                setIsCreating(false);
                setSelectedImage(null);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ff', fontSize: '16px' }}
            >
              [X]
            </button>
          </div>
          
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              autoFocus
              placeholder="Transmit your thought..."
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: `2px solid ${currentUser.color}`,
                background: '#000',
                color: '#fff',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '12px'
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
                border: `2px solid ${currentUser.color}`,
                background: '#000',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '12px'
              }}
            />
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedImage(e.target.files[0]);
                }
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: selectedImage ? currentUser.color : '#f0f0f0',
                  border: '1px solid #ddd',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: '#333'
                }}
              >
                <ImageIcon size={18} style={{ marginRight: '4px' }} />
                {selectedImage ? 'Image Selected' : 'Add Image'}
              </button>
              
              <button
                type="submit"
                disabled={(!text.trim() && !selectedImage) || isUploading}
                style={{
                  background: '#333',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: (!text.trim() && !selectedImage) || isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  flex: 2,
                  opacity: (!text.trim() && !selectedImage) || isUploading ? 0.5 : 1
                }}
              >
                {isUploading ? 'Uploading...' : (
                  <>
                    <Send size={18} />
                    {focusedNoteId ? 'Attach' : 'Drop'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
