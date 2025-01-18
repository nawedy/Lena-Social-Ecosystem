import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useATProto } from '../../hooks/useATProto';
import { MFAService } from '../../services/auth/MFAService';
import { Alert, Button, Input, Form, Modal, QRCode } from 'antd';

export function Register() {
  const _navigate = useNavigate();
  const { agent } = useATProto();
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecret, setMFASecret] = useState('');
  const [mfaQRCode, setMFAQRCode] = useState('');
  const [mfaCode, setMFACode] = useState('');

  const _handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      try {
        await agent.createAccount({
          email,
          handle,
          password,
        });

        // Set up MFA
        const _mfaService = new MFAService(agent);
        const { secret, qrCode } = await mfaService.setupMFA(handle);

        setMFASecret(secret);
        setMFAQRCode(qrCode);
        setShowMFASetup(true);
      } catch (err: any) {
        setError(err.message || 'Failed to create account');
        setLoading(false);
      }
    },
    [email, handle, password, confirmPassword, agent]
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
    [mfaCode, agent, navigate]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-md">
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Create your account
        </h2>

        {!showMFASetup ? (
          <Form onFinish={handleRegister} className="mt-8 space-y-6">
            {error && (
              <Alert message={error} type="error" showIcon className="mb-4" />
            )}
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </Form.Item>
            <Form.Item
              name="handle"
              rules={[
                { required: true, message: 'Please enter your handle' },
                {
                  pattern: /^[a-zA-Z0-9._-]+$/,
                  message:
                    'Handle can only contain letters, numbers, dots, underscores, and hyphens',
                },
              ]}
            >
              <Input
                type="text"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                placeholder="Handle"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please enter your password' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject('Passwords do not match');
                  },
                }),
              ]}
            >
              <Input.Password
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </Form>
        ) : (
          <Modal
            title="Set up Two-Factor Authentication"
            open={showMFASetup}
            footer={null}
            closable={false}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Scan this QR code with your authenticator app to set up
                two-factor authentication.
              </p>
              <div className="flex justify-center">
                <QRCode value={mfaQRCode} />
              </div>
              <p className="text-sm text-gray-600">
                Or enter this code manually:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {mfaSecret}
                </code>
              </p>
              <Form onFinish={handleVerifyMFA}>
                <Form.Item
                  name="mfaCode"
                  rules={[
                    {
                      required: true,
                      message: 'Please enter the verification code',
                    },
                  ]}
                >
                  <Input
                    type="text"
                    value={mfaCode}
                    onChange={e => setMFACode(e.target.value)}
                    placeholder="Enter verification code"
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
                  {loading ? 'Verifying...' : 'Complete Setup'}
                </Button>
              </Form>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
