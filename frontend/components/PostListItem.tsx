import React, { useContext, useState } from "react";

// material ui
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import FlareIcon from '@mui/icons-material/Flare';
import RemoveIcon from '@mui/icons-material/Remove';

// actions
import { useAppSelector, useAppDispatch } from '../hooks'
import { RootState } from '../stores/store'
import { dragged } from "../actions/windows";

// custom
import GroupSelector from "./GroupSelector";
import BookmarkSelector from "./BookmarkSelector";
import PostTitle from './PostTitle';

//utils
import useSWRAbstract from "../util/swr"
import { PreprocessTitle } from "../util/Preprocessers"

// contexts
import { Stomp } from './Stomp2'

export default function PostListItem(props) {
  const userid = useAppSelector((state) => state.activeSessionID.userid);
  const client2 = Stomp.getInstance();
  client2.userId = userid;
  const { post } = useSWRAbstract("post", `/api/posts/${props.id}`);
  const title = post ? PreprocessTitle(post.title) : false;
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const magnitude = useAppSelector((state) => state.teleoscopes.magnitude);


  const showGroupIcon = props.hasOwnProperty("showGroupIcon") ? props.showGroupIcon : true;

  const handleOrientTowards = () => {
    client2.reorient(props.group.teleoscope, [props.id], [], magnitude)
  }
  const handleOrientAway = () => {
    client2.reorient(props.group.teleoscope, [], [props.id], magnitude)
  }
  const handleRemove = () => {
    client2.remove_post_from_group(props.group._id, props.id)
  }

  return (

    <div
      draggable={true}
      className="droppable-element"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: "1px solid  #eceeee",
        paddingTop: "2px",
        paddingBottom: "3px",
        backgroundColor: hover ? "#EEEEEE" : "#FFFFFF",
        width: "100%",
        height: "100%",
      }}
      id={props.id}
      onDragStart={(e, data) => { dispatch(dragged({ id: props.id + "%post", type: "Post" })) }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Stack
          direction="row"
          alignItems="center"
        >
          <BookmarkSelector id={props.id} />
          {showGroupIcon ? <GroupSelector id={props.id} /> : null}
          <PostTitle title={title} noWrap={false} />
        </Stack>

        {props.hasOwnProperty("group") ? (
        <div>
          <IconButton sx={{ width: 20, height: 20 }} onClick={() => handleOrientTowards()}>
            {<FlareIcon sx={{ '&:hover': {color: 'blue'}, width: 20, height: 20 }}></FlareIcon>}
          </IconButton> 
          {/* <IconButton onClick={() => handleOrientAway()}>
            {<FlareIcon sx={{ color: "red" }}></FlareIcon>}
          </IconButton> */}
          <IconButton sx={{ width: 20, height: 20 }} onClick={() => handleRemove()}>
            <RemoveIcon sx={{ '&:hover': {color: 'red'}, width: 20, height: 20 }}></RemoveIcon>
          </IconButton>
        </div>
        ) 
      
        : ""}

      </Stack>

    </div>
  );
}
