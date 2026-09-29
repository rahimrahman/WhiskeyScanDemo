import { View } from 'react-native';

import { cn } from '@/ui-components/cn';
import { Text } from '@/ui-components/Text';

export type PillProps = { label: string; variant?: 'outline' | 'filled'; className?: string };

/** Full-radius pill: accent outline with a white label, or accent fill with a navy label. */
export function Pill({ label, variant = 'outline', className }: PillProps) {
  const filled = variant === 'filled';
  return (
    <View
      className={cn(
        'self-start rounded-full border border-whiskey-accent px-3 py-1',
        filled && 'bg-whiskey-accent',
        className,
      )}
    >
      <Text className={cn('text-sm', filled && 'text-whiskey-bg')}>{label}</Text>
    </View>
  );
}
