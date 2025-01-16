import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';

interface CreatePostScreenProps {
  navigation: any;
}

export const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ navigation }) => {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const { user } = useAuth();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled && result.uri) {
      setMedia([...media, result.uri]);
    }
  };

  const takePicture = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
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
      alert('Please add some content to your post');
      return;
    }

    try {
      // TODO: Implement post creation logic
      navigation.goBack();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
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
        {media.map((uri, index) => (
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
