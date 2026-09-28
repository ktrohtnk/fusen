import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Image as DreiImage, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { NoteData, useStore, USERS } from '../store';
import { useDrag } from '@use-gesture/react';

const createNeonGradient = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');      
  gradient.addColorStop(0.87, 'rgba(255,255,255,0)');   // 縁の直前まで完全に透明
  gradient.addColorStop(0.93, 'rgba(255,255,255,0.7)'); // 縁の部分だけで「ふんわり」光る（パキッとさせない）
  gradient.addColorStop(1, 'rgba(255,255,255,0)');      // すぐに柔らかく消える
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

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
  const glowRef = useRef<THREE.Mesh>(null);
  const { size, camera } = useThree();
  const setFocusedNoteId = useStore((state) => state.setFocusedNoteId);
  const focusedNoteId = useStore((state) => state.focusedNoteId);
  const syncNotePosition = useStore((state) => state.syncNotePosition);
  const connections = useStore((state) => state.connections);
  
  const neonTexture = useMemo(() => createNeonGradient(), []);
  const timeOffset = useRef(Math.random() * 100);

  const user = USERS.find(u => u.id === note.user_id) || USERS[0];
  const isFocused = focusedNoteId === note.id;

  const isChild = useMemo(() => connections.some(c => c.to_note_id === note.id), [connections, note.id]);
  
  const width = isChild ? 1.0 : 2.0;
  const height = isChild ? 0.8 : 1.5;

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

  useFrame((state) => {
    if (meshRef.current && physicsState.current[note.id]) {
      const pState = physicsState.current[note.id];
      meshRef.current.position.copy(pState.position);
      meshRef.current.lookAt(camera.position);
    }
    
    if (glowRef.current && !isChild) {
      const pulse = (Math.sin(state.clock.elapsedTime * 1.5 + timeOffset.current) + 1) / 2;
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      
      const intensity = 1.2 + pulse * 0.8;
      material.color.copy(displayColor).multiplyScalar(intensity);
      material.opacity = 0.9;
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
        {isChild ? (
          <planeGeometry args={[width, height]} />
        ) : (
          <circleGeometry args={[1.2, 64]} />
        )}
        <meshStandardMaterial 
          color={displayColor} 
          roughness={0.8}
          emissive={isChild ? displayColor : "#000000"} 
          emissiveIntensity={isChild ? 0.4 : 0.0}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* グラデーション付きの細いエッジ */}
      {!isChild && (
        <mesh position={[0, 0, -0.01]} ref={glowRef}>
          <planeGeometry args={[2.6, 2.6]} />
          <meshBasicMaterial 
            color={displayColor}
            transparent
            alphaMap={neonTexture}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {note.image_url && (
        <DreiImage 
          url={note.image_url} 
          position={[0, note.text ? 0.3 : 0, 0.01]} 
          scale={isChild ? [width * 0.8, height * 0.5] : [1.6, 1.0]} 
          transparent 
          opacity={0.9} 
        />
      )}

      {note.text && (
        <>
          <Text
            position={[0, note.image_url ? -height * 0.25 : 0, 0.02]}
            color="#333333"
            fontSize={isChild ? 0.15 : 0.25}
            maxWidth={isChild ? width * 0.9 : 2.0}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {note.text}
          </Text>
        </>
      )}

      {/* 日付の表示 */}
      <Text
        position={isChild 
          ? [width / 2 - 0.05, -height / 2 + 0.05, 0.02] 
          : [0, -0.9, 0.02]}
        color="#555555"
        fontSize={isChild ? 0.06 : 0.08}
        anchorX={isChild ? "right" : "center"}
        anchorY="bottom"
      >
        {new Date(note.created_at).toLocaleDateString()}
      </Text>

      {isFocused && (
        <Html position={[isChild ? width / 2 + 0.2 : 1.4, isChild ? -height / 2 + 0.2 : -1.0, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '16px 20px 12px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            borderLeft: `4px solid ${user.color}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '120px'
          }}>
            <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('この思考（惑星）を完全に消滅させますか？')) {
                    useStore.getState().deleteNote(note.id);
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.6, padding: '4px' }}
                title="消滅させる"
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                💥
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedNoteId(null);
                }}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}
                title="閉じる"
                onMouseOver={(e) => e.currentTarget.style.background = '#e0e0e0'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f0f0f0'}
              >
                ✕
              </button>
            </div>

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

            {/* 衛星へのジャンプリンク（恒星がフォーカスされている時） */}
            {!isChild && connections.some(c => c.from_note_id === note.id) && (
              <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px' }}>衛星へジャンプ:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {useStore.getState().notes
                    .filter(n => connections.some(c => c.from_note_id === note.id && c.to_note_id === n.id))
                    .map(child => (
                      <button 
                        key={child.id}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setFocusedNoteId(child.id); 
                        }}
                        style={{ display: 'block', background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: '12px', textAlign: 'left', padding: '2px 0' }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        ↳ {child.text ? (child.text.length > 10 ? child.text.substring(0, 10) + '...' : child.text) : (child.image_url ? '[画像]' : '無題の衛星')}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};
