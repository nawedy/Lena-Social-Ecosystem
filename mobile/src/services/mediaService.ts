import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { Platform } from 'react-native';
import Upload from 'react-native-background-upload';
import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from 'react-native-image-resizer';

import { API_URL } from '../config';
import { store } from '../store';

interface MediaOptions {
  width?: number;
  height?: number;
  quality?: number;
  rotation?: number;
  type?: 'photo' | 'video';
  multiple?: boolean;
}

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onComplete?: (response: any) => void;
}

class MediaService {
  async pickMedia(options: MediaOptions = {}) {
    const {
      width = 1080,
      height = 1080,
      quality = 80,
      rotation = 0,
      type = 'photo',
      multiple = false,
    } = options;

    try {
      const response = multiple
        ? await ImagePicker.openPicker({
            multiple: true,
            mediaType: type,
            width,
            height,
            cropping: true,
            cropperRotateText: rotation.toString(),
            compressImageQuality: quality / 100,
          })
        : await ImagePicker.openPicker({
            mediaType: type,
            width,
            height,
            cropping: true,
            cropperRotateText: rotation.toString(),
            compressImageQuality: quality / 100,
          });

      return response;
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        throw error;
      }
      return null;
    }
  }

  async captureMedia(options: MediaOptions = {}) {
    const {
      width = 1080,
      height = 1080,
      quality = 80,
      rotation = 0,
      type = 'photo',
    } = options;

    try {
      const response = await ImagePicker.openCamera({
        mediaType: type,
        width,
        height,
        cropping: true,
        cropperRotateText: rotation.toString(),
        compressImageQuality: quality / 100,
      });

      return response;
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        throw error;
      }
      return null;
    }
  }

  async optimizeMedia(path: string, options: MediaOptions = {}) {
    const { width = 1080, height = 1080, quality = 80, rotation = 0 } = options;

    try {
      const response = await ImageResizer.createResizedImage(
        path,
        width,
        height,
        'JPEG',
        quality,
        rotation,
        undefined,
        false,
        {
          mode: 'contain',
          onlyScaleDown: true,
        }
      );

      return response;
    } catch (error) {
      console.error('Error optimizing media:', error);
      throw error;
    }
  }

  async uploadMedia(uri: string, options: UploadOptions = {}) {
    const { onProgress, onError, onComplete } = options;
    const state = store.getState();
    const session = state.auth.session;

    if (!session) {
      throw new Error('No active session');
    }

    const uploadId = await Upload.startUpload({
      url: `${API_URL}/upload`,
      path: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      method: 'POST',
      type: 'multipart',
      field: 'file',
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        'Content-Type': 'multipart/form-data',
      },
      notification: {
        enabled: true,
        autoClear: true,
        onProgressTitle: 'Uploading media...',
        onProgressMessage: 'Please wait...',
        onCompleteTitle: 'Upload complete',
        onCompleteMessage: 'Media upload finished successfully',
        onErrorTitle: 'Upload error',
        onErrorMessage: 'An error occurred while uploading media',
      },
    });

    Upload.addListener('progress', uploadId, data => {
      onProgress?.(data.progress);
    });

    Upload.addListener('error', uploadId, data => {
      onError?.(new Error(data.error));
    });

    Upload.addListener('completed', uploadId, data => {
      onComplete?.(data);
    });

    return uploadId;
  }

  async saveToGallery(uri: string) {
    try {
      const result = await CameraRoll.save(uri, {
        type: 'photo',
        album: 'TikTokToe',
      });
      return result;
    } catch (error) {
      console.error('Error saving to gallery:', error);
      throw error;
    }
  }

  async cleanupTempFiles() {
    try {
      await ImagePicker.clean();
    } catch (error) {
      console.error('Error cleaning temp files:', error);
    }
  }
}

export const mediaService = new MediaService();
