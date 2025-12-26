/**
 * Custom hook for pose detection using TensorFlow.js
 * 
 * This hook handles:
 * - Loading the MoveNet pose detection model
 * - Processing video frames to detect body landmarks
 * - Calculating posture angles and classification
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';

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
const NECK_FORWARD_THRESHOLD = 30; // Max pixels nose can be forward of shoulders

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
  
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    // We measure deviation from vertical axis
    const angleRad = Math.atan2(dx, dy);
    const angleDeg = (angleRad * 180) / Math.PI;
    
    return angleDeg;
  };

  /**
   * Classify posture based on calculated angles
   * 
   * Good posture criteria:
   * 1. Spine (shoulder-hip line) is within threshold of vertical
   * 2. Head (nose) is not significantly forward of shoulders
   */
  const classifyPosture = (
    landmarks: Landmarks,
    backAngle: number,
    neckForwardDistance: number
  ): PostureStatus => {
    // Check if we have enough landmarks to make a determination
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
   * Extract relevant landmarks from pose detection results
   */
  const extractLandmarks = (
    keypoints: poseDetection.Keypoint[]
  ): Landmarks => {
    const findKeypoint = (name: string) => {
      const kp = keypoints.find(k => k.name === name);
      if (kp && kp.score && kp.score > 0.3) {
        return { x: kp.x, y: kp.y };
      }
      return null;
    };

    return {
      nose: findKeypoint('nose'),
      leftShoulder: findKeypoint('left_shoulder'),
      rightShoulder: findKeypoint('right_shoulder'),
      leftHip: findKeypoint('left_hip'),
      rightHip: findKeypoint('right_hip'),
    };
  };

  /**
   * Process a single frame and update posture data
   */
  const processFrame = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;

    try {
      // Detect poses in the current video frame
      const poses = await detectorRef.current.estimatePoses(videoRef.current);

      if (poses.length > 0) {
        const pose = poses[0];
        const landmarks = extractLandmarks(pose.keypoints);

        // Calculate midpoint between shoulders
        let shoulderMidX = 0;
        let shoulderMidY = 0;
        if (landmarks.leftShoulder && landmarks.rightShoulder) {
          shoulderMidX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
          shoulderMidY = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;
        }

        // Calculate midpoint between hips
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

        // Calculate how far forward the nose is from shoulder line
        let neckForwardDistance = 0;
        if (landmarks.nose && shoulderMidX !== 0) {
          // Positive value means nose is forward (toward camera)
          // In a mirrored view, we measure horizontal displacement
          neckForwardDistance = Math.abs(landmarks.nose.x - shoulderMidX);
        }

        // Get average confidence from key landmarks
        const keyLandmarks = [
          landmarks.leftShoulder,
          landmarks.rightShoulder,
          landmarks.leftHip,
          landmarks.rightHip,
        ].filter(Boolean);
        
        const avgConfidence = pose.score || 0;

        // Classify posture
        const status = classifyPosture(landmarks, backAngle, neckForwardDistance);

        setPostureData({
          status,
          landmarks,
          neckAngle: neckForwardDistance,
          backAngle,
          confidence: avgConfidence,
        });
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  /**
   * Initialize the pose detection model
   */
  useEffect(() => {
    const initModel = async () => {
      try {
        // Ensure TensorFlow.js backend is ready
        await tf.ready();
        
        // Create MoveNet detector (lightweight and fast)
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          }
        );
        
        detectorRef.current = detector;
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Failed to load pose detection model');
        setIsModelLoading(false);
      }
    };

    initModel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  /**
   * Start pose detection on a video element
   */
  const startDetection = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    if (detectorRef.current && !animationFrameRef.current) {
      processFrame();
    }
  }, [processFrame]);

  /**
   * Stop pose detection
   */
  const stopDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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
