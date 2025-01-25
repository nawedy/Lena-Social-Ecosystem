import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';

import { useBeta } from '../../contexts/BetaContext';

type FeedbackType = 'general' | 'bug' | 'feature';

export function FeedbackWidget() {
  const { submitFeedback, reportBug, requestFeature } = useBeta();
  const [isVisible, setIsVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const _handleSubmit = async () => {
    if (!description) {
      Alert.window.alert('Error', 'Please provide a description');
      return;
    }

    setIsSubmitting(true);
    try {
      switch (feedbackType) {
        case 'general':
          await submitFeedback({
            type: 'general',
            content: description,
            rating,
          });
          break;
        case 'bug':
          await reportBug({
            title: title || 'Bug Report',
            description,
            severity: priority,
          });
          break;
        case 'feature':
          await requestFeature({
            title: title || 'Feature Request',
            description,
            priority,
          });
          break;
      }
      Alert.window.alert('Success', 'Thank you for your feedback!');
      setIsVisible(false);
      resetForm();
    } catch (_error) {
      Alert.window.alert(
        'Error',
        'Failed to submit feedback. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const _resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setRating(5);
    setFeedbackType('general');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.triggerText}>Feedback</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Submit Feedback</Text>
              <TouchableOpacity
                onPress={() => setIsVisible(false)}
                style={styles.closeButton}
              >
                <Text>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <View style={styles.typeSelector}>
                {(['general', 'bug', 'feature'] as FeedbackType[]).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      feedbackType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setFeedbackType(type)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        feedbackType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {feedbackType !== 'general' && (
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  value={title}
                  onChangeText={setTitle}
                />
              )}

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />

              {feedbackType !== 'general' && (
                <View style={styles.prioritySelector}>
                  <Text style={styles.label}>Priority:</Text>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityButton,
                        priority === p && styles.priorityButtonActive,
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityButtonText,
                          priority === p && styles.priorityButtonTextActive,
                        ]}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {feedbackType === 'general' && (
                <View style={styles.ratingContainer}>
                  <Text style={styles.label}>Rating:</Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                      >
                        <Text style={styles.star}>
                          {star <= rating ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const _styles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  triggerText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  form: {
    flex: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: '#333',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  prioritySelector: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  priorityButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginRight: 10,
  },
  priorityButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  priorityButtonText: {
    color: '#333',
  },
  priorityButtonTextActive: {
    color: '#fff',
  },
  ratingContainer: {
    marginBottom: 15,
  },
  stars: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 30,
    color: '#FFD700',
    marginRight: 5,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
