/**
 * LoadingScreen Component
 * 
 * Displays a loading screen while the pose detection model is being loaded.
 * Shows a spinner and loading text.
 */

import { Loader2, Activity } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        {/* Logo/Icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="w-12 h-12 text-primary" />
          </div>
          {/* Spinning ring */}
          <div className="absolute inset-0 w-24 h-24 mx-auto">
            <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
              <circle
                className="stroke-primary/20"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="4"
              />
              <circle
                className="stroke-primary"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="70 200"
              />
            </svg>
          </div>
        </div>

        {/* Loading text */}
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Loading Pose Detection
        </h2>
        <p className="text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Initializing AI model...
        </p>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-secondary rounded-full mt-6 mx-auto overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
      </div>
    </div>
  );
};
