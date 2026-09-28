import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { UI } from './components/UI';
import { useStore } from './store';
import { supabase } from './supabase';

function App() {
  const fetchInitialData = useStore(state => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
    
    // リアルタイムサブスクリプション
    if (!supabase) return;
    // @ts-ignore
    const channel = supabase.channel('public:notes')
      // @ts-ignore
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        fetchInitialData();
      })
      // @ts-ignore
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
        fetchInitialData();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas onPointerMissed={() => useStore.getState().setFocusedNoteId(null)}>
        <Scene />
      </Canvas>
      <UI />
    </div>
  );
}

export default App;
