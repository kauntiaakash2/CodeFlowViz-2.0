'use client';

import { usePlayback } from '@/context/PlaybackContext';

export default function FlowControls() {
  const { playback, snapshots } = usePlayback();
  const {
    selectedSnapshotIndex,
    isPlaying,
    play,
    pause,
    reset,
    stepInto,
    stepOver,
    stepBack,
  } = playback;

  const hasTimeline = snapshots.length > 0;

  return (
    <aside className="panel left">
      <h2>Flow Controls</h2>
      <p>Execute JavaScript through AST instrumentation, then replay assignment snapshots and loop checkpoints.</p>

      <div className="flowButtons">
        <button
          onClick={isPlaying ? pause : play}
          disabled={!hasTimeline}
          className={isPlaying ? 'btnPause' : 'btnPlay'}
          type="button"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          onClick={stepBack}
          disabled={!hasTimeline || selectedSnapshotIndex === 0 || selectedSnapshotIndex === null}
          type="button"
        >
          ⏮ Step Back
        </button>

        <button
          onClick={stepInto}
          disabled={!hasTimeline || selectedSnapshotIndex === snapshots.length - 1}
          type="button"
        >
          ⏭ Step Into
        </button>

        <button
          onClick={stepOver}
          disabled={!hasTimeline || selectedSnapshotIndex === snapshots.length - 1}
          type="button"
        >
          ↷ Step Over
        </button>

        <button
          onClick={reset}
          disabled={!hasTimeline}
          className="btnReset"
          type="button"
        >
          ↺ Reset
        </button>
      </div>
    </aside>
  );
}
