import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SkiaGate } from '../../components/SkiaGate';

const load = () => import('../../components/board/BoardScreen');

export default function PuzzleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SkiaGate load={load} props={{ id: String(id) }} />;
}
