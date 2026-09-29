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
      const parentIsStar = !connections.some(c => c.to_note_id === conn.from_note_id);
      
      if (parentIsStar) {
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
      } else {
        // Zero out the line
        for (let i = 0; i < 6; i++) positions[offset * 6 + i] = 0;
      }
      offset++;
    });
    
    lineGeometry.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeometry.current.attributes.position.needsUpdate = true;
  });

  if (connections.length === 0) return null;

  return (
    <lineSegments geometry={lineGeometry.current}>
      {/* ほんのり光るエネルギーの線（Bloom効果が乗るように明るめに設定） */}
      <lineBasicMaterial color="#ffffff" transparent opacity={0.15} toneMapped={false} />
    </lineSegments>
  );
};

export const SemanticConnections = ({ physicsState, semanticPairs }: { 
  physicsState: ConnectionsProps['physicsState'], 
  semanticPairs: { id1: string, id2: string, strength: number }[] 
}) => {
  const lineGeometry = useRef(new THREE.BufferGeometry());
  const positions = useMemo(() => new Float32Array(semanticPairs.length * 6), [semanticPairs.length]);
  const colors = useMemo(() => new Float32Array(semanticPairs.length * 6), [semanticPairs.length]);
  
  useFrame(() => {
    if (!lineGeometry.current) return;
    
    let offset = 0;
    semanticPairs.forEach(pair => {
      const state1 = physicsState.current[pair.id1];
      const state2 = physicsState.current[pair.id2];
      
      if (state1 && state2 && !isNaN(state1.position.x) && !isNaN(state2.position.x)) {
        positions[offset * 6] = state1.position.x;
        positions[offset * 6 + 1] = state1.position.y;
        positions[offset * 6 + 2] = state1.position.z;
        
        positions[offset * 6 + 3] = state2.position.x;
        positions[offset * 6 + 4] = state2.position.y;
        positions[offset * 6 + 5] = state2.position.z;
        
        // 類似度(strength)が高いほど濃くする
        const alpha = Math.min(0.4, pair.strength * 0.5);
        for(let i=0; i<6; i+=3) {
          colors[offset * 6 + i] = 0.0; // R
          colors[offset * 6 + i + 1] = 1.0; // G
          colors[offset * 6 + i + 2] = 1.0; // B
        }
      } else {
        for(let i=0; i<6; i++) {
           positions[offset * 6 + i] = 0;
           colors[offset * 6 + i] = 0;
        }
      }
      offset++;
    });
    
    lineGeometry.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeometry.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    lineGeometry.current.attributes.position.needsUpdate = true;
    lineGeometry.current.attributes.color.needsUpdate = true;
  });

  if (semanticPairs.length === 0) return null;

  return (
    <lineSegments geometry={lineGeometry.current}>
      {/* 意味的な繋がりはシアンの点線 */}
      <lineDashedMaterial vertexColors transparent opacity={0.3} toneMapped={false} dashSize={0.2} gapSize={0.2} />
    </lineSegments>
  );
};
