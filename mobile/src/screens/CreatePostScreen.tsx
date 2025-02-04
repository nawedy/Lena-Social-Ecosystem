tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useDispatch, useSelector } from 'react-redux';
import { addPost } from '../../store/slices/posts';
import { selectUser } from '../../store/slices/auth';

export const CreatePostScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const [postContent, setPostContent] = useState('');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const handlePost = () => {
    if (postContent.trim() !== '') {
      const newPost = {
        id: Math.random().toString(36).substring(7),
        content: postContent,
        author: user?.handle || 'unknown',
        createdAt: new Date().toISOString(),
      };
      dispatch(addPost(newPost));
      setPostContent('');
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Post</Text>
      </View>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="What's on your mind?"
        placeholderTextColor={colors.placeholder}
        multiline
        value={postContent}
        onChangeText={setPostContent}
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handlePost}>
        <Text style={styles.buttonText}>Post</Text>
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    margin: 16,
    marginBottom: 10,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    margin: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});