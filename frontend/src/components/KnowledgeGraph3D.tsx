import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../types';

interface KnowledgeGraph3DProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  selectedNodeId: string | null;
  typeLabels: Record<string, string>;
  typeOrder: string[];
  getNodeType: (node: KnowledgeGraphNode) => string;
  getNodeColor: (type: string) => string;
  getRelationColor: (label?: string) => string;
  trimLabel: (value: string, maxLength: number) => string;
  onSelect: (node: KnowledgeGraphNode) => void;
}

export default function KnowledgeGraph3D({
  nodes,
  edges,
  selectedNodeId,
  typeLabels,
  typeOrder,
  getNodeType,
  getNodeColor,
  getRelationColor,
  trimLabel,
  onSelect
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight || 810, 420);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b10');
    scene.fog = new THREE.Fog('#070b10', 780, 1680);

    const camera = new THREE.PerspectiveCamera(36, width / height, 1, 2600);
    camera.position.set(0, 48, nodes.length <= 3 ? 520 : 920);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.78;
    controls.rotateSpeed = 0.62;
    controls.panSpeed = 0.72;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 320;
    controls.maxDistance = 1320;

    scene.add(new THREE.HemisphereLight(0xd8fff7, 0x081018, 1.08));
    scene.add(new THREE.AmbientLight(0x9ab5c8, 0.42));
    const pointLight = new THREE.PointLight(0x8dd8ff, 2.1);
    pointLight.position.set(260, 240, 380);
    scene.add(pointLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.88);
    directionalLight.position.set(-180, 260, 320);
    scene.add(directionalLight);
    const accentLight = new THREE.PointLight(0x26d6b5, 1.65);
    accentLight.position.set(-260, -120, 260);
    scene.add(accentLight);
    const grid = new THREE.GridHelper(900, 22, '#173a40', '#101b24');
    grid.position.y = -260;
    scene.add(grid);

    const positions = compute3DLayout(nodes, edges, getNodeType, typeOrder);
    const meshById = new Map<string, THREE.Mesh>();
    const nodeSizeById = new Map<string, number>();
    const nodeByMesh = new Map<THREE.Object3D, KnowledgeGraphNode>();
    const hitTargets: THREE.Object3D[] = [];
    const connectedNodeIds = new Set<string>();
    if (selectedNodeId) {
      connectedNodeIds.add(selectedNodeId);
      edges.forEach((edge) => {
        if (edge.source === selectedNodeId) connectedNodeIds.add(edge.target);
        if (edge.target === selectedNodeId) connectedNodeIds.add(edge.source);
      });
    }

    nodes.forEach((node) => {
      const position = positions[node.id] ?? new THREE.Vector3();
      const sparseBoost = nodes.length <= 3 ? 7 : 0;
      const normalizedWeight = Math.max(1, Math.min(node.weight || 1, 100));
      const size = Math.min(22, 7 + sparseBoost + Math.sqrt(normalizedWeight) * 1.25);
      const semanticType = getNodeType(node);
      const color = new THREE.Color(getNodeColor(semanticType));
      const selected = selectedNodeId === node.id;
      const connected = !selectedNodeId || connectedNodeIds.has(node.id);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 36, 22),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: selected ? 0.24 : 0.07,
          roughness: 0.36,
          metalness: selected ? 0.28 : 0.08,
          transparent: true,
          opacity: connected ? 1 : 0.2
        })
      );
      mesh.position.copy(position);
      scene.add(mesh);
      meshById.set(node.id, mesh);
      nodeSizeById.set(node.id, size);
      nodeByMesh.set(mesh, node);

      const hitTarget = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(size + 9, 18), 18, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hitTarget.position.copy(position);
      hitTarget.userData.nodeId = node.id;
      scene.add(hitTarget);
      hitTargets.push(hitTarget);
      nodeByMesh.set(hitTarget, node);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(size * 1.52, 32, 18),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: selected ? 0.24 : connected ? 0.08 : 0.015,
          depthWrite: false
        })
      );
      halo.position.copy(position);
      scene.add(halo);

      if ((nodes.length <= 36 || normalizedWeight >= 55 || selected) && connected) {
        const label = makeTextSprite(node.label, typeLabels[semanticType] ?? semanticType, getNodeColor(semanticType), trimLabel);
        label.position.copy(position.clone().add(new THREE.Vector3(0, size + 22, 0)));
        scene.add(label);
      }
    });

    edges.forEach((edge) => {
      const source = meshById.get(edge.source);
      const target = meshById.get(edge.target);
      if (!source || !target) return;
      const sourceSize = nodeSizeById.get(edge.source) ?? 10;
      const targetSize = nodeSizeById.get(edge.target) ?? 10;
      const controlPoint = source.position.clone().add(target.position).multiplyScalar(0.5);
      controlPoint.z += 28;
      const start = source.position
        .clone()
        .add(controlPoint.clone().sub(source.position).normalize().multiplyScalar(sourceSize + 2));
      const end = target.position
        .clone()
        .add(controlPoint.clone().sub(target.position).normalize().multiplyScalar(targetSize + 7));
      const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
      const connected = selectedNodeId ? edge.source === selectedNodeId || edge.target === selectedNodeId : false;
      const relationColor = new THREE.Color(connected ? getRelationColor(edge.label) : '#395266');
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),
        new THREE.LineBasicMaterial({
          color: relationColor,
          transparent: true,
          opacity: selectedNodeId ? (connected ? 0.95 : 0.1) : 0.58
        })
      );
      scene.add(line);

      const arrowDirection = end.clone().sub(curve.getPoint(0.9)).normalize();
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(4.8, 12, 18),
        new THREE.MeshStandardMaterial({
          color: relationColor,
          emissive: relationColor,
          emissiveIntensity: connected ? 0.18 : 0.05,
          roughness: 0.48
        })
      );
      arrow.position.copy(end);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arrowDirection);
      scene.add(arrow);

      if (connected || edges.length <= 42 || (edge.weight ?? 1) >= 45) {
        const label = makeRelationSprite(trimLabel(edge.label || '关联', 12), relationColor.getStyle());
        label.position.copy(curve.getPoint(0.5));
        label.position.y += 12;
        scene.add(label);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(container.clientWidth, 320);
      const nextHeight = Math.max(container.clientHeight || 810, 420);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    });
    resizeObserver.observe(container);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerOrigin: { x: number; y: number } | null = null;
    function handlePointerDown(event: PointerEvent) {
      pointerOrigin = { x: event.clientX, y: event.clientY };
    }
    function handleClick(event: MouseEvent) {
      if (pointerOrigin && Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      if (hit) {
        const node = nodeByMesh.get(hit.object);
        if (node) onSelectRef.current(node);
      }
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('click', handleClick);

    let animationFrame = 0;
    let active = true;
    function animate() {
      if (!active) return;
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          (material as THREE.SpriteMaterial | undefined)?.map?.dispose();
          material?.dispose?.();
        }
      });
      renderer.dispose();
      container.replaceChildren();
    };
  }, [edges, getNodeColor, getNodeType, getRelationColor, nodes, selectedNodeId, trimLabel, typeLabels, typeOrder]);

  return (
    <div className="graph-3d-viewport">
      <div ref={containerRef} className="graph-3d-canvas" aria-label="3D 知识图谱" />
    </div>
  );
}

