// Ensure gesture handler and Reanimated are initialized before the app loads
import 'react-native-gesture-handler';
import 'react-native-reanimated';

// Load NativeWind CSS (handled by metro via withNativeWind)
import './global.css';

// Register Expo Router entry last
import 'expo-router/entry';
