// actions.js
import { speedDialIconClasses } from '@mui/material';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { add_group, save_group_state } from "../components/Stomp";

const initialState = {
		groups: {
			// "_id": "#ffffff"
		},
		grouped_posts: [
			// {id: 'wer123', _id: 'friend'}
		],
		loading: false
}

export const getGroups = createAsyncThunk(
	'groups/getGroups',
	async (id, thunkAPI) => {
		const res = await fetch(`/api/sessions/${id}/groups`).then(

			(data) => data.json()
		)
		console.log("groups fetch", res)
		return res
	})

export const Groups = createSlice({
	name: 'groups',
	initialState,
	reducers: {
		group: (state, action) => {
			var temp = [...state.grouped_posts];
			console.log(action.payload);

			// filters out any duplicates 
			var filter = temp.filter(item => action.payload.id == item.id && action.payload.label == item.label)

			// if there aren't duplicates then we push, else find index and splice
			if (filter.length == 0) {
				temp.push({ id: action.payload.id, label: action.payload.label })
				state.grouped_posts = temp;
			} else {
				var postIndex = temp.indexOf(action.payload)
				temp.splice(postIndex, 1);
				state.grouped_posts = temp;
			}
		},
		addGroup: (state, action) => {
			var temp = { ...state.groups };
			temp[action.payload.label] = action.payload.color;
			console.log("Associating this group with session id ", action.payload.session_id);
			add_group(action.payload.client, action.payload.label, action.payload.color, action.payload.session_id);
			state.groups = temp;
		}
	},
	extraReducers: {
		[getGroups.pending]: (state) => {
			state.loading = true;
		},
		[getGroups.fulfilled]: (state, { payload }) => {
			state.loading = false
			var groups = {}
			var groupedPosts = [];
			payload.forEach((g) => {
				groups[g._id] = g.color;
				var lastItem = g.history[g.history.length - 1];
				lastItem.included_posts.forEach((i) => {
					groupedPosts.push({ id: i, _id: g._id });
				})
			})
			console.log("groups fulfilled", groups)
			state.groups = groups;
			state.grouped_posts = groupedPosts;
		},
		[getGroups.rejected]: (state) => {
			state.loading = false
		},
	},
})

// Action creators are generated for each case reducer function
export const { group, addGroup } = Groups.actions

export default Groups.reducer