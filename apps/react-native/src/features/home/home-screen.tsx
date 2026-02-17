import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>OpenClaw</Text>
        <Text style={styles.title}>React Native App</Text>
        <Text style={styles.body}>Android-first build.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#10121A',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: '#4AE49E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F7F8FC',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
  },
  body: {
    color: '#B9C0D2',
    fontSize: 18,
    lineHeight: 28,
    marginTop: 14,
    maxWidth: 420,
  },
});
