import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import callReducer from './slices/callSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    call: callReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
