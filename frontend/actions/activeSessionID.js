// actions.js
import { createSlice } from '@reduxjs/toolkit'

export const ActiveSessionID = createSlice({
  name: 'activeSessionID',
  initialState: {
    value: "642f37867d81bd8062d1f63f",
    userid: "642f37867d81bd8062d1f63d"
  },
  reducers: {
    sessionActivator: (state, action) => {
      console.log("action", action.payload)
    	var id = action.payload // value of documentid
      if (id) {
        state.value = id;

      }
      
    },
    loadActiveSessionID: (state, action) => {
      state.value = action.payload
    },
    setUserId: (state, action) => {
      state.userid = action.payload;
    }
  },
})

// Action creators are generated for each case reducer function
export const { sessionActivator, loadActiveSessionID, setUserId } = ActiveSessionID.actions

export default ActiveSessionID.reducer