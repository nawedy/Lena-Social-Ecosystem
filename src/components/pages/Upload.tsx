import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useATProto } from '../../contexts/ATProtoContext';
import { useDropzone } from 'react-dropzone';

const Upload: React.FC = () => {
  const _navigate = useNavigate();
  const { createPost } = useATProto();
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _onDrop = useCallback((acceptedFiles: File[]) => {
    // Check file type and size
    const _validFiles = acceptedFiles.filter(file => {
      const _isValid =
        file.type.startsWith('video/') || file.type.startsWith('image/');
      const _isValidSize = file.size <= 100 * 1024 * 1024; // 100MB limit
      return isValid && isValidSize;
    });

    if (validFiles.length !== acceptedFiles.length) {
      setError(
        'Some files were rejected. Please only upload videos or images under 100MB.'
      );
    }

    setFiles(validFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: true,
  });

  const _handleUpload = async () => {
    if (!files.length) {
      setError('Please select at least one file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const _media = await Promise.all(
        files.map(async file => ({
          type: file.type.startsWith('video/')
            ? ('video' as const)
            : ('image' as const),
          data: new Blob([await file.arrayBuffer()], { type: file.type }),
        }))
      );

      await createPost(caption, media);
      navigate('/');
    } catch (err) {
      setError('Failed to upload. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Upload Content
      </h1>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-300'}
        `}
      >
        <input {...getInputProps()} />
        {files.length > 0 ? (
          <div className="space-y-4">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {file.name}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setFiles(files.filter((_, i) => i !== index));
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-300">
              Drag and drop your videos or images here, or click to select files
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Supported formats: MP4, MOV, AVI, JPG, PNG, GIF (max 100MB)
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Caption
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          rows={3}
          placeholder="Write a caption for your post..."
        />
      </div>

      {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}

      <div className="mt-6">
        <button
          onClick={handleUpload}
          disabled={isUploading || !files.length}
          className={`w-full py-2 px-4 rounded-md text-white font-medium
            ${
              isUploading || !files.length
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

export default Upload;
