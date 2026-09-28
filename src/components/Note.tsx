import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Image as DreiImage } from '@react-three/drei';
import * as THREE from 'three';
import { NoteData, useStore, USERS } from '../store';
import { useDrag } from '@use-gesture/react';

interface NoteProps {
  note: NoteData;
  physicsState: React.MutableRefObject<Record<string, {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    rotation: THREE.Euler;
    angularVelocity: THREE.Euler;
    isDragging: boolean;
  }>>;
}

export const Note = ({ note, physicsState }: NoteProps) => {
  const meshRef = useRef<THREE.Group>(null);
  const { size, camera } = useThree();
  const setFocusedNoteId = useStore((state) => state.setFocusedNoteId);
  const focusedNoteId = useStore((state) => state.focusedNoteId);
  const syncNotePosition = useStore((state) => state.syncNotePosition);
  const connections = useStore((state) => state.connections);
  
  const user = USERS.find(u => u.id === note.user_id) || USERS[0];
  const isFocused = focusedNoteId === note.id;

  // Determine if this is a child note (attached to something)
  const isChild = useMemo(() => connections.some(c => c.to_note_id === note.id), [connections, note.id]);
  
  // サイズ（恒星は大きく、衛星は小さく四角く）
  const width = isChild ? 1.0 : 2.0;
  const height = isChild ? 0.8 : 1.5;

  // 色の違い（衛星は同一色相で少し暗く/濃くする）
  const baseColor = useMemo(() => new THREE.Color(user.color), [user.color]);
  const displayColor = useMemo(() => {
    return isChild ? baseColor.clone().multiplyScalar(0.8) : baseColor;
  }, [baseColor, isChild]);

  if (!physicsState.current[note.id]) {
    physicsState.current[note.id] = {
      position: note.position.clone(),
      velocity: note.velocity.clone(),
      acceleration: note.acceleration.clone(),
      rotation: note.rotation.clone(),
      angularVelocity: note.angularVelocity.clone(),
      isDragging: false,
    };
  }

  useFrame(() => {
    if (meshRef.current && physicsState.current[note.id]) {
      const state = physicsState.current[note.id];
      meshRef.current.position.copy(state.position);
      
      // 文字が常に読みやすいように、常にカメラの方を向かせる（ビルボード化）
      meshRef.current.lookAt(camera.position);
    }
  });

  const bind = useDrag(({ active, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], event }) => {
    event.stopPropagation();
    
    const state = physicsState.current[note.id];
    if (!state) return;

    state.isDragging = active;

    if (active) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      
      state.velocity.add(right.multiplyScalar(dx * vx * 0.005));
      state.velocity.add(up.multiplyScalar(-dy * vy * 0.005));
    } else {
      syncNotePosition(note.id, state.position, state.rotation);
    }
  }, { pointerEvents: true });

  const age = (Date.now() - new Date(note.created_at).getTime()) / 1000;
  const isNew = age < 60; 

  return (
    <group 
      ref={meshRef} 
      {...bind() as any}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedNoteId(isFocused ? null : note.id);
      }}
    >
      <mesh receiveShadow castShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial 
          color={displayColor} 
          roughness={0.8}
          emissive={isNew ? displayColor.clone().multiplyScalar(0.5) : "#000000"}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {note.image_url && (
        <DreiImage 
          url={note.image_url} 
          position={[0, note.text ? 0.3 : 0, 0.01]} 
          scale={[width * 0.8, height * 0.5]} 
          transparent 
          opacity={0.9} 
        />
      )}

      {note.text && (
        <>
          <Text
            position={[0, note.image_url ? -height * 0.25 : 0, 0.02]}
            color="#333333"
            fontSize={isChild ? 0.1 : 0.15}
            maxWidth={width * 0.8}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {note.text}
          </Text>
        </>
      )}

      {isFocused && (
        <Html position={[width / 2 + 0.2, -height / 2 + 0.2, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            borderLeft: `4px solid ${user.color}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{user.name}</div>
              <div style={{ color: '#666', fontSize: '10px', margin: '4px 0' }}>
                {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString()}
              </div>
            </div>
            
            {note.url && (
              <div>
                <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'none' }}>
                  {note.url}
                </a>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('この思考（惑星）を完全に消滅させますか？')) {
                  useStore.getState().deleteNote(note.id);
                }
              }}
              style={{
                marginTop: '4px',
                padding: '4px 8px',
                background: '#ffeeee',
                color: '#cc0000',
                border: '1px solid #ffcccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            >
              💥 惑星を消滅させる
            </button>
          </div>
        </Html>
      )}
    </group>
  );
};
