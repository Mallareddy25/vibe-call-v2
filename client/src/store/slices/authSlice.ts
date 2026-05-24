import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
}

const getUserFromStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr && userStr !== 'undefined') {
        return JSON.parse(userStr);
      }
    } catch (e) {
      console.error("Failed to parse user from local storage");
    }
  }
  return null;
};

const initialState: AuthState = {
  user: getUserFromStorage(),
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ user: any; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { setUser, logout } = authSlice.actions;
export default authSlice.reducer;
