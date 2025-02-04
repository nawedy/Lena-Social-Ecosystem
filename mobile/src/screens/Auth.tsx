tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export const AuthScreen: React.FC = (): JSX.Element => {
  return (
    <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
            <Text style={styles.text}>Authentication Screen</Text>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
  },
});