import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Pixelation } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';
import { Note } from './Note';
import { Connections } from './Connections';

export const Scene = () => {
  const notes = useStore(state => state.notes);
  const connections = useStore(state => state.connections);
  const focusedNoteId = useStore(state => state.focusedNoteId);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  
  const physicsState = useRef<Record<string, {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    rotation: THREE.Euler;
    angularVelocity: THREE.Euler;
    isDragging: boolean;
  }>>({});

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const statesEntries = Object.entries(physicsState.current);
    const isSatellite = (id: string) => connections.some(c => c.to_note_id === id);

    for (let i = 0; i < statesEntries.length; i++) {
      const [idI, noteState] = statesEntries[i];
      if (noteState.isDragging) continue;

      noteState.acceleration.set(0, 0, 0);

      const time = Date.now() * 0.001;
      const idHash = parseInt(idI.substring(0, 4), 16); 
      
      noteState.acceleration.x += Math.sin(time * 0.5 + idHash) * 0.001 * dt;
      noteState.acceleration.y += Math.cos(time * 0.4 + idHash) * 0.001 * dt;
      noteState.acceleration.z += Math.sin(time * 0.3 + idHash) * 0.001 * dt;

      const distToCenter = noteState.position.length();
      if (distToCenter > 0) {
        noteState.acceleration.addScaledVector(noteState.position, -0.005 * dt);
      }

      const isStarI = !isSatellite(idI);

      for (let j = 0; j < statesEntries.length; j++) {
        if (i === j) continue;
        const [idJ, other] = statesEntries[j];
        const isStarJ = !isSatellite(idJ);

        const diff = new THREE.Vector3().subVectors(noteState.position, other.position);
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
          noteState.acceleration.addScaledVector(diff.normalize(), (1 / (dist * dist)) * repulseForce * dt);
        }
      }
    }

    connections.forEach(conn => {
      const parentIsStar = !isSatellite(conn.from_note_id);
      const stateFrom = physicsState.current[conn.from_note_id];
      const stateTo = physicsState.current[conn.to_note_id];
      if (stateFrom && stateTo) {
        if (parentIsStar) {
          const diff = new THREE.Vector3().subVectors(stateTo.position, stateFrom.position);
          const dist = diff.length();
          
          const targetDist = 2.5;
          if (dist > 0.1) {
            const radialForce = diff.clone().normalize().multiplyScalar((targetDist - dist) * 0.5 * dt);
            if (!stateTo.isDragging) stateTo.acceleration.add(radialForce);
            if (!stateFrom.isDragging) stateFrom.acceleration.sub(radialForce.multiplyScalar(0.05));
          }

          const up = new THREE.Vector3(0, 1, 0);
          let tangent = new THREE.Vector3().crossVectors(diff, up).normalize();
          if (tangent.lengthSq() < 0.001) tangent = new THREE.Vector3(1, 0, 0); 
          
          if (!stateTo.isDragging) {
            stateTo.acceleration.add(tangent.multiplyScalar(0.02 * dt));
          }
        } else {
          // 衛星の衛星：親の下に連なるように固定する（回転せず、重なる）
          // クリックを阻害しないように、親より少し奥(-0.1)に配置する
          const targetPos = stateFrom.position.clone().add(new THREE.Vector3(0.1, -0.4, -0.1));
          const diffToTarget = new THREE.Vector3().subVectors(targetPos, stateTo.position);
          
          if (!stateTo.isDragging) {
            stateTo.acceleration.add(diffToTarget.multiplyScalar(10.0 * dt)); // 強めに引っ張る
            stateTo.velocity.multiplyScalar(0.8); // 動きを抑えてピタッとくっつける
          }
        }
      }
    });

    for (let i = 0; i < statesEntries.length; i++) {
      const [_, noteState] = statesEntries[i];
      if (noteState.isDragging) {
        noteState.velocity.multiplyScalar(0.9);
        continue;
      }

      noteState.velocity.add(noteState.acceleration);
      noteState.velocity.multiplyScalar(0.99);
      noteState.position.add(noteState.velocity);
      
      noteState.rotation.x = 0;
      noteState.rotation.z = 0;
      noteState.rotation.y += noteState.angularVelocity.y;
      noteState.angularVelocity.y *= 0.99;
    }

    if (focusedNoteId && physicsState.current[focusedNoteId]) {
      const targetPos = physicsState.current[focusedNoteId].position;
      const cameraTargetPos = targetPos.clone().add(new THREE.Vector3(0, 0, 2.5));
      
      state.camera.position.lerp(cameraTargetPos, 0.15);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetPos, 0.15);
      }
    }
  });

  return (
    <>
      <color attach="background" args={['#1a1f2e']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4466ff" />
      <pointLight position={[0, 10, -10]} intensity={0.5} color="#ff8866" />
      
      <Environment preset="city" opacity={0.1} background={false} />

      <OrbitControls 
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.015} // 0.05 -> 0.015 に変更して、氷の上を滑るような強い慣性にする
        minDistance={2}
        maxDistance={50}
        panSpeed={2.0}
        zoomSpeed={2.0}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN, // 左クリックで上下左右に自由にパン
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE
        }}
      />

      <Connections physicsState={physicsState} />
      
      {/* 宇宙のチリや星屑（奥行き可視化） */}
      <Stars radius={100} depth={50} count={3000} factor={3} saturation={0.5} fade speed={1} />
      <Sparkles count={400} scale={40} size={8} speed={0.2} opacity={0.3} color="#0ff" />

      {notes.map(note => (
        <Note key={note.id} note={note} physicsState={physicsState} />
      ))}

      <EffectComposer disableNormalPass>
        <Pixelation granularity={2} />
        <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.9} height={300} intensity={0.6} />
      </EffectComposer>
    </>
  );
};
