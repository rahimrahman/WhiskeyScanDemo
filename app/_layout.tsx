import '../global.css';

import { Stack } from 'expo-router';

export default function RootLayout() {
  // Navigator option: className cannot reach the stack card behind each screen.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1A2334' } }} />;
}
