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

  // 恒星（親ノート）のリストを取得し、古い順（最新が下）にソート
  const stars = notes
    .filter(n => !connections.some(c => c.to_note_id === n.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
        <div style={{ color: 'white', opacity: 0.5, fontSize: '14px' }}>Thought Space</div>
      </div>

      {/* 恒星（Stars）のリスト（タイムライン風） */}
      <div 
        className="ui-content"
        style={{ 
          position: 'absolute', 
          top: 80, 
          left: 20, 
          bottom: 40,
          width: '240px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingRight: '10px'
        }}
      >
        <div style={{ color: '#fff', opacity: 0.5, fontSize: '12px', marginBottom: '8px' }}>STARS (恒星)</div>
        {stars.map(star => {
          const u = USERS.find(u => u.id === star.user_id) || USERS[0];
          return (
            <div 
              key={star.id}
              onClick={() => setFocusedNoteId(star.id)}
              style={{
                background: focusedNoteId === star.id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                borderLeft: `4px solid ${u.color}`,
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.background = focusedNoteId === star.id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}
            >
              <div style={{ color: '#aaa', fontSize: '10px', marginBottom: '4px' }}>
                {new Date(star.created_at).toLocaleDateString()}
              </div>
              <div style={{ color: '#fff', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {star.text || (star.image_url ? '[画像]' : '無題の恒星')}
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
              onClick={() => {
                setIsCreating(false);
                setSelectedImage(null);
              }}
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
