import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useATProto } from '../../contexts/ATProtoContext';
import { ComAtprotoRepoUploadBlob } from '@atproto/api';

interface UploadProps {
  onUploadComplete?: (blob: ComAtprotoRepoUploadBlob.Response) => void;
  onUploadError?: (error: Error) => void;
  maxSize?: number;
  acceptedTypes?: string[];
  className?: string;
}

const Upload: React.FC<UploadProps> = ({
  onUploadComplete,
  onUploadError,
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ['image/*', 'video/*'],
  className = '',
}) => {
  const { uploadBlob } = useATProto();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const _onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const _file = acceptedFiles[0];
      setUploading(true);
      setProgress(0);

      try {
        // Create a blob from the file
        const _blob = new Blob([file], { type: file.type });

        // Upload the blob using AT Protocol
        const _response = await uploadBlob(blob, {
          onUploadProgress: progressEvent => {
            const _percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          },
        });

        onUploadComplete?.(response);
      } catch (error) {
        console.error('Upload error:', error);
        onUploadError?.(error as Error);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [uploadBlob, onUploadComplete, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 ${
        isDragActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      } ${className}`}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Uploading... {progress}%
          </p>
        </div>
      ) : isDragActive ? (
        <p className="text-blue-500">Drop your file here</p>
      ) : (
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium">Click to upload or drag and drop</p>
            <p>
              {acceptedTypes.join(', ')} up to{' '}
              {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
