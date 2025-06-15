
import React, { useRef, useEffect } from "react";

interface AudioWaveformVisualizerProps {
  buffer: Float32Array | null;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  buffer,
  width = 360,
  height = 40,
  color = "#9333ea", // Tailwind purple-600
  backgroundColor = "#0a0a23",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // No data
    if (!buffer.length) return;
    // Draw waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const idx = Math.floor((x / width) * buffer.length);
      const v = buffer[idx] ?? 0;
      const y = (1 - (v + 1) / 2) * height;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw midline
    ctx.strokeStyle = "#9ca3af"; // Tailwind gray-400
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [buffer, width, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded bg-slate-950 border border-white/10"
      style={{ display: "block" }}
      aria-label="Audio waveform visualization"
    />
  );
};

export default AudioWaveformVisualizer;
