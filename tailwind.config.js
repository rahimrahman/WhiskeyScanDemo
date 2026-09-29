/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      /** Whiskey Social palette — see brand-style.md. */
      colors: {
        whiskey: {
          bg: '#1A2334',
          bgDeep: '#141C29',
          surface: '#404958',
          accent: '#8C885E',
          text: '#FFFFFF',
          textSecondary: '#B0B8C4',
          field: '#FFFFFF',
          alert: '#E5484D',
        },
      },
      /** Names registered with expo-font in app/_layout.tsx. */
      fontFamily: {
        display: ['EBGaramond_500Medium'],
        body: ['Poppins_400Regular'],
        'body-semibold': ['Poppins_600SemiBold'],
      },
    },
  },
};
