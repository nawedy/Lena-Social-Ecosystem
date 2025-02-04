tsx
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectUser, updateUser } from '../../store/slices/auth';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

    const handleLogout = useCallback(() => {
    dispatch(logout());
    navigation.navigate('Auth');
  }, [dispatch, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>
      <View style={styles.content}>
        {user && (
          <View>
            <Text style={[styles.label, { color: colors.text }]}>
              DID: {user.did}
            </Text>
            <Text style={[styles.label, { color: colors.text }]}>
              Handle: {user.handle}
            </Text>
            {user.email && (
              <Text style={[styles.label, { color: colors.text }]}>
                Email: {user.email}
              </Text>
            )}
            {user.displayName && (
              <Text style={[styles.label, { color: colors.text }]}>
                Display Name: {user.displayName}
              </Text>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.logoutButton, {backgroundColor: colors.primary}]} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  logoutButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    margin: 16,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});