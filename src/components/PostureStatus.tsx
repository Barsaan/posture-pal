/**
 * PostureStatus Component
 * 
 * Displays the current posture status with visual feedback:
 * - Large status text
 * - Color coding (green = good, red = bad)
 * - Animated glow effects
 * - Angle information for debugging
 */

import { PostureStatus as PostureStatusType } from '@/hooks/usePoseDetection';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface PostureStatusProps {
  status: PostureStatusType;
  backAngle: number;
  confidence: number;
}

export const PostureStatus = ({ status, backAngle, confidence }: PostureStatusProps) => {
  // Determine display properties based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'good':
        return {
          text: 'Good Posture',
          description: 'Keep it up! Your posture is aligned.',
          icon: CheckCircle,
          colorClass: 'text-posture-good',
          bgClass: 'bg-posture-good/10 border-posture-good/30',
          pulseClass: 'pulse-good',
        };
      case 'bad':
        return {
          text: 'Bad Posture',
          description: 'Please adjust your sitting position.',
          icon: AlertTriangle,
          colorClass: 'text-posture-bad',
          bgClass: 'bg-posture-bad/10 border-posture-bad/30',
          pulseClass: 'pulse-bad',
        };
      default:
        return {
          text: 'Initializing...',
          description: 'Getting ready to analyze your posture.',
          icon: Loader2,
          colorClass: 'text-posture-neutral',
          bgClass: 'bg-secondary border-border',
          pulseClass: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={`
        glass-card p-6 border-2 transition-all duration-500 ease-out
        ${config.bgClass} ${config.pulseClass}
      `}
    >
      {/* Main status display */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`${config.colorClass} transition-colors duration-300`}>
          <Icon 
            size={48} 
            className={status === 'initializing' ? 'animate-spin' : ''} 
          />
        </div>
        <div>
          <h2 
            className={`text-3xl font-bold transition-colors duration-300 ${config.colorClass}`}
          >
            {config.text}
          </h2>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Angle indicator (only show when detecting) */}
      {status !== 'initializing' && (
        <div className="flex items-center gap-6 pt-4 border-t border-border/50">
          {/* Back angle meter */}
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Spine Angle</span>
              <span className={config.colorClass}>{Math.abs(backAngle).toFixed(1)}°</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  status === 'good' ? 'bg-posture-good' : 'bg-posture-bad'
                }`}
                style={{
                  width: `${Math.min(Math.abs(backAngle) / 30 * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0°</span>
              <span className="opacity-50">Threshold: 15°</span>
              <span>30°</span>
            </div>
          </div>

          {/* Detection confidence */}
          <div className="text-center px-4 border-l border-border/50">
            <div className="text-2xl font-semibold text-foreground">
              {(confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </div>
        </div>
      )}
    </div>
  );
};