function compute3DLayout(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  getNodeType: (node: KnowledgeGraphNode) => string,
  typeOrder: string[]
) {
  const result: Record<string, THREE.Vector3> = {};
  const nodeIds = new Set(nodes.map((node) => node.id));
  const degree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const score = (node: KnowledgeGraphNode) => (node.weight ?? 1) + (degree.get(node.id) ?? 0) * 18;
  const sorted = [...nodes].sort((a, b) => score(b) - score(a));
  const root = sorted[0];
  if (root) result[root.id] = new THREE.Vector3(0, 0, 0);
  const placed = new Set<string>(root ? [root.id] : []);
  const others = sorted.slice(1);

  const rootNeighbors = root
    ? (adjacency.get(root.id) ?? [])
        .map((id) => byId.get(id))
        .filter((node): node is KnowledgeGraphNode => !!node)
        .sort((a, b) => score(b) - score(a))
    : [];
  const firstRingCount = Math.min(rootNeighbors.length, 18);
  rootNeighbors.slice(0, firstRingCount).forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(firstRingCount, 1);
    const radius = 430 + Math.min(firstRingCount, 12) * 8;
    result[node.id] = new THREE.Vector3(Math.cos(angle) * radius, ((index % 5) - 2) * 45, Math.sin(angle) * radius);
    placed.add(node.id);
  });

  others
    .filter((node) => !placed.has(node.id) && (adjacency.get(node.id) ?? []).some((id) => placed.has(id)))
    .forEach((node, index) => {
      const anchorId = (adjacency.get(node.id) ?? []).find((id) => placed.has(id));
      const anchor = anchorId ? result[anchorId] : new THREE.Vector3();
      const angle = index * 2.399963229728653;
      const distance = 120 + (index % 5) * 24;
      result[node.id] = anchor.clone().add(
        new THREE.Vector3(Math.cos(angle) * distance, ((index % 7) - 3) * 24, Math.sin(angle) * distance)
      );
      placed.add(node.id);
    });

  const groups = groupNodesByType(others.filter((node) => !placed.has(node.id)), getNodeType);
  const activeTypes = typeOrder.filter((type) => groups.get(type)?.length);
  const orderedTypes = [...activeTypes, ...Array.from(groups.keys()).filter((type) => !activeTypes.includes(type))];
  orderedTypes.forEach((type, groupIndex) => {
    const groupNodes = groups.get(type) ?? [];
    const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(orderedTypes.length, 1);
    const groupSizeBoost = Math.min(groupNodes.length, 44);
    const groupCenter = new THREE.Vector3(
      Math.cos(groupAngle) * (390 + groupSizeBoost * 2.6),
      ((groupIndex % 3) - 1) * 105,
      Math.sin(groupAngle) * (390 + groupSizeBoost * 2.6)
    );
    groupNodes.forEach((node, index) => {
      if (index === 0) {
        result[node.id] = groupCenter;
        return;
      }
      const count = Math.max(groupNodes.length - 1, 1);
      const localAngle = index * 2.399963229728653;
      const localRadius = Math.min(245, 52 + Math.sqrt(index) * 34 + count * 1.2);
      result[node.id] = groupCenter.clone().add(
        new THREE.Vector3(
          Math.cos(localAngle) * localRadius,
          ((index % 7) - 3) * 24,
          Math.sin(localAngle) * localRadius
        )
      );
    });
  });
  return result;
}

