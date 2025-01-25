import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';

import { useAuth } from '../../hooks/useAuth';
import { RootStackParamList } from '../../navigation/types';

interface CreatePostScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreatePost'>;
}

export const CreatePostScreen: React.FC<CreatePostScreenProps> = ({
  navigation,
}) => {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const { user } = useAuth();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Sorry, we need camera roll permissions to make this work!'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      setMedia([...media, pickerResult.assets[0].uri]);
    }
  };

  const takePicture = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Sorry, we need camera permissions to make this work!'
      );
      return;
    }

    // Navigate to camera screen
    navigation.navigate('Camera', {
      onCapture: (uri: string) => {
        setMedia([...media, uri]);
      },
    });
  };

  const createPost = async () => {
    if (!text && media.length === 0) {
      Alert.alert('Please add some content to your post');
      return;
    }

    try {
      // TODO: Implement post creation logic
      navigation.goBack();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Failed to create post. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        multiline
        placeholder="What's on your mind?"
        value={text}
        onChangeText={setText}
      />

      <View style={styles.mediaPreview}>
        {media.map((_uri, index) => (
          <View key={index} style={styles.mediaItem}>
            {/* Add media preview component */}
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={pickImage} style={styles.button}>
          <LinearGradient
            colors={['#FF4B2B', '#FF416C']}
            style={styles.gradient}
          >
            <Text style={styles.buttonText}>Pick Image</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={takePicture} style={styles.button}>
          <LinearGradient
            colors={['#FF4B2B', '#FF416C']}
            style={styles.gradient}
          >
            <Text style={styles.buttonText}>Take Picture</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={createPost} style={styles.button}>
          <LinearGradient
            colors={['#FF4B2B', '#FF416C']}
            style={styles.gradient}
          >
            <Text style={styles.buttonText}>Create Post</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  input: {
    height: 150,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  mediaPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  mediaItem: {
    width: 100,
    height: 100,
    margin: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
