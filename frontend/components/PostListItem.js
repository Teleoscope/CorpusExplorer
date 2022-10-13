import React, { useState } from "react";

// material ui
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
// actions
import { useDispatch } from "react-redux";
import { dragged } from "../actions/windows";

// custom
import GroupSelector from "./GroupSelector";
import BookmarkSelector from "./BookmarkSelector";
import PostTitle from './PostTitle';
import Expander from "./Expander";

//utils
import useSWRAbstract from "../util/swr"
import { PreprocessTitle } from "../util/Preprocessers"


export default function PostListItem(props) {
  const { post } = useSWRAbstract("post", `/api/posts/${props.id}`);
  const title = post ? PreprocessTitle(post.title) : false;
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
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
          <GroupSelector id={props.id} />
          <PostTitle title={title} noWrap={false} />
        </Stack>

        <IconButton onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>

        {open ? <Expander post={post ? post : {}} /> : ""}

      </Stack>

    </div>
  );
}
