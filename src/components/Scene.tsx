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

    const statesEntries = Object.entries(physicsState.current);
    
    // Helper to check if a note is a satellite (child)
    const isSatellite = (id: string) => connections.some(c => c.to_note_id === id);

    // 1. Calculate forces
    for (let i = 0; i < statesEntries.length; i++) {
      const [idI, state] = statesEntries[i];
      if (state.isDragging) continue;

      state.acceleration.set(0, 0, 0);

      // Add smooth drifting force (using sine waves over time)
      const time = Date.now() * 0.001;
      // Use part of the ID to give each note a unique phase offset so they don't all drift the exact same way
      const idHash = parseInt(idI.substring(0, 4), 16); 
      
      state.acceleration.x += Math.sin(time * 0.5 + idHash) * 0.001 * dt;
      state.acceleration.y += Math.cos(time * 0.4 + idHash) * 0.001 * dt;
      state.acceleration.z += Math.sin(time * 0.3 + idHash) * 0.001 * dt;

      // Very weak center gravity so they don't fly away forever
      const distToCenter = state.position.length();
      if (distToCenter > 0) {
        state.acceleration.addScaledVector(state.position, -0.005 * dt);
      }

      const isStarI = !isSatellite(idI);

      // Repulsion between notes
      for (let j = 0; j < statesEntries.length; j++) {
        if (i === j) continue;
        const [idJ, other] = statesEntries[j];
        const isStarJ = !isSatellite(idJ);

        const diff = new THREE.Vector3().subVectors(state.position, other.position);
        const dist = diff.length();
        
        let repulseRadius = 2.5;
        let repulseForce = 0.2;

        if (isStarI && isStarJ) {
          repulseRadius = 12.0; 
          repulseForce = 1.0;
        } else if (!isStarI && !isStarJ) {
          repulseRadius = 1.5;
          repulseForce = 0.1;
        }

        if (dist > 0 && dist < repulseRadius) {
          state.acceleration.addScaledVector(diff.normalize(), (1 / (dist * dist)) * repulseForce * dt);
        }
      }
    }

    // Orbit attraction for connected notes (child orbits parent)
    connections.forEach(conn => {
      const stateFrom = physicsState.current[conn.from_note_id]; // Parent
      const stateTo = physicsState.current[conn.to_note_id];     // Child
      if (stateFrom && stateTo) {
        const diff = new THREE.Vector3().subVectors(stateTo.position, stateFrom.position);
        const dist = diff.length();
        
        // 1. Radial spring (pull to orbit radius of ~2.5)
        const targetDist = 2.5;
        if (dist > 0.1) {
          const radialForce = diff.clone().normalize().multiplyScalar((targetDist - dist) * 0.5 * dt);
          if (!stateTo.isDragging) stateTo.acceleration.add(radialForce);
          // Parent doesn't get pulled as much by satellite
          if (!stateFrom.isDragging) stateFrom.acceleration.sub(radialForce.multiplyScalar(0.05));
        }

        // 2. Tangential force (orbiting motion)
        const up = new THREE.Vector3(0, 1, 0);
        let tangent = new THREE.Vector3().crossVectors(diff, up).normalize();
        if (tangent.lengthSq() < 0.001) tangent = new THREE.Vector3(1, 0, 0); 
        
        // Push child along the tangent to create orbit
        if (!stateTo.isDragging) {
          // Set to 0.008: fast enough to overcome Brownian motion, but slow enough to be readable (approx 20s orbit)
          stateTo.acceleration.add(tangent.multiplyScalar(0.008 * dt));
        }
      }
    });

    // 2. Integrate
    for (let i = 0; i < statesEntries.length; i++) {
      const [_, state] = statesEntries[i];
      if (state.isDragging) {
        state.velocity.multiplyScalar(0.9);
        continue;
      }

      state.velocity.add(state.acceleration);
      // Less damping to allow more floating
      state.velocity.multiplyScalar(0.99);
      
      state.position.add(state.velocity);

      // Keep upright: Force rotation.x and rotation.z to 0
      state.rotation.x = 0;
      state.rotation.z = 0;
      
      // Let it slowly drift in Y (yaw) to face different ways gently
      state.rotation.y += state.angularVelocity.y;
      state.angularVelocity.y *= 0.99;
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
        mouseButtons={{
          left: 2, // ACTION.TRUCK (pan)
          right: 1, // ACTION.ROTATE
          middle: 8, // ACTION.DOLLY
          wheel: 8, // ACTION.DOLLY
        }}
        touches={{
          one: 2, // ACTION.TOUCH_TRUCK (pan)
          two: 256 | 8, // ACTION.TOUCH_DOLLY_TRUCK (or similar, 256 is TOUCH_DOLLY_ROTATE often)
          three: 0
        }}
      />

      {notes.map(note => (
        <Note key={note.id} note={note} physicsState={physicsState} />
      ))}

    </>
  );
};