function groupNodesByType(nodes: KnowledgeGraphNode[], getNodeType: (node: KnowledgeGraphNode) => string) {
  const groups = new Map<string, KnowledgeGraphNode[]>();
  nodes.forEach((node) => {
    const type = getNodeType(node);
    groups.set(type, [...(groups.get(type) ?? []), node]);
  });
  groups.forEach((group) => group.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1)));
  return groups;
}

function makeTextSprite(
  text: string,
  typeLabel: string,
  color: string,
  trimLabel: (value: string, maxLength: number) => string
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10,16,23,0.94)';
    roundRect(context, 26, 18, 460, 86, 22);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 3;
    roundRect(context, 26, 18, 460, 86, 22);
    context.stroke();
    context.fillStyle = '#eef7fa';
    context.font = '700 28px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(trimLabel(text, 18), canvas.width / 2, 56);
    context.fillStyle = '#8da4b3';
    context.font = '700 18px Arial, sans-serif';
    context.fillText(typeLabel, canvas.width / 2, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(152, 38, 1);
  sprite.renderOrder = 3;
  return sprite;
}

function makeRelationSprite(text: string, color: string) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10,16,23,0.94)';
    roundRect(context, 8, 8, 240, 48, 16);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 2;
    roundRect(context, 8, 8, 240, 48, 16);
    context.stroke();
    context.fillStyle = '#c7d7df';
    context.font = '700 20px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(88, 22, 1);
  sprite.renderOrder = 4;
  return sprite;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
