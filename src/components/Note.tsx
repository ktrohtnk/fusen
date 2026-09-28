import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Html, Image as DreiImage, Edges, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { NoteData, useStore, USERS } from '../store';
import { useDrag } from '@use-gesture/react';
import { Link as LinkIcon } from 'lucide-react';

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
  const currentUser = useStore((state) => state.currentUser);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const neonTexture = useMemo(() => createNeonGradient(), []);
  const timeOffset = useRef(Math.random() * 100);

  const user = USERS.find(u => u.id === note.user_id) || USERS[0];
  const isFocused = focusedNoteId === note.id;

  const isChild = useMemo(() => connections.some(c => c.to_note_id === note.id), [connections, note.id]);
  const childIds = useMemo(() => connections.filter(c => c.from_note_id === note.id).map(c => c.to_note_id), [connections, note.id]);
  
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

      // 衛星への方向を示す矢印の更新
      if (!isChild) {
        childIds.forEach(childId => {
          const childState = physicsState.current[childId];
          if (childState) {
            const indicator = meshRef.current!.getObjectByName(`indicator-${childId}`) as THREE.Mesh;
            if (indicator) {
              const diff = new THREE.Vector3().subVectors(childState.position, meshRef.current!.position);
              // カメラに向いている星のローカル座標系に変換
              const localDiff = diff.clone().applyQuaternion(meshRef.current!.quaternion.clone().invert());
              localDiff.z = 0; // XY平面（星の盤面）に投影
              
              if (localDiff.lengthSq() > 0.001) {
                localDiff.normalize();
                // 縁の少し内側 (半径 1.05) に配置
                indicator.position.copy(localDiff.clone().multiplyScalar(1.05));
                indicator.position.z = 0.05; // 星本体より手前に出す
                
                const angle = Math.atan2(localDiff.y, localDiff.x);
                indicator.rotation.set(0, 0, angle - Math.PI / 2);
              }
            }
          }
        });
      }
    }
    
    if (glowRef.current && !isChild) {
      const pulse = (Math.sin(state.clock.elapsedTime * 1.5 + timeOffset.current) + 1) / 2;
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      
      const intensity = 1.5 + pulse * 1.0;
      material.color.copy(displayColor).multiplyScalar(intensity);
      material.opacity = 0.9;
    }

    if (isDeleting && meshRef.current) {
      // サノスエフェクト: 回転しながら縮む
      meshRef.current.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), 0.05);
      meshRef.current.rotation.z += 0.2;
      meshRef.current.rotation.x += 0.1;
      meshRef.current.position.y += 0.02; // 少し上に舞い上がる
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
  const isNew = age < 21600; // 6時間以内はNEW

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
          <boxGeometry args={[width, height, 0.05]} />
        ) : (
          <circleGeometry args={[1.2, 64]} />
        )}
        <meshStandardMaterial
          color={displayColor}
          roughness={0.8}
          emissive={user.color}
          emissiveIntensity={isChild ? 0.2 : 0.15}
          transparent
          opacity={isChild ? 0.75 : 0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* クリック判定用の透明な大きなヒットボックス */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={isChild ? [width * 1.5, height * 1.5] : [3, 3]} />
        <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
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

      {/* 衛星の位置を示すレーダー矢印（恒星の淵） */}
      {!isChild && childIds.map(childId => (
        <mesh key={`indicator-${childId}`} name={`indicator-${childId}`}>
          <coneGeometry args={[0.08, 0.15, 3]} />
          <meshBasicMaterial
            color={displayColor}
            toneMapped={false}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}

      {note.image_url && (
        <DreiImage
          url={note.image_url}
          position={[0, note.text ? 0.3 : 0, 0.01]}
          scale={isChild ? [width * 0.8, height * 0.5] : [1.6, 1.0]}
          transparent
          opacity={0.9}
        />
      )}

      {note.text && (() => {
        const textLen = note.text.length;
        
        let dFontSize = isChild ? 0.13 : 0.17;
        let dMaxWidth = isChild ? width * 0.75 : 1.2;

        if (textLen > 60) {
          dFontSize = isChild ? 0.08 : 0.11;
          dMaxWidth = isChild ? width * 0.85 : 1.6;
        } else if (textLen > 30) {
          dFontSize = isChild ? 0.10 : 0.14;
          dMaxWidth = isChild ? width * 0.8 : 1.4;
        }

        return (
          <Text
            position={[0, note.image_url ? -height * 0.25 : 0, 0.02]}
            color={isChild ? '#1a1a1a' : '#ffffff'}
            fontSize={dFontSize}
            maxWidth={dMaxWidth}
            lineHeight={1.3}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
            overflowWrap="break-word"
            sdfGlyphSize={128}
          >
            {note.text}
          </Text>
        );
      })()}

      {/* 日付と時間の表示 */}
      <Text
        position={isChild
          ? [width / 2 - 0.05, -height / 2 + 0.05, 0.02]
          : [0, -0.9, 0.02]}
        color={isChild ? '#333333' : '#aaaaaa'}
        fontSize={isChild ? 0.05 : 0.065}
        anchorX={isChild ? "right" : "center"}
        anchorY="bottom"
        sdfGlyphSize={64}
      >
        {`${new Date(note.created_at).toLocaleDateString()} ${new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
      </Text>

      {/* NEW バッジ（6時間以内の投稿） */}
      {isNew && (
        <Text
          position={isChild ? [width / 2 - 0.05, height / 2 + 0.08, 0.03] : [0.9, 0.9, 0.03]}
          color="#ffffff"
          fontSize={isChild ? 0.08 : 0.10}
          anchorX="right"
          anchorY="bottom"
          sdfGlyphSize={64}
        >
          NEW
        </Text>
      )}

      {isFocused && (
        <Html 
          position={
            isChild 
              ? [0, 0, 0.5] 
              : size.width < 640 
                ? [0, 0, 1.0] 
                : [1.1, 1.1, 0]
          } 
          center 
          zIndexRange={[100, 0]}
        >
          {/* 外枠コンテナ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            
            {/* メインの情報パネル */}
            <div style={{
              position: 'relative',
              background: 'rgba(10, 15, 30, 0.95)',
              padding: '16px 20px 12px 12px',
              border: `2px solid ${user.color}`,
              boxShadow: `4px 4px 0px ${user.color}40`,
              color: '#e0e0e0',
              fontSize: '12px',
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minWidth: '120px',
              fontFamily: 'inherit'
            }}>
              <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '4px' }}>
                {currentUser?.id === note.user_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('この思考（惑星）を完全に消滅させますか？')) {
                        setIsDeleting(true);
                        setFocusedNoteId(null);
                        setTimeout(() => {
                          useStore.getState().deleteNote(note.id);
                        }, 1500);
                      }
                    }}
                    style={{ background: '#000', border: `2px solid ${user.color}`, cursor: 'pointer', fontSize: '10px', padding: '2px 4px', color: user.color, fontFamily: 'inherit' }}
                    title="消滅させる"
                    onMouseOver={(e) => { e.currentTarget.style.background = user.color; e.currentTarget.style.color = '#000'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = user.color; }}
                  >
                    DEL
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedNoteId(null);
                  }}
                  style={{ background: '#000', border: '2px solid #0ff', cursor: 'pointer', fontSize: '10px', padding: '2px 4px', color: '#0ff', fontFamily: 'inherit' }}
                  title="閉じる"
                  onMouseOver={(e) => { e.currentTarget.style.background = '#0ff'; e.currentTarget.style.color = '#000'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = '#0ff'; }}
                >
                  [X] CANCEL FOCUS
                </button>
              </div>

              <div>
                <div style={{ fontWeight: 'bold', color: user.color, letterSpacing: '2px', textShadow: `2px 2px 0px ${user.color}40` }}>{user.name}</div>
                <div style={{ color: '#0ff', fontSize: '10px', margin: '4px 0' }}>
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

              {/* 衛星へのジャンプリンク */}
              {connections.some(c => c.from_note_id === note.id) && (
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

            {/* 衛星をつくるボタン（メインパネルの外側） */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().setIsCreating(true);
              }}
              style={{
                background: user.color, border: `2px solid ${user.color}`, color: '#000',
                padding: '12px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontSize: '16px', fontWeight: 'bold', fontFamily: 'inherit', letterSpacing: '1px',
                boxShadow: `4px 4px 0px ${user.color}60`, pointerEvents: 'auto'
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#0a0f1a'; e.currentTarget.style.color = user.color; }}
              onMouseOut={e => { e.currentTarget.style.background = user.color; e.currentTarget.style.color = '#000'; }}
            >
              <LinkIcon size={18} strokeWidth={3} /> CREATE SATELLITE
            </button>
          </div>
        </Html>
      )}


      {/* サノスエフェクト用パーティクル */}
      {isDeleting && (
        <Sparkles 
          count={200} 
          scale={isChild ? [1.5, 1.5, 1.5] : [2.5, 2.5, 2.5]} 
          size={isChild ? 4 : 6} 
          speed={4} 
          color={user.color} 
          noise={1} 
        />
      )}
    </group>
  );
};
