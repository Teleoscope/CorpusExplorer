import React, { useState, useContext } from "react";

// Mui imports
import ListItemText from "@mui/material/ListItemText";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import FolderIcon from '@mui/icons-material/Folder';
import Tooltip from '@mui/material/Tooltip';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';

// actions 
import { useAppSelector, useAppDispatch } from '../hooks'
import { RootState } from '../stores/store'

// contexts
import { Stomp } from './Stomp2';

//utils
import useSWRAbstract from "../util/swr"

export default function groupSelector(props) {

   const userid = useAppSelector((state) => state.activeSessionID.userid);
   const client2 = Stomp.getInstance();
   client2.userId = userid;
   const session_id = useAppSelector((state) => state.activeSessionID.value);
   const { groups } = useSWRAbstract("groups", `/api/sessions/${session_id}/groups`);

   const groups_this_post_belongs_to = groups ? groups.filter((g) => {
      return g.history[0].included_posts.includes(props.id)
   }) : [];

   const [anchorEl, setAnchorEl] = useState(null);
   const open = Boolean(anchorEl);
   const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
   };

   const handleClose = () => {
      setAnchorEl(null);
   };

   const handleSelect = (group_id) => {
      if (groups_this_post_belongs_to.find((item) => item.id == props.id)) {
         client2.remove_post_from_group(group_id, props.id);
      } else {
         client2.add_post_to_group(group_id, props.id);
      }
      handleClose();
   }

   const GroupIconHandler = (props) => {
      if (props.groups.length == 1) {
         var g = props.groups[0].history[0];
         return (
            <Tooltip title={g.label} placement="top">
               <FolderIcon sx={{ color: g.color }} style={{ fontSize: 15 }} />
            </Tooltip>
         )
      }
      if (props.groups.length > 1) {
         var g = props.groups[0].history[0];
         return (
            <Tooltip title={g.label} placement="top">
               <FolderCopyIcon sx={{ color: g.color }} style={{ fontSize: 15 }} />
            </Tooltip>
         )
      }
      return (
         <FolderOutlinedIcon
            sx={{ color: "#BBBBBB" }}
            style={{ fontSize: 15 }} />
      )
   }

   return (
      <div>
         <IconButton onClick={handleClick}>
            <GroupIconHandler groups={groups_this_post_belongs_to} />
         </IconButton>
         <Menu
            anchorEl={anchorEl}
            onClose={handleClose}
            open={open}
         >
            {groups ? groups.map((g) => {
               var _id = g._id

               return (

                  <MenuItem
                     value={_id}
                     onClick={() => handleSelect(_id)}>
                     <FolderIcon sx={{ color: g.history[0].color }} style={{ fontSize: 15 }} />
                     <ListItemText primary={g.history[0].label} />
                  </MenuItem>
               )
            }) : <MenuItem>No groups added yet...</MenuItem>}
         </Menu>
      </div>
   )
}