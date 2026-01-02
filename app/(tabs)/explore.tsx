import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db, storage } from "@/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp, // ✅ OPTIMIZED
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

/**
 * ✅ OPTIMIZED
 * 明确 createdAt 类型，避免 any
 */
interface Post {
  id: string;
  text: string;
  imageUrl?: string | null;
  createdAt: Timestamp;
}

export default function ExplorePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const postsCollection = collection(db, "posts");

  useEffect(() => {
    /**
     * ✅ OPTIMIZED
     * - 加 limit 防止数据无限增长
     * - createdAt 使用 serverTimestamp 排序
     */
    const q = query(postsCollection, orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const postsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Post[];

        setPosts(postsData);

        /**
         * ✅ OPTIMIZED
         * 只在第一次 snapshot 返回时关闭 loading
         */
        if (!initialLoaded) {
          setInitialLoaded(true);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching posts:", error);
        Alert.alert("Error", "Failed to load posts");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [initialLoaded]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need media library permissions to upload images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const filename = `posts/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.jpg`;

    const storageRef = ref(storage, filename);

    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const createPost = async () => {
    if (!inputText.trim() && !selectedImage) {
      Alert.alert("Error", "Please enter text or select an image");
      return;
    }

    setUploading(true);

    try {
      let imageUrl: string | null = null;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      await addDoc(postsCollection, {
        text: inputText.trim(),
        imageUrl,
        /**
         * ✅ OPTIMIZED
         * 使用服务器时间，避免客户端时间不可信
         */
        createdAt: serverTimestamp(),
      });

      setInputText("");
      setSelectedImage(null);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post");
    } finally {
      setUploading(false);
    }
  };

  const deletePost = async (id: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "posts", id));
          } catch (error) {
            console.error("Error deleting post:", error);
            Alert.alert("Error", "Failed to delete post");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Posts</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.postsContainer}
          contentContainerStyle={styles.postsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.createPostContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="What's on your mind?"
                placeholderTextColor="#999"
                value={inputText}
                onChangeText={setInputText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <ExpoImage
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.removeImageText}>×</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={pickImage}
                style={[styles.button, styles.secondaryButton]}
              >
                <Text style={styles.secondaryButtonText}>
                  {selectedImage ? "Change Image" : "Add Image"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={createPost}
                disabled={uploading}
                style={[
                  styles.button,
                  styles.primaryButton,
                  uploading && styles.disabled,
                ]}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first post above!
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                {post.imageUrl && (
                  <View style={styles.postImageContainer}>
                    <ExpoImage
                      source={{ uri: post.imageUrl }}
                      style={styles.postImage}
                      contentFit="cover"
                    />
                  </View>
                )}
                {!!post.text && (
                  <Text style={styles.postText}>{post.text}</Text>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePost(post.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  header: {
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  createPostContainer: {
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#F8F8F8",
    borderWidth: 1.5,
    borderColor: "#E5E5E7",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#1C1C1E",
    minHeight: 90,
    maxHeight: 140,
    lineHeight: 22,
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewImage: {
    width: "100%",
    height: 220,
  },
  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1.5,
    borderColor: "#D1D1D6",
  },
  secondaryButtonText: {
    color: "#1C1C1E",
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#8E8E93",
    marginTop: 4,
    fontWeight: "500",
  },
  postsContainer: {
    flex: 1,
  },
  postsContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  postImageContainer: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#F5F5F5",
  },
  postImage: {
    width: "100%",
    height: 260,
  },
  postText: {
    fontSize: 16,
    color: "#1C1C1E",
    lineHeight: 24,
    marginBottom: 14,
    fontWeight: "400",
  },
  deleteButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
