import { Alert, Button, Input, Form } from 'antd';
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useATProto } from '../../hooks/useATProto';
import { MFAService } from '../../services/auth/MFAService';

export function Login() {
  const _navigate = useNavigate();
  const { agent } = useATProto();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMFACode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMFA, setShowMFA] = useState(false);
  const [tempSession, setTempSession] = useState<any>(null);

  const _handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const _session = await agent.login({ identifier, password });
        setTempSession(session);

        // Check if MFA is enabled
        const _mfaService = new MFAService(agent);
        const _mfaEnabled = await mfaService.isMFAEnabled();

        if (mfaEnabled) {
          setShowMFA(true);
        } else {
          // No MFA required, proceed with login
          window.localStorage.setItem('session', JSON.stringify(session));
          navigate('/dashboard');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to login');
      } finally {
        setLoading(false);
      }
    },
    [identifier, password, agent, navigate]
  );

  const _handleVerifyMFA = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const _mfaService = new MFAService(agent);
        const _isValid = await mfaService.verifyMFACode(mfaCode);

        if (isValid) {
          window.localStorage.setItem('session', JSON.stringify(tempSession));
          navigate('/dashboard');
        } else {
          setError('Invalid MFA code. Please try again.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify MFA code');
      } finally {
        setLoading(false);
      }
    },
    [mfaCode, agent, tempSession, navigate]
  );

  if (showMFA) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Two-Factor Authentication
          </h2>
          <Form onFinish={handleVerifyMFA} className="mt-8 space-y-6">
            {error && (
              <Alert message={error} type="error" showIcon className="mb-4" />
            )}
            <Form.Item
              name="mfaCode"
              rules={[
                { required: true, message: 'Please enter your MFA code' },
              ]}
            >
              <Input
                type="text"
                value={mfaCode}
                onChange={e => setMFACode(e.target.value)}
                placeholder="Enter MFA code"
                maxLength={6}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full"
            >
              {loading ? 'Verifying...' : 'Verify MFA Code'}
            </Button>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Sign in to your account
        </h2>
        <Form onFinish={handleLogin} className="mt-8 space-y-6">
          {error && (
            <Alert message={error} type="error" showIcon className="mb-4" />
          )}
          <Form.Item
            name="identifier"
            rules={[
              { required: true, message: 'Please enter your email or handle' },
            ]}
          >
            <Input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Email or handle"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Form>
      </div>
    </div>
  );
}
