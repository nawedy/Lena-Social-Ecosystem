import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { BskyAgent } from '@atproto/api';
import { RootState } from '../index';

interface AuthState {
  isAuthenticated: boolean;
  user: {
    did: string;
    handle: string;
    email?: string;
    displayName?: string;
    avatar?: string;
  } | null;
  session: {
    accessJwt: string;
    refreshJwt: string;
    handle: string;
    did: string;
  } | null;
  status: 'idle' | 'loading' | 'failed';
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  session: null,
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({
    identifier,
    password,
  }: {
    identifier: string;
    password: string;
  }) => {
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    const response = await agent.login({ identifier, password });
    return response;
  }
);

export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { session } = state.auth;

    if (!session) {
      throw new Error('No session to refresh');
    }

    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.resumeSession(session);
    return agent.session;
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const { session } = state.auth;

    if (session) {
      const agent = new BskyAgent({ service: 'https://bsky.social' });
      await agent.resumeSession(session);
      await agent.logout();
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateUser: (state, action) => {
      state.user = {
        ...state.user,
        ...action.payload,
      };
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle';
        state.isAuthenticated = true;
        state.session = action.payload;
        state.user = {
          did: action.payload.did,
          handle: action.payload.handle,
        };
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Login failed';
      })
      .addCase(refreshSession.pending, state => {
        state.status = 'loading';
      })
      .addCase(refreshSession.fulfilled, (state, action) => {
        state.status = 'idle';
        state.session = action.payload;
      })
      .addCase(refreshSession.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Session refresh failed';
        state.isAuthenticated = false;
        state.session = null;
        state.user = null;
      })
      .addCase(logout.fulfilled, state => {
        state.isAuthenticated = false;
        state.session = null;
        state.user = null;
        state.status = 'idle';
        state.error = null;
      });
  },
});

export const { updateUser, clearError } = authSlice.actions;

export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
export const selectUser = (state: RootState) => state.auth.user;
export const selectSession = (state: RootState) => state.auth.session;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAuthError = (state: RootState) => state.auth.error;

export default authSlice.reducer;
