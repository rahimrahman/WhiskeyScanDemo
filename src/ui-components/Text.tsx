import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { cn } from '@/ui-components/cn';

const variantClasses = {
  display: 'font-display',
  body: 'font-body',
  bodySemibold: 'font-body-semibold',
} as const;

export type TextVariant = keyof typeof variantClasses;

export type TextProps = NativeTextProps & { variant?: TextVariant; className?: string };

/** The only text host: serif `display`, sans `body` and `bodySemibold`, white by default. */
export function Text({ variant = 'body', className, ...props }: TextProps) {
  return <NativeText className={cn('text-whiskey-text', variantClasses[variant], className)} {...props} />;
}
