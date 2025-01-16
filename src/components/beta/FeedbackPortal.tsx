import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert
} from 'react-native';
import { BetaTestingService } from '../../services/BetaTestingService';
import { useAuth } from '../../hooks/useAuth';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

const feedbackCategories = [
  'Game Mechanics',
  'User Interface',
  'TikTok Migration',
  'Performance',
  'Social Features',
  'Matchmaking',
  'Other'
];

const FeedbackPortal: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'bug' | 'feature' | 'improvement' | 'general'>('general');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previousFeedback, setPreviousFeedback] = useState([]);

  const { user } = useAuth();
  const betaService = BetaTestingService.getInstance();

  useEffect(() => {
    requestPermissions();
    loadPreviousFeedback();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to add photos to your feedback.');
      }
    }
  };

  const loadPreviousFeedback = async () => {
    try {
      const snapshot = await betaService.db
        .collection('beta_testers')
        .doc(user.id)
        .get();
      const data = snapshot.data();
      if (data?.feedback) {
        setPreviousFeedback(data.feedback);
      }
    } catch (error) {
      console.error('Error loading previous feedback:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setAttachments([...attachments, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const submitFeedback = async () => {
    if (!title || !description || !category) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const feedback = {
        title,
        description,
        category,
        type,
        severity,
        attachments
      };

      await betaService.submitFeedback(user.id, feedback);
      
      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. Our team will review it shortly.',
        [{ text: 'OK', onPress: resetForm }]
      );
      
      loadPreviousFeedback();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setType('general');
    setSeverity('medium');
    setAttachments([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Submit Feedback</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Brief summary of your feedback"
        />

        <Text style={styles.label}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
          {feedbackCategories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                category === cat && styles.categoryButtonSelected
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[
                styles.categoryButtonText,
                category === cat && styles.categoryButtonTextSelected
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeContainer}>
          {(['bug', 'feature', 'improvement', 'general'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeButton, type === t && styles.typeButtonSelected]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextSelected]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'bug' && (
          <>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.severityContainer}>
              {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.severityButton, severity === s && styles.severityButtonSelected]}
                  onPress={() => setSeverity(s)}
                >
                  <Text style={[styles.severityButtonText, severity === s && styles.severityButtonTextSelected]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Detailed description of your feedback"
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Attachments</Text>
        <View style={styles.attachmentsContainer}>
          {attachments.map((uri, index) => (
            <View key={index} style={styles.attachmentPreview}>
              <Image source={{ uri }} style={styles.attachmentImage} />
              <TouchableOpacity
                style={styles.removeAttachment}
                onPress={() => setAttachments(attachments.filter((_, i) => i !== index))}
              >
                <MaterialIcons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addAttachment} onPress={pickImage}>
            <MaterialIcons name="add-photo-alternate" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submitFeedback}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
      </View>

      {previousFeedback.length > 0 && (
        <View style={styles.previousFeedback}>
          <Text style={styles.previousFeedbackHeader}>Previous Feedback</Text>
          {previousFeedback.map((feedback, index) => (
            <View key={index} style={styles.feedbackItem}>
              <Text style={styles.feedbackItemTitle}>{feedback.title}</Text>
              <Text style={styles.feedbackItemStatus}>Status: {feedback.status}</Text>
              <Text style={styles.feedbackItemDate}>
                {new Date(feedback.createdAt.seconds * 1000).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    color: '#333',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: 'white',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: '#666',
  },
  typeButtonTextSelected: {
    color: 'white',
  },
  severityContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'white',
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  severityButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  severityButtonText: {
    color: '#666',
  },
  severityButtonTextSelected: {
    color: 'white',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  attachmentPreview: {
    width: 80,
    height: 80,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  removeAttachment: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAttachment: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previousFeedback: {
    padding: 20,
  },
  previousFeedbackHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  feedbackItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  feedbackItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  feedbackItemStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  feedbackItemDate: {
    fontSize: 12,
    color: '#999',
  },
});

export default FeedbackPortal;
