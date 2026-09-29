import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { UI } from './components/UI';
import { useStore } from './store';
import { supabase } from './supabase';

import { ErrorBoundary } from './ErrorBoundary';

function App() {
  const fetchInitialData = useStore(state => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();

    if (!supabase) return;
    const channel = supabase.channel('public:notes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'notes' }, () => {
        useStore.getState().fetchInitialData();
      })
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'connections' }, () => {
        useStore.getState().fetchInitialData();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  return (
    <ErrorBoundary>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <Canvas onPointerMissed={() => useStore.getState().setFocusedNoteId(null)}>
          <Scene />
        </Canvas>
        <UI />
      </div>
    </ErrorBoundary>
  );
}

export default App;
