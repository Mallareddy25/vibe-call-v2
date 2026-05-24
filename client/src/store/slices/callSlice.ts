import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CallState {
  currentCall: any | null;
  incomingCall: any | null;
  isInCall: boolean;
}

const initialState: CallState = {
  currentCall: null,
  incomingCall: null,
  isInCall: false,
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    setIncomingCall: (state, action: PayloadAction<any>) => {
      state.incomingCall = action.payload;
    },
    setCurrentCall: (state, action: PayloadAction<any>) => {
      state.currentCall = action.payload;
      state.isInCall = true;
      state.incomingCall = null;
    },
    endCall: (state) => {
      state.currentCall = null;
      state.incomingCall = null;
      state.isInCall = false;
    },
  },
});

export const { setIncomingCall, setCurrentCall, endCall } = callSlice.actions;
export default callSlice.reducer;
