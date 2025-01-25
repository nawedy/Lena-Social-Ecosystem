import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AirbnbRating } from 'react-native-ratings';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useATProto } from '../../contexts/ATProtoContext';
import { beta } from '../../services/beta';

interface Attachment {
  type: 'image' | 'video';
  url: string;
}

export function FeedbackForm() {
  const { session } = useATProto();
  const [type, setType] = useState<'bug' | 'feature' | 'general'>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(5);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const _pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.window.alert(
        'Permission needed',
        'Please grant permission to access your media library'
      );
      return;
    }

    const _result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const newAttachment: Attachment = {
        type: result.assets[0].type === 'image' ? 'image' : 'video',
        url: `data:${result.assets[0].type}/${
          result.assets[0].type === 'image' ? 'jpeg' : 'mp4'
        };base64,${result.assets[0].base64}`,
      };

      setAttachments([...attachments, newAttachment]);
    }
  };

  const _removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const _handleSubmit = async () => {
    if (!title || !description) {
      Alert.window.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const _success = await beta.submitFeedback({
        userId: session?.did,
        type,
        title,
        description,
        rating: type === 'general' ? rating : undefined,
        attachments,
        metadata: {
          platform: Platform.OS,
          version: Platform.Version,
          deviceModel: Platform.select({
            ios: 'iOS Device',
            android: 'Android Device',
          }),
        },
      });

      if (success) {
        Alert.window.alert('Success', 'Thank you for your feedback!', [
          { text: 'OK', onPress: () => resetForm() },
        ]);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.window.alert(
        'Error',
        'Failed to submit feedback. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const _resetForm = () => {
    setType('general');
    setTitle('');
    setDescription('');
    setRating(5);
    setAttachments([]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={styles.title}>Submit Feedback</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={value => setType(value)}
                style={styles.picker}
              >
                <Picker.Item label="General Feedback" value="general" />
                <Picker.Item label="Bug Report" value="bug" />
                <Picker.Item label="Feature Request" value="feature" />
              </Picker>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brief summary of your feedback"
              maxLength={100}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide detailed feedback..."
              multiline
              numberOfLines={6}
            />
          </View>

          {type === 'general' && (
            <View style={styles.field}>
              <Text style={styles.label}>Rating</Text>
              <AirbnbRating
                count={5}
                defaultRating={rating}
                onFinishRating={setRating}
                size={30}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Attachments</Text>
            <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
              <Icon name="camera-plus" size={24} color="#007AFF" />
              <Text style={styles.attachButtonText}>Add Image/Video</Text>
            </TouchableOpacity>

            <View style={styles.attachments}>
              {attachments.map((attachment, index) => (
                <View key={index} style={styles.attachment}>
                  <Icon
                    name={attachment.type === 'image' ? 'image' : 'video'}
                    size={24}
                    color="#666"
                  />
                  <Text style={styles.attachmentName}>
                    {attachment.type === 'image' ? 'Image' : 'Video'}{' '}
                    {index + 1}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeAttachment(index)}
                    style={styles.removeButton}
                  >
                    <Icon name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  attachButtonText: {
    color: '#007AFF',
    marginLeft: 8,
    fontSize: 16,
  },
  attachments: {
    marginTop: 10,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  attachmentName: {
    flex: 1,
    marginLeft: 10,
  },
  removeButton: {
    padding: 5,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
