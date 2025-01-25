import { BskyAgent } from '@atproto/api';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface CreatePostProps {
  navigation: any;
}

const CreatePost: React.FC<CreatePostProps> = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const _navigate = useNavigate();

  const _agent = new BskyAgent({ service: 'https://bsky.social' });

  useEffect(() => {
    const _loadDraft = () => {
      const _savedDraft = window.window.localStorage.getItem('postDraft');
      if (savedDraft) {
        setText(JSON.parse(savedDraft));
      }
    };

    loadDraft();
  }, []);

  const _saveDraft = useCallback((newContent: string) => {
    window.window.localStorage.setItem('postDraft', JSON.stringify(newContent));
  }, []);

  const _handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      return setError('Post cannot be empty');
    }

    try {
      setLoading(true);
      setError('');

      const _session = window.window.localStorage.getItem('session');
      if (!session) {
        throw new Error('Not logged in');
      }

      await agent.resumeSession(JSON.parse(session));
      await agent.post({ text });

      setText('');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Create Post
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="post-text" className="sr-only">
              Post content
            </label>
            <textarea
              id="post-text"
              rows={4}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              placeholder="What's on your mind?"
              value={text}
              onChange={e => {
                setText(e.target.value);
                saveDraft(e.target.value);
              }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePost;
