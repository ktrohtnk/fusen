import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { Note } from './Note';
import { Connections } from './Connections';

export const Scene = () => {
  const notes = useStore(state => state.notes);
  const connections = useStore(state => state.connections);
  const focusedNoteId = useStore(state => state.focusedNoteId);
  const cameraControlsRef = useRef<CameraControls>(null);
  
  // Physics state stored in a mutable ref to avoid React render cycles
  const physicsState = useRef<Record<string, {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    rotation: THREE.Euler;
    angularVelocity: THREE.Euler;
    isDragging: boolean;
  }>>({});

  // Physics Loop
  useFrame((_, delta) => {
    // Cap delta to prevent huge jumps on tab switch
    const dt = Math.min(delta, 0.1);

    const states = Object.values(physicsState.current);
    
    // 1. Calculate forces
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      if (state.isDragging) continue; // Don't apply physics while dragging

      state.acceleration.set(0, 0, 0);

      // Weak center gravity
      const distToCenter = state.position.length();
      if (distToCenter > 0) {
        state.acceleration.addScaledVector(state.position, -0.05 * dt);
      }

      // Repulsion between all notes
      for (let j = 0; j < states.length; j++) {
        if (i === j) continue;
        const other = states[j];
        const diff = new THREE.Vector3().subVectors(state.position, other.position);
        const dist = diff.length();
        if (dist > 0 && dist < 4) {
          state.acceleration.addScaledVector(diff.normalize(), (1 / (dist * dist)) * 0.5 * dt);
        }
      }
    }

    // Attraction between connected notes
    connections.forEach(conn => {
      const stateFrom = physicsState.current[conn.from_note_id];
      const stateTo = physicsState.current[conn.to_note_id];
      if (stateFrom && stateTo) {
        const diff = new THREE.Vector3().subVectors(stateTo.position, stateFrom.position);
        const dist = diff.length();
        if (dist > 2) {
          const force = diff.normalize().multiplyScalar((dist - 2) * 0.5 * dt);
          if (!stateFrom.isDragging) stateFrom.acceleration.add(force);
          if (!stateTo.isDragging) stateTo.acceleration.sub(force); // Equal and opposite
        }
      }
    });

    // 2. Integrate
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      if (state.isDragging) {
        // Just apply heavy damping to velocity while dragging so when let go it has realistic inertia
        state.velocity.multiplyScalar(0.9);
        continue;
      }

      state.velocity.add(state.acceleration);
      // Damping (water-like resistance)
      state.velocity.multiplyScalar(0.98);
      
      state.position.add(state.velocity);

      // Angular physics
      state.rotation.x += state.angularVelocity.x;
      state.rotation.y += state.angularVelocity.y;
      state.rotation.z += state.angularVelocity.z;
      
      // Angular damping
      state.angularVelocity.x *= 0.99;
      state.angularVelocity.y *= 0.99;
      state.angularVelocity.z *= 0.99;
    }
  });

  // Handle Camera Focus
  useEffect(() => {
    if (focusedNoteId && cameraControlsRef.current) {
      const state = physicsState.current[focusedNoteId];
      if (state) {
        const target = state.position;
        // Move camera to look at the note, slightly offset
        const cameraOffset = new THREE.Vector3(0, 0, 5).applyEuler(state.rotation);
        const newCamPos = target.clone().add(cameraOffset);
        
        cameraControlsRef.current.setLookAt(
          newCamPos.x, newCamPos.y, newCamPos.z,
          target.x, target.y, target.z,
          true // smooth transition
        );
      }
    }
  }, [focusedNoteId]);

  return (
    <>
      <color attach="background" args={['#1a1f2e']} />
      {/* Soft lighting for the floating feel */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4466ff" />
      <pointLight position={[0, 10, -10]} intensity={0.5} color="#ff8866" />
      
      <Environment preset="city" opacity={0.1} background={false} />

      <CameraControls 
        ref={cameraControlsRef}
        makeDefault
        minDistance={2}
        maxDistance={50}
        dollySpeed={0.5}
        truckSpeed={0.5}
        polarAngle={Math.PI / 2} // start looking somewhat level
      />

      {notes.map(note => (
        <Note key={note.id} note={note} physicsState={physicsState} />
      ))}

      <Connections physicsState={physicsState} />
    </>
  );
};
