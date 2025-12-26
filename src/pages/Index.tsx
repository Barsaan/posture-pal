/**
 * Smart Posture Detection System
 * 
 * Main page component that orchestrates:
 * - Webcam feed display
 * - Pose detection via TensorFlow.js
 * - Posture classification and status display
 * - Real-time feedback and tips
 */

import { useCallback } from 'react';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { WebcamFeed } from '@/components/WebcamFeed';
import { PostureStatus } from '@/components/PostureStatus';
import { PostureTips } from '@/components/PostureTips';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Activity, Github } from 'lucide-react';

const Index = () => {
  const {
    postureData,
    isModelLoading,
    error,
    startDetection,
  } = usePoseDetection();

  // Handler for when webcam is ready
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    startDetection(video);
  }, [startDetection]);

  // Show loading screen while model is loading
  if (isModelLoading) {
    return <LoadingScreen />;
  }

  // Show error if model failed to load
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-destructive text-xl font-semibold mb-2">
            Error Loading Model
          </div>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Posture Guard
                </h1>
                <p className="text-xs text-muted-foreground">
                  Real-time posture detection
                </p>
              </div>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Github className="w-5 h-5 text-muted-foreground" />
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Webcam feed - takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <WebcamFeed
              onVideoReady={handleVideoReady}
              landmarks={postureData.landmarks}
              isGoodPosture={postureData.status === 'good'}
            />
          </div>

          {/* Status and tips panel */}
          <div className="space-y-6">
            {/* Posture status card */}
            <PostureStatus
              status={postureData.status}
              backAngle={postureData.backAngle}
              confidence={postureData.confidence}
            />

            {/* Tips (only shown when posture is bad) */}
            <PostureTips status={postureData.status} />

            {/* Info card */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-foreground mb-3">
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  AI detects your upper body landmarks in real-time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  Calculates your spine angle from vertical
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  Alerts you when slouching is detected
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Built with TensorFlow.js MoveNet • All processing happens in your browser
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
