/**
 * Custom hook for pose detection using MediaPipe Pose
 * 
 * This hook handles:
 * - Loading the MediaPipe Pose model from CDN
 * - Processing video frames to detect body landmarks
 * - Calculating posture angles and classification
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Posture states
export type PostureStatus = 'initializing' | 'good' | 'bad';

// Key body landmarks we track
export interface Landmarks {
  nose: { x: number; y: number } | null;
  leftShoulder: { x: number; y: number } | null;
  rightShoulder: { x: number; y: number } | null;
  leftHip: { x: number; y: number } | null;
  rightHip: { x: number; y: number } | null;
}

export interface PostureData {
  status: PostureStatus;
  landmarks: Landmarks;
  neckAngle: number;
  backAngle: number;
  confidence: number;
}

// Thresholds for posture classification
const BACK_ANGLE_THRESHOLD = 15;
const NECK_FORWARD_THRESHOLD = 0.08;

// MediaPipe landmark indices
const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

// Pose connections for drawing skeleton
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 23], // left side
  [12, 24], // right side
  [23, 24], // hips
];

interface UsePoseDetectionReturn {
  postureData: PostureData;
  isModelLoading: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

// Declare global types for MediaPipe
declare global {
  interface Window {
    Pose: any;
    Camera: any;
  }
}

// Load script dynamically
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export const usePoseDetection = (): UsePoseDetectionReturn => {
  const [postureData, setPostureData] = useState<PostureData>({
    status: 'initializing',
    landmarks: {
      nose: null,
      leftShoulder: null,
      rightShoulder: null,
      leftHip: null,
      rightHip: null,
    },
    neckAngle: 0,
    backAngle: 0,
    confidence: 0,
  });
  
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const calculateAngleFromVertical = (
    top: { x: number; y: number },
    bottom: { x: number; y: number }
  ): number => {
    const dx = top.x - bottom.x;
    const dy = bottom.y - top.y;
    const angleRad = Math.atan2(dx, dy);
    return (angleRad * 180) / Math.PI;
  };

  const classifyPosture = (
    landmarks: Landmarks,
    backAngle: number,
    neckForwardDistance: number
  ): PostureStatus => {
    const hasRequiredLandmarks = 
      landmarks.leftShoulder && 
      landmarks.rightShoulder && 
      landmarks.leftHip && 
      landmarks.rightHip;
    
    if (!hasRequiredLandmarks) {
      return 'initializing';
    }

    const isBackAngleBad = Math.abs(backAngle) > BACK_ANGLE_THRESHOLD;
    const isHeadForward = neckForwardDistance > NECK_FORWARD_THRESHOLD;

    if (isBackAngleBad || isHeadForward) {
      return 'bad';
    }

    return 'good';
  };

  const onResults = useCallback((results: any) => {
    if (!results.poseLandmarks) {
      return;
    }

    const lm = results.poseLandmarks;

    const landmarks: Landmarks = {
      nose: lm[NOSE] ? { x: lm[NOSE].x, y: lm[NOSE].y } : null,
      leftShoulder: lm[LEFT_SHOULDER] ? { x: lm[LEFT_SHOULDER].x, y: lm[LEFT_SHOULDER].y } : null,
      rightShoulder: lm[RIGHT_SHOULDER] ? { x: lm[RIGHT_SHOULDER].x, y: lm[RIGHT_SHOULDER].y } : null,
      leftHip: lm[LEFT_HIP] ? { x: lm[LEFT_HIP].x, y: lm[LEFT_HIP].y } : null,
      rightHip: lm[RIGHT_HIP] ? { x: lm[RIGHT_HIP].x, y: lm[RIGHT_HIP].y } : null,
    };

    let shoulderMidX = 0, shoulderMidY = 0;
    if (landmarks.leftShoulder && landmarks.rightShoulder) {
      shoulderMidX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
      shoulderMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
    }

    let hipMidX = 0, hipMidY = 0;
    if (landmarks.leftHip && landmarks.rightHip) {
      hipMidX = (landmarks.leftHip.x + landmarks.rightHip.x) / 2;
      hipMidY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
    }

    let backAngle = 0;
    if (shoulderMidY !== 0 && hipMidY !== 0) {
      backAngle = calculateAngleFromVertical(
        { x: shoulderMidX, y: shoulderMidY },
        { x: hipMidX, y: hipMidY }
      );
    }

    let neckForwardDistance = 0;
    if (landmarks.nose && shoulderMidX !== 0) {
      neckForwardDistance = Math.abs(landmarks.nose.x - shoulderMidX);
    }

    const status = classifyPosture(landmarks, backAngle, neckForwardDistance);

    setPostureData({
      status,
      landmarks,
      neckAngle: neckForwardDistance * 100,
      backAngle,
      confidence: 0.9,
    });
  }, []);

  useEffect(() => {
    const initPose = async () => {
      try {
        // Load MediaPipe scripts from CDN
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');

        // Wait for scripts to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!window.Pose) {
          throw new Error('MediaPipe Pose not loaded');
        }

        const pose = new window.Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          },
        });

        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(onResults);

        // Initialize the model
        await pose.initialize();

        poseRef.current = pose;
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading MediaPipe Pose:', err);
        setError('Failed to load pose detection model');
        setIsModelLoading(false);
      }
    };

    initPose();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [onResults]);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!poseRef.current || !window.Camera) return;

    videoRef.current = video;

    const camera = new window.Camera(video, {
      onFrame: async () => {
        if (poseRef.current && video.readyState >= 2) {
          await poseRef.current.send({ image: video });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
    cameraRef.current = camera;
  }, []);

  const stopDetection = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
  }, []);

  return {
    postureData,
    isModelLoading,
    error,
    startDetection,
    stopDetection,
  };
};
