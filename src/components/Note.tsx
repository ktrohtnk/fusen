import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
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
  
  const user = USERS.find(u => u.id === note.user_id) || USERS[0];
  const isFocused = focusedNoteId === note.id;

  // Initialize physics state for this note if not exists
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

  // Update mesh position/rotation from physics state every frame
  useFrame(() => {
    if (meshRef.current && physicsState.current[note.id]) {
      const state = physicsState.current[note.id];
      meshRef.current.position.copy(state.position);
      meshRef.current.rotation.copy(state.rotation);
      
      // Look at camera gently if not dragging? No, prompt says they drift and rotate.
    }
  });

  const bind = useDrag(({ active, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], event }) => {
    event.stopPropagation();
    
    const state = physicsState.current[note.id];
    if (!state) return;

    state.isDragging = active;

    if (active) {
      // While dragging, map 2d mouse movement to 3d velocity/position
      // Simple approximation: move parallel to view plane
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      
      // Calculate delta position based on screen movement
      const moveX = mx * 0.01;
      const moveY = -my * 0.01;
      
      // Update velocity directly to allow throwing (inertia)
      state.velocity.add(right.multiplyScalar(dx * vx * 0.005));
      state.velocity.add(up.multiplyScalar(-dy * vy * 0.005));
    } else {
      // On release, sync to DB
      syncNotePosition(note.id, state.position, state.rotation);
    }
  }, { pointerEvents: true });

  // Calculate age for opacity/brightness
  const age = (Date.now() - new Date(note.created_at).getTime()) / 1000;
  const isNew = age < 60; // Less than a minute

  return (
    <group 
      ref={meshRef} 
      {...bind() as any}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedNoteId(isFocused ? null : note.id);
      }}
    >
      {/* The paper piece */}
      <mesh receiveShadow castShadow>
        <planeGeometry args={[2, 1.5]} />
        <meshStandardMaterial 
          color="#faf9f6" 
          roughness={0.8}
          emissive={isNew ? new THREE.Color(user.color).multiplyScalar(0.2) : "#000000"}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* User color accent (e.g. thin line at top) */}
      <mesh position={[0, 0.73, 0.01]}>
        <planeGeometry args={[2, 0.04]} />
        <meshBasicMaterial color={user.color} />
      </mesh>
      <mesh position={[0, 0.73, -0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2, 0.04]} />
        <meshBasicMaterial color={user.color} />
      </mesh>

      {/* Text Content */}
      <Text
        position={[0, 0, 0.02]}
        color="#333333"
        fontSize={0.15}
        maxWidth={1.8}
        textAlign="left"
        anchorX="center"
        anchorY="middle"
      >
        {note.text}
      </Text>
      
      <Text
        position={[0, 0, -0.02]}
        rotation={[0, Math.PI, 0]}
        color="#333333"
        fontSize={0.15}
        maxWidth={1.8}
        textAlign="left"
        anchorX="center"
        anchorY="middle"
      >
        {note.text}
      </Text>

      {/* Meta info visible when focused */}
      {isFocused && (
        <Html position={[1.1, -0.8, 0]} center>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            borderLeft: `4px solid ${user.color}`
          }}>
            <div>{user.name}</div>
            <div style={{ color: '#666', fontSize: '10px' }}>
              {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString()}
            </div>
            {note.url && (
              <div style={{ marginTop: '4px' }}>
                <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', pointerEvents: 'auto' }}>
                  {note.url}
                </a>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};
