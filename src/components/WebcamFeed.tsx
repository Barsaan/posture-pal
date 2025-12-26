/**
 * WebcamFeed Component
 * 
 * Handles webcam access and displays the video feed with pose skeleton overlay.
 * The skeleton is drawn on a canvas overlaid on the video.
 */

import { useEffect, useRef, useState } from 'react';
import { Landmarks } from '@/hooks/usePoseDetection';

interface WebcamFeedProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  landmarks: Landmarks;
  isGoodPosture: boolean;
}

export const WebcamFeed = ({ onVideoReady, landmarks, isGoodPosture }: WebcamFeedProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  // Request webcam access on mount
  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user', // Front camera
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              setDimensions({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
              onVideoReady(videoRef.current);
            }
          };
        }
        setHasPermission(true);
      } catch (err) {
        console.error('Camera access denied:', err);
        setHasPermission(false);
      }
    };

    setupCamera();

    // Cleanup: stop all tracks when component unmounts
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onVideoReady]);

  // Draw skeleton overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set skeleton color based on posture
    const skeletonColor = isGoodPosture ? '#22c55e' : '#ef4444';
    const pointColor = isGoodPosture ? '#4ade80' : '#f87171';

    ctx.strokeStyle = skeletonColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Helper to draw a point
    const drawPoint = (x: number, y: number, radius: number = 6) => {
      ctx.beginPath();
      ctx.fillStyle = pointColor;
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      // Add glow effect
      ctx.shadowColor = skeletonColor;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    // Helper to draw a line between two points
    const drawLine = (
      p1: { x: number; y: number } | null,
      p2: { x: number; y: number } | null
    ) => {
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    };

    // Draw skeleton connections
    // Shoulder line
    drawLine(landmarks.leftShoulder, landmarks.rightShoulder);
    
    // Hip line
    drawLine(landmarks.leftHip, landmarks.rightHip);
    
    // Left side (shoulder to hip)
    drawLine(landmarks.leftShoulder, landmarks.leftHip);
    
    // Right side (shoulder to hip)
    drawLine(landmarks.rightShoulder, landmarks.rightHip);

    // Draw nose to shoulder center (neck line)
    if (landmarks.leftShoulder && landmarks.rightShoulder && landmarks.nose) {
      const shoulderMid = {
        x: (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2,
        y: (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2,
      };
      drawLine(landmarks.nose, shoulderMid);
    }

    // Draw points
    if (landmarks.nose) drawPoint(landmarks.nose.x, landmarks.nose.y, 8);
    if (landmarks.leftShoulder) drawPoint(landmarks.leftShoulder.x, landmarks.leftShoulder.y);
    if (landmarks.rightShoulder) drawPoint(landmarks.rightShoulder.x, landmarks.rightShoulder.y);
    if (landmarks.leftHip) drawPoint(landmarks.leftHip.x, landmarks.leftHip.y);
    if (landmarks.rightHip) drawPoint(landmarks.rightHip.x, landmarks.rightHip.y);

  }, [landmarks, isGoodPosture]);

  // Show permission denied message
  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center w-full h-full glass-card p-8">
        <div className="text-center">
          <div className="text-destructive text-xl font-semibold mb-2">
            Camera Access Required
          </div>
          <p className="text-muted-foreground">
            Please allow camera access to use posture detection.
            <br />
            Check your browser settings and refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50">
      {/* Video feed (mirrored for natural interaction) */}
      <video
        ref={videoRef}
        className="w-full h-auto transform scale-x-[-1]"
        playsInline
        muted
        style={{ maxWidth: '100%' }}
      />
      
      {/* Canvas overlay for skeleton drawing (also mirrored) */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1]"
      />

      {/* Loading indicator */}
      {hasPermission === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Accessing camera...</p>
          </div>
        </div>
      )}
    </div>
  );
};
