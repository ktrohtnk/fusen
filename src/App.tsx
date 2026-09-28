import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { UI } from './components/UI';
import { useStore } from './store';

function App() {
  const fetchInitialData = useStore(state => state.fetchInitialData);

  useEffect(() => {
    fetchInitialData();
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
