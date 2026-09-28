import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { UI } from './components/UI';
import { useStore } from './store';

function App() {
  const fetchInitialData = useStore(state => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
    
    // リアルタイムサブスクリプションを追加
    import('./supabase').then(({ supabase }) => {
      if (!supabase) return;
      const channel = supabase.channel('public:notes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
          fetchInitialData(); // 誰かが星を作ったり消したりしたら即座に再取得
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
          fetchInitialData();
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    });
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
