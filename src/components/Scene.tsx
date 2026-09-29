import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Sparkles, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Pixelation } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';
import { Note } from './Note';
import { Connections, SemanticConnections } from './Connections';
import { cosineSimilarity } from '../utils';

const ConstellationLabels = ({ 
  constellations, 
  physicsState 
}: { 
  constellations: { ids: string[], label: string }[], 
  physicsState: React.MutableRefObject<Record<string, { position: THREE.Vector3 }>> 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const constellationRefs = useRef<(any | null)[]>([]);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    // カメラの距離（原点からの距離や、シーン全体の広がり具合から計算）
    const cameraDist = state.camera.position.length();
    
    // 遠ざかるほど濃くなる（近くでは消える）
    const targetOpacity = THREE.MathUtils.clamp((cameraDist - 10) / 10, 0, 0.8);

    constellationRefs.current.forEach((textMesh, i) => {
      if (!textMesh) return;
      const c = constellations[i];
      if (!c) return;

      // 重心を計算
      let centerX = 0, centerY = 0, centerZ = 0;
      let count = 0;
      c.ids.forEach(id => {
        const pState = physicsState.current[id];
        if (pState) {
          centerX += pState.position.x;
          centerY += pState.position.y;
          centerZ += pState.position.z;
          count++;
        }
      });
      
      if (count > 0 && textMesh.position && textMesh.quaternion) {
        // 重心の少し上に配置
        textMesh.position.set(centerX / count, (centerY / count) + 2.0, centerZ / count);
        // カメラの方を向く（ビルボード）
        textMesh.quaternion.copy(state.camera.quaternion);
      }
      
      if (textMesh.material) {
        textMesh.material.opacity = THREE.MathUtils.lerp(textMesh.material.opacity || 0, targetOpacity, 0.1);
        textMesh.material.transparent = true;
      }
      if (textMesh.fillOpacity !== undefined) {
        textMesh.fillOpacity = THREE.MathUtils.lerp(textMesh.fillOpacity || 0, targetOpacity, 0.1);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {constellations.map((c, i) => (
        <Text
          key={i}
          ref={el => constellationRefs.current[i] = el}
          fontSize={0.8}
          color="#0ff"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/dotgothic16/v1/XoHm2X49-ALh7UvH8y4q07GZ0A.woff"
          renderOrder={10}
          depthTest={false}
          fillOpacity={0}
        >
          {`✦ ${c.label} ✦`}
        </Text>
      ))}
    </group>
  );
};

export const Scene = () => {
  const notes = useStore(state => state.notes);
  const connections = useStore(state => state.connections);
  const focusedNoteId = useStore(state => state.focusedNoteId);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  
  // 意味的に似ているノートのペアをキャッシュ
  const semanticPairs = useMemo(() => {
    const pairs: { id1: string, id2: string, strength: number }[] = [];
    const notesWithEmbedding = notes.filter(n => n.embedding && n.embedding.length > 0);
    
    for (let i = 0; i < notesWithEmbedding.length; i++) {
      for (let j = i + 1; j < notesWithEmbedding.length; j++) {
        const n1 = notesWithEmbedding[i];
        const n2 = notesWithEmbedding[j];
        
        // すでに明示的な接続がある場合は除外
        if (connections.some(c => (c.from_note_id === n1.id && c.to_note_id === n2.id) || (c.from_note_id === n2.id && c.to_note_id === n1.id))) continue;
        
        const sim = cosineSimilarity(n1.embedding!, n2.embedding!);
        if (sim > 0.6) { // 類似度のしきい値
          pairs.push({ id1: n1.id, id2: n2.id, strength: (sim - 0.6) * 2.5 }); // 0~1の強さにマッピング
        }
      }
    }
    return pairs;
  }, [notes, connections]);

  // 星座（クラスタ）の抽出
  const constellations = useMemo(() => {
    // グラフの隣接リストを作成
    const adj: Record<string, string[]> = {};
    notes.forEach(n => adj[n.id] = []);
    
    // 意味的な繋がりと、明示的な繋がりの両方をグラフの辺とする
    semanticPairs.forEach(p => {
      adj[p.id1]?.push(p.id2);
      adj[p.id2]?.push(p.id1);
    });
    connections.forEach(c => {
      if (adj[c.from_note_id] && adj[c.to_note_id]) {
        adj[c.from_note_id].push(c.to_note_id);
        adj[c.to_note_id].push(c.from_note_id);
      }
    });

    const visited = new Set<string>();
    const clusters: { ids: string[], label: string }[] = [];

    notes.forEach(startNote => {
      if (!visited.has(startNote.id)) {
        const clusterIds: string[] = [];
        const queue = [startNote.id];
        visited.add(startNote.id);

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          clusterIds.push(currentId);
          adj[currentId]?.forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }

        // 3つ以上の星が集まっている場合のみ「星座」とみなす
        if (clusterIds.length >= 3) {
          // クラスタ内の最古のノート、または一番文字数の多いノートを代表とする
          const clusterNotes = clusterIds.map(id => notes.find(n => n.id === id)!).filter(Boolean);
          // 代表ノート（一番古いものをベースにする）
          clusterNotes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          // テキストがあるノートを探す
          const repNote = clusterNotes.find(n => n.text && n.text.trim().length > 0) || clusterNotes[0];
          
          let labelText = 'IMAGE STAR';
          if (repNote && repNote.text) {
            labelText = repNote.text.split('\n')[0].substring(0, 15);
            if (repNote.text.length > 15) labelText += '...';
          }
          
          clusters.push({ ids: clusterIds, label: labelText });
        }
      }
    });
    
    return clusters;
  }, [notes, semanticPairs, connections]);
  
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
    
    // AI 意味的引力 (Semantic Gravity)
    semanticPairs.forEach(pair => {
      const state1 = physicsState.current[pair.id1];
      const state2 = physicsState.current[pair.id2];
      if (state1 && state2) {
        const diff = new THREE.Vector3().subVectors(state2.position, state1.position);
        const dist = diff.length();
        
        // 遠すぎると効果なし、近すぎると反発で相殺される。適度な距離で引き合う
        if (dist > 3.0 && dist < 15.0) {
          // strength (0~1) に応じたゆるやかな引力
          const force = diff.normalize().multiplyScalar(pair.strength * 0.1 * dt);
          if (!state1.isDragging) state1.acceleration.add(force);
          if (!state2.isDragging) state2.acceleration.sub(force);
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
      <SemanticConnections physicsState={physicsState} semanticPairs={semanticPairs} />
      <ConstellationLabels constellations={constellations} physicsState={physicsState} />
      
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
