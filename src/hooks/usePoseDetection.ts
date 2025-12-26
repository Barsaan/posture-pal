/**
 * Custom hook for pose detection using MediaPipe Pose
 * 
 * This hook handles:
 * - Loading the MediaPipe Pose model
 * - Processing video frames to detect body landmarks
 * - Calculating posture angles and classification
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Pose, Results, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

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
  neckAngle: number;      // Angle of head forward tilt
  backAngle: number;      // Angle of spine from vertical
  confidence: number;     // Detection confidence
}

// Thresholds for posture classification (in degrees)
const BACK_ANGLE_THRESHOLD = 15;  // Max degrees spine can tilt forward
const NECK_FORWARD_THRESHOLD = 0.08; // Normalized distance nose can be forward of shoulders

// MediaPipe landmark indices
const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

interface UsePoseDetectionReturn {
  postureData: PostureData;
  isModelLoading: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

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
  
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  /**
   * Calculate the angle between two points and vertical axis
   * Returns angle in degrees (0 = straight up, positive = leaning forward)
   */
  const calculateAngleFromVertical = (
    top: { x: number; y: number },
    bottom: { x: number; y: number }
  ): number => {
    // Vector from bottom to top point
    const dx = top.x - bottom.x;
    const dy = bottom.y - top.y; // Inverted because y increases downward
    
    // Angle from vertical (0 degrees = straight up)
    const angleRad = Math.atan2(dx, dy);
    const angleDeg = (angleRad * 180) / Math.PI;
    
    return angleDeg;
  };

  /**
   * Classify posture based on calculated angles
   */
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

    // Bad posture conditions:
    // 1. Back angle exceeds threshold (slouching/leaning)
    // 2. Head is too far forward (forward head posture)
    const isBackAngleBad = Math.abs(backAngle) > BACK_ANGLE_THRESHOLD;
    const isHeadForward = neckForwardDistance > NECK_FORWARD_THRESHOLD;

    if (isBackAngleBad || isHeadForward) {
      return 'bad';
    }

    return 'good';
  };

  /**
   * Process pose detection results
   */
  const onResults = useCallback((results: Results) => {
    if (!results.poseLandmarks) {
      return;
    }

    const lm = results.poseLandmarks;

    // Extract landmarks (coordinates are normalized 0-1)
    const landmarks: Landmarks = {
      nose: lm[NOSE] ? { x: lm[NOSE].x, y: lm[NOSE].y } : null,
      leftShoulder: lm[LEFT_SHOULDER] ? { x: lm[LEFT_SHOULDER].x, y: lm[LEFT_SHOULDER].y } : null,
      rightShoulder: lm[RIGHT_SHOULDER] ? { x: lm[RIGHT_SHOULDER].x, y: lm[RIGHT_SHOULDER].y } : null,
      leftHip: lm[LEFT_HIP] ? { x: lm[LEFT_HIP].x, y: lm[LEFT_HIP].y } : null,
      rightHip: lm[RIGHT_HIP] ? { x: lm[RIGHT_HIP].x, y: lm[RIGHT_HIP].y } : null,
    };

    // Calculate midpoints
    let shoulderMidX = 0;
    let shoulderMidY = 0;
    if (landmarks.leftShoulder && landmarks.rightShoulder) {
      shoulderMidX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
      shoulderMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
    }

    let hipMidX = 0;
    let hipMidY = 0;
    if (landmarks.leftHip && landmarks.rightHip) {
      hipMidX = (landmarks.leftHip.x + landmarks.rightHip.x) / 2;
      hipMidY = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
    }

    // Calculate back angle (spine deviation from vertical)
    let backAngle = 0;
    if (shoulderMidY !== 0 && hipMidY !== 0) {
      backAngle = calculateAngleFromVertical(
        { x: shoulderMidX, y: shoulderMidY },
        { x: hipMidX, y: hipMidY }
      );
    }

    // Calculate how far forward the nose is from shoulder line (normalized)
    let neckForwardDistance = 0;
    if (landmarks.nose && shoulderMidX !== 0) {
      neckForwardDistance = Math.abs(landmarks.nose.x - shoulderMidX);
    }

    // Classify posture
    const status = classifyPosture(landmarks, backAngle, neckForwardDistance);

    setPostureData({
      status,
      landmarks,
      neckAngle: neckForwardDistance * 100, // Scale for display
      backAngle,
      confidence: 0.9, // MediaPipe doesn't provide per-frame confidence easily
    });
  }, []);

  /**
   * Initialize MediaPipe Pose
   */
  useEffect(() => {
    const initPose = async () => {
      try {
        const pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          },
        });

        pose.setOptions({
          modelComplexity: 0, // Lite model for speed
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults(onResults);

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
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [onResults]);

  /**
   * Start pose detection on a video element
   */
  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!poseRef.current) return;

    const camera = new Camera(video, {
      onFrame: async () => {
        if (poseRef.current) {
          await poseRef.current.send({ image: video });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
    cameraRef.current = camera;
  }, []);

  /**
   * Stop pose detection
   */
  const stopDetection = useCallback(() => {
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

// Re-export for skeleton drawing
export { POSE_CONNECTIONS };
