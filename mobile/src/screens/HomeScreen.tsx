tsx
import React, { useCallback } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Button
} from 'react-native';
import { useTheme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { selectPosts } from '../store/slices/feed';

interface Post {
  id: string
  title: string
  content: string
}
export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>(dummyPosts);

  const handleRefresh = useCallback(() => {
    // Implement refresh logic here later
    console.log('Refreshing posts...')
  }, []);
  
  const handleProfile = () => navigation.navigate('Profile');
  const posts = useSelector(selectPosts);


  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postContainer, { backgroundColor: colors.card }]}>
      <Text style={[styles.postTitle, { color: colors.text }]}>
        {item.title}
      </Text>
      <Text style={[styles.postContent, { color: colors.text }]}>
        {item.content}
      </Text>
    </View>
  )
  const handleCreatePost = () => {
    navigation.navigate('CreatePost');
  };

  const refreshButton = (
    <Button title="Refresh" onPress={handleRefresh} color={colors.primary} />
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          TikTokToe
        </Text>
        <TouchableOpacity onPress={handleProfile} style={styles.refreshButton}>
            <Text style={{ color: colors.primary }}>Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.mainContent}>
        {refreshButton}
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
      <View style={styles.createPostButtonContainer}>
          <TouchableOpacity
            style={[styles.createPostButton, { backgroundColor: colors.primary }]}
            onPress={handleCreatePost}>
            <Text style={styles.createPostButtonText}>Create Post</Text>
          </TouchableOpacity>
        </View>
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  postContainer: {
    width: '100%',
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
  },
  postTitle: {
    fontWeight: 'bold',
  },
  postContent: {
    marginTop: 8,
  },
  refreshButton: {
    padding: 8,
  },
  createPostButtonContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: '90%',
  },
  createPostButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createPostButtonText: {
    color: 'white',
  },
});