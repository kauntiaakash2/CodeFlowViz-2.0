'use client';

import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    if (initialIndex !== null && initialIndex !== undefined) {
      const lastIndex = snapshots.length - 1;
      setSelectedSnapshotIndex(
        lastIndex >= 0 ? Math.min(Math.max(initialIndex, 0), lastIndex) : null,
      );
    }
  }, [initialIndex, snapshots.length]);

  useEffect(() => {
    if (snapshots.length === 0) {
      setIsPlaying(false);
      setSelectedSnapshotIndex(null);
      return;
    }

    setSelectedSnapshotIndex((previousIndex) =>
      previousIndex === null
        ? null
        : Math.min(Math.max(previousIndex, 0), snapshots.length - 1),
    );
  }, [snapshots.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (snapshots.length === 0) return;
    setSelectedSnapshotIndex((previousIndex) =>
      previousIndex === null || previousIndex >= snapshots.length - 1
        ? 0
        : previousIndex,
    );
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

  useEffect(() => {
    if (!isPlaying || snapshots.length === 0) return;

    const playInterval = window.setInterval(() => {
      setSelectedSnapshotIndex((previousIndex) => {
        if (previousIndex === null) return 0;
        return Math.min(previousIndex + 1, snapshots.length - 1);
      });
    }, playbackDelay);

    return () => {
      window.clearInterval(playInterval);
    };
  }, [isPlaying, snapshots.length, playbackDelay]);

  useEffect(() => {
    if (
      isPlaying &&
      selectedSnapshotIndex !== null &&
      selectedSnapshotIndex >= snapshots.length - 1
    ) {
      setIsPlaying(false);
    }
  }, [isPlaying, selectedSnapshotIndex, snapshots.length]);

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
