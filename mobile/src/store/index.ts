import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

import authReducer from './slices/auth';
import feedReducer from './slices/feed';
import profileReducer from './slices/profile';
import notificationsReducer from './slices/notifications';
import settingsReducer from './slices/settings';
import mediaReducer from './slices/media';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  feed: feedReducer,
  profile: profileReducer,
  notifications: notificationsReducer,
  settings: settingsReducer,
  media: mediaReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
