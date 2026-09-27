import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';

interface ConnectionsProps {
  physicsState: React.MutableRefObject<Record<string, {
    position: THREE.Vector3;
    // ... other properties
  }>>;
}

export const Connections = ({ physicsState }: ConnectionsProps) => {
  const connections = useStore(state => state.connections);
  const notes = useStore(state => state.notes);
  
  const lineGeometry = useRef(new THREE.BufferGeometry());
  
  // Create an array of positions for the lines (2 points per connection)
  const positions = useMemo(() => new Float32Array(connections.length * 6), [connections.length]);
  
  useFrame(() => {
    if (!lineGeometry.current) return;
    
    let offset = 0;
    connections.forEach(conn => {
      const stateFrom = physicsState.current[conn.from_note_id];
      const stateTo = physicsState.current[conn.to_note_id];
      
      if (stateFrom && stateTo) {
        positions[offset * 6] = stateFrom.position.x;
        positions[offset * 6 + 1] = stateFrom.position.y;
        positions[offset * 6 + 2] = stateFrom.position.z;
        
        positions[offset * 6 + 3] = stateTo.position.x;
        positions[offset * 6 + 4] = stateTo.position.y;
        positions[offset * 6 + 5] = stateTo.position.z;
      }
      offset++;
    });
    
    lineGeometry.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeometry.current.attributes.position.needsUpdate = true;
  });

  if (connections.length === 0) return null;

  return (
    <lineSegments geometry={lineGeometry.current}>
      <lineBasicMaterial color="#cccccc" transparent opacity={0.3} linewidth={1} />
    </lineSegments>
  );
};
