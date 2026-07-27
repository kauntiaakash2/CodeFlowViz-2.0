'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TimelineEvent {
  step: number;
  line: number;
  event: string;
  variables: Record<string, { type: string; value: string }>;
}

interface UsePlaybackScrubberProps {
  snapshots: TimelineEvent[];
  initialIndex?: number | null;
  playbackDelay?: number; // default 500ms
}

export function usePlaybackScrubber({
  snapshots,
  initialIndex = null,
  playbackDelay = 500,
}: UsePlaybackScrubberProps) {
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number | null>(initialIndex ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initialIndex when it changes
  useEffect(() => {
    if (initialIndex !== null && initialIndex !== undefined) {
      setSelectedSnapshotIndex(initialIndex);
    }
  }, [initialIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (snapshots.length === 0) return;
    setIsPlaying(true);
  }, [snapshots.length]);

  const reset = useCallback(() => {
    pause();
    setSelectedSnapshotIndex(snapshots.length > 0 ? 0 : null);
  }, [snapshots.length, pause]);

  const stepInto = useCallback(() => {
    pause();
    setSelectedSnapshotIndex((prev) => {
      if (prev === null) return snapshots.length > 0 ? 0 : null;
      if (prev >= snapshots.length - 1) return prev;
      return prev + 1;
    });
  }, [snapshots.length, pause]);

  const stepBack = useCallback(() => {
    pause();
    setSelectedSnapshotIndex((prev) => {
      if (prev === null || prev <= 0) return prev;
      return prev - 1;
    });
  }, [pause]);

  const stepOver = useCallback(() => {
    pause();
    setSelectedSnapshotIndex((prev) => {
      if (prev === null) return snapshots.length > 0 ? 0 : null;
      if (prev >= snapshots.length - 1) return prev;

      const currentSnapshot = snapshots[prev];
      let nextIndex = prev + 1;

      // Step over loop iterations / expressions on the same line
      while (nextIndex < snapshots.length && snapshots[nextIndex].line === currentSnapshot.line) {
        nextIndex++;
      }

      if (nextIndex < snapshots.length) {
        return nextIndex;
      }
      return snapshots.length - 1;
    });
  }, [snapshots, pause]);

  // Handle auto playback interval
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setSelectedSnapshotIndex((prev) => {
          if (prev === null) {
            return snapshots.length > 0 ? 0 : null;
          }
          if (prev >= snapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackDelay);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, snapshots.length, playbackDelay]);

  return {
    selectedSnapshotIndex,
    setSelectedSnapshotIndex,
    isPlaying,
    play,
    pause,
    reset,
    stepInto,
    stepOver,
    stepBack,
  };
}
