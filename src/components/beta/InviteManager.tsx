import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useATProto } from '../../contexts/ATProtoContext';
import { invitation } from '../../services/invitation';
import { format } from 'date-fns';

interface InvitationStats {
  total_sent: number;
  accepted: number;
  pending: number;
  timestamps: {
    last_sent: string;
    last_accepted: string;
  };
}

export function InviteManager() {
  const { session } = useATProto();
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [remainingInvites, setRemainingInvites] = useState(5);

  useEffect(() => {
    if (session?.did) {
      loadInvitationStats();
    }
  }, [session?.did]);

  const _loadInvitationStats = async () => {
    try {
      const _stats = await invitation.getInvitationStats(session!.did);
      setStats(stats);
      setRemainingInvites(5 - (stats?.total_sent || 0));
    } catch (error) {
      console.error('Error loading invitation stats:', error);
    }
  };

  const _handleInvite = async () => {
    if (!email) {
      Alert.window.alert('Error', 'Please enter an email address');
      return;
    }

    if (remainingInvites <= 0) {
      Alert.window.alert('Error', 'You have no remaining invitations');
      return;
    }

    setIsLoading(true);
    try {
      const _success = await invitation.sendInvitation({
        inviterDid: session!.did,
        inviteeEmail: email,
        inviteeHandle: handle,
        customMessage: message,
      });

      if (success) {
        Alert.window.alert('Success', 'Invitation sent successfully!');
        setEmail('');
        setHandle('');
        setMessage('');
        loadInvitationStats();
      } else {
        Alert.window.alert('Error', 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.window.alert('Error', 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const _renderStats = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>Your Invitation Stats</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{remainingInvites}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.accepted || 0}</Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>
      {stats?.timestamps.last_sent && (
        <Text style={styles.timestamp}>
          Last sent: {format(new Date(stats.timestamps.last_sent), 'PPp')}
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderStats()}

      <View style={styles.formContainer}>
        <Text style={styles.title}>Invite to Beta</Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="AT Protocol handle (optional)"
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Personal message (optional)"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[
            styles.button,
            (isLoading || remainingInvites <= 0) && styles.buttonDisabled,
          ]}
          onPress={handleInvite}
          disabled={isLoading || remainingInvites <= 0}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {remainingInvites <= 0
                ? 'No Invitations Left'
                : 'Send Invitation'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
