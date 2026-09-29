import { cn } from '@/ui-components/cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('flex-1', 'items-center')).toBe('flex-1 items-center');
  });

  it('drops falsy parts', () => {
    expect(cn('p-4', undefined, null, false, '', 'bg-whiskey-bg')).toBe('p-4 bg-whiskey-bg');
  });

  it('lets later utilities win on conflict', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });

  it('returns an empty string with no classes', () => {
    expect(cn()).toBe('');
  });
});
