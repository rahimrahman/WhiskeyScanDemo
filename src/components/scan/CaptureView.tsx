import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Camera, type CameraDevice, getCameraDevice, usePhotoOutput, VisionCamera } from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toImageUri } from '@/components/scan/scanFlow';
import { Icon } from '@/ui-components/Icon';
import { Text } from '@/ui-components/Text';

/** `undefined` while the device factory loads, `null` once loaded without a back camera. */
function useBackCamera() {
  const [device, setDevice] = useState<CameraDevice | null>();

  useEffect(() => {
    let mounted = true;
    VisionCamera.createDeviceFactory()
      .then((factory) => getCameraDevice(factory, 'back') ?? null)
      .catch(() => null)
      .then((back) => {
        if (mounted) setDevice(back);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return device;
}

/** Back-camera preview in navy chrome: close returns without a scan, the shutter opens Scan Bottle. */
export function CaptureView() {
  const router = useRouter();
  const device = useBackCamera();
  const photoOutput = usePhotoOutput();
  const capturing = useRef(false);

  const takePhoto = async () => {
    if (capturing.current) return;
    capturing.current = true;
    try {
      const { filePath } = await photoOutput.capturePhotoToFile({}, {});
      router.replace({ pathname: '/scan', params: { photoUri: toImageUri(filePath) } });
    } catch {
      Alert.alert("Couldn't take the photo.");
    } finally {
      capturing.current = false;
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-whiskey-bg">
      <View className="h-12 flex-row items-center px-2">
        <View className="h-11 w-11 items-center justify-center">
          <Icon name="xmark" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            className="absolute inset-0"
          />
        </View>
      </View>

      {device ? (
        <>
          {/* Camera is not a NativeWind host, so it cannot take className. */}
          <Camera device={device} isActive outputs={[photoOutput]} style={{ flex: 1 }} />
          <View className="items-center py-6">
            <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-whiskey-accent">
              <View className="h-16 w-16 rounded-full bg-whiskey-text" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                onPress={takePhoto}
                className="absolute inset-0"
              />
            </View>
          </View>
        </>
      ) : (
        <View className="flex-1 items-center justify-center">
          {device === null ? <Text className="text-whiskey-textSecondary">No camera</Text> : null}
        </View>
      )}
    </SafeAreaView>
  );
}
