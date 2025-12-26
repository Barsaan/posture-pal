/**
 * PostureTips Component
 * 
 * Displays helpful tips when bad posture is detected.
 * Only visible when posture status is 'bad'.
 */

import { PostureStatus } from '@/hooks/usePoseDetection';
import { Lightbulb, ArrowUp, Monitor, Timer } from 'lucide-react';

interface PostureTipsProps {
  status: PostureStatus;
}

const tips = [
  {
    icon: ArrowUp,
    title: 'Sit Up Straight',
    description: 'Align your ears with your shoulders. Pull your shoulders back gently.',
  },
  {
    icon: Monitor,
    title: 'Adjust Your Screen',
    description: 'Position your monitor at eye level, about arm\'s length away.',
  },
  {
    icon: Timer,
    title: 'Take Breaks',
    description: 'Stand up and stretch every 30-60 minutes to prevent stiffness.',
  },
];

export const PostureTips = ({ status }: PostureTipsProps) => {
  // Only show tips when posture is bad
  if (status !== 'bad') {
    return null;
  }

  return (
    <div className="glass-card p-6 animate-fade-in border border-posture-bad/20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-posture-bad/10">
          <Lightbulb className="text-posture-bad" size={20} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Quick Posture Tips
        </h3>
      </div>

      {/* Tips list */}
      <div className="space-y-4">
        {tips.map((tip, index) => {
          const Icon = tip.icon;
          return (
            <div 
              key={index}
              className="flex items-start gap-3 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-2 rounded-lg bg-secondary shrink-0">
                <Icon className="text-muted-foreground" size={16} />
              </div>
              <div>
                <h4 className="font-medium text-foreground">{tip.title}</h4>
                <p className="text-sm text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
