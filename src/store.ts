import { create } from 'zustand';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

export type User = {
  id: string;
  name: string;
  color: string;
};

export const USERS: User[] = [
  { id: 'user-k', name: 'K', color: '#88ccff' },
  { id: 'user-h', name: 'H', color: '#ffbbaa' },
  { id: 'user-a', name: 'A', color: '#aaddaa' },
];

export type NoteData = {
  id: string;
  user_id: string;
  text: string;
  url: string | null;
  image_url: string | null;
  created_at: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  rotation: THREE.Euler;
  angularVelocity: THREE.Euler;
};

export type ConnectionData = {
  id: string;
  from_note_id: string;
  to_note_id: string;
};

interface AppState {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  notes: NoteData[];
  connections: ConnectionData[];
  focusedNoteId: string | null;
  setFocusedNoteId: (id: string | null) => void;
  addNote: (text: string, url?: string, parentId?: string, image_url?: string) => void;
  updateNotePhysics: (id: string, position: THREE.Vector3, velocity: THREE.Vector3, rotation: THREE.Euler, angularVelocity: THREE.Euler) => void;
  syncNotePosition: (id: string, position: THREE.Vector3, rotation: THREE.Euler) => void;
  deleteNote: (id: string) => Promise<void>;
  fetchInitialData: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  notes: [],
  connections: [],
  focusedNoteId: null,
  setFocusedNoteId: (id) => set({ focusedNoteId: id }),

  deleteNote: async (id) => {
    // 楽観的UI更新（すぐに画面から消す）
    set((state) => ({
      notes: state.notes.filter(n => n.id !== id),
      connections: state.connections.filter(c => c.from_note_id !== id && c.to_note_id !== id),
      focusedNoteId: state.focusedNoteId === id ? null : state.focusedNoteId
    }));

    if (supabase) {
      try {
        // 関連する接続を先に削除
        await supabase.from('connections').delete().or(`from_note_id.eq.${id},to_note_id.eq.${id}`);
        // ノート本体を削除
        await supabase.from('notes').delete().eq('id', id);
      } catch (e) {
        console.error("Failed to delete from supabase", e);
      }
    }
  },

  addNote: async (text, url, parentId, image_url) => {
    const { currentUser, notes, focusedNoteId } = get();
    if (!currentUser) return;

    // Determine initial position
    let startPos = new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    
    // If attached to a parent, start near the parent
    const targetParentId = parentId || focusedNoteId;
    if (targetParentId) {
      const parentNote = notes.find(n => n.id === targetParentId);
      if (parentNote) {
        startPos = parentNote.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
      }
    }

    const newNote: NoteData = {
      id: uuidv4(),
      user_id: currentUser.id,
      text,
      url: url || null,
      image_url: image_url || null,
      created_at: new Date().toISOString(),
      position: startPos,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02),
      acceleration: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, Math.random() * Math.PI, 0),
      angularVelocity: new THREE.Euler(0, (Math.random() - 0.5) * 0.01, 0)
    };

    set((state) => ({ notes: [...state.notes, newNote] }));

    let newConn = null;
    if (targetParentId) {
      newConn = {
        id: uuidv4(),
        from_note_id: targetParentId,
        to_note_id: newNote.id
      };
      set((state) => ({ connections: [...state.connections, newConn] }));
    }

    // Save to Supabase (if configured)
    if (supabase) {
      try {
        const { error: noteError } = await supabase.from('notes').insert({
          id: newNote.id,
          user_id: newNote.user_id,
          text: newNote.text,
          url: newNote.url,
          image_url: newNote.image_url,
          created_at: newNote.created_at,
          x: newNote.position.x,
          y: newNote.position.y,
          z: newNote.position.z,
          rotation_x: newNote.rotation.x,
          rotation_y: newNote.rotation.y,
          rotation_z: newNote.rotation.z,
        });
        
        if (noteError) console.error("Note insert error:", noteError);

        if (newConn) {
          const { error: connError } = await supabase.from('connections').insert({
            id: newConn.id,
            from_note_id: newConn.from_note_id,
            to_note_id: newConn.to_note_id
          });
          if (connError) console.error("Connection insert error:", connError);
        }
      } catch (e) {
        console.error("Failed to save to supabase", e);
      }
    }
  },

  updateNotePhysics: (id, position, velocity, rotation, angularVelocity) => {
    set((state) => ({
      notes: state.notes.map(n => 
        n.id === id ? { ...n, position, velocity, rotation, angularVelocity } : n
      )
    }));
  },

  syncNotePosition: async (id, position, rotation) => {
    if (supabase) {
      try {
        await supabase.from('notes').update({
          x: position.x,
          y: position.y,
          z: position.z,
          rotation_x: rotation.x,
          rotation_y: rotation.y,
          rotation_z: rotation.z,
        }).eq('id', id);
      } catch (e) {
        console.error("Failed to sync position to supabase", e);
      }
    }
  },

  fetchInitialData: async () => {
    if (!supabase) return;
    try {
      const { data: notesData, error: notesError } = await supabase.from('notes').select('*');
      const { data: connData, error: connError } = await supabase.from('connections').select('*');
      
      if (notesError) console.error("Fetch notes error:", notesError);
      if (connError) console.error("Fetch connections error:", connError);

      if (notesData) {
        const loadedNotes = notesData.map(n => ({
          id: n.id,
          user_id: n.user_id,
          text: n.text,
          url: n.url,
          image_url: n.image_url,
          created_at: n.created_at,
          position: new THREE.Vector3(n.x, n.y, n.z),
          velocity: new THREE.Vector3(0, 0, 0),
          acceleration: new THREE.Vector3(0, 0, 0),
          rotation: new THREE.Euler(n.rotation_x, n.rotation_y, n.rotation_z),
          angularVelocity: new THREE.Euler(0, 0, 0)
        }));
        set({ notes: loadedNotes });
      }

      if (connData) {
        set({ connections: connData as ConnectionData[] });
      }
    } catch (e) {
      console.error("Failed to fetch initial data", e);
    }
  }
}));
