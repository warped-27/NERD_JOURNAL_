import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>NERD JOURNAL — BOOT OK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#00ff41', fontFamily: 'monospace', fontSize: 16 },
});
