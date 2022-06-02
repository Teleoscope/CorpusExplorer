import React, { useState } from "react";
import useSWR from "swr";
import { useDrag } from "react-dnd";

// material ui
import { makeStyles } from "@material-ui/core/styles";
import Collapse from "@material-ui/core/Collapse";
import List from "@mui/material/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import Paper from "@mui/material/Paper";
import InputBase from "@mui/material/InputBase";
import Divider from "@mui/material/Divider";

// icons
import FavoriteIcon from "@material-ui/icons/Favorite";
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CircleIcon from '@mui/icons-material/Circle';
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import BorderColorOutlinedIcon from "@mui/icons-material/BorderColorOutlined";
import CloseIcon from "@mui/icons-material/Close";

// actions
import { useSelector, useDispatch } from "react-redux";
import { adder } from "../actions/addtoworkspace";
import { mark } from "../actions/bookmark";
import { tag } from "../actions/tagged";
import { userTags } from "../components/LeftMenuBar";

import Note from "./Notes";
import Bookmark from "../actions/bookmark";

const useStyles = makeStyles((theme) => ({
  margin: {
    margin: theme.spacing(1),
    padding: 5,
  },
  extendedIcon: {
    marginRight: theme.spacing(1),
  },
  floater: {
    position: "absolute",
    top: "10px",
  },
  itemAlign: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
  },
}));

const fetcher = (...args) => fetch(...args).then((res) => res.json());

function usePost(postid) {
  const { data, error } = useSWR(`/api/posts/${postid}`, fetcher);
  return {
    post: data,
    loading: !error && !data,
    error: error,
  };
}

var notesInList = [
  // { content: "note 1", id: "1" },
  // { content: "note 2", id: "2" },
  // { content: "note 3", id: "3" },
];
//TODO: Figure out store for notes


const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};


export default function QueryListItem(props) {
  const classes = useStyles();
  const { post, loading, error } = usePost(props.id);
  const dispatch = useDispatch();

  const added = useSelector((state) => state.adder.value);
  const bookmarked = useSelector((state) => state.bookmarker.value);
  const tagged = useSelector((state) => state.tagger.value);


  const marked = bookmarked.includes(props.id);
  const taggedPost = tagged.some(post => post.id === props.id);


  const [open, setOpen] = useState(false);
  const [viewMore, setViewMore] = useState(false);

  // Note
  const [note, setNote] = React.useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [index, setIndex] = useState(0);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [menuItem, setMenuItem] = React.useState([]);
  // methods for the menu functionality 
  const opened = Boolean(anchorEl);

  const handleMouseClick = (event) => {
    setMenuItem(!menuItem);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = () => {
    setMenuItem(!menuItem);
    handleClose();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = () => {
    if (!open) setViewMore(false);
    setOpen(!open);
  };

  const handleChange = (event) => {
    const {
      target: { value },
    } = event;
    setMenuItem(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
  };


  const [{ isDragging }, drag] = useDrag(() => ({
    type: "item",
    item: { id: props.id },

    //optional to keep track of dragging and access state
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const postTitle = (post) => {
    String.prototype.trimLeft = function (charlist) {
      if (charlist === undefined) charlist = "s";
      return this.replace(new RegExp("^[" + charlist + "]+"), "");
    };
    var regex = new RegExp(
      "(AITA for|aita for|AITA if|WIBTA if|AITA|aita|WIBTA)"
    );
    var title = post["title"].replace(regex, "");
    var charlist = " -";
    title = title.trimLeft(charlist);
    var first = title.slice(0, 1);
    var ret = first.toUpperCase() + title.slice(1);
    return ret;
  };

  // Notes
  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (noteContent == null || noteContent != "") {
      setIndex(index + 1);
      notesInList.push({ content: noteContent, id: index });
      setNoteContent("");
    }
  };


  const getColor = () => {
    let i = tagged.findIndex(postID => postID.id === props.id);
    return tagged[i].color;
  };

  return (
    <div ref={drag} style={{ borderBottom: "1px solid  #eceeee" }}>
      <ListItem className={classes.root} disableGutters={true}>
        <ListItemIcon>
          <IconButton
            onClick={() => dispatch(mark(props.id))}
          >
            {marked ?
              <BookmarkIcon color="secondary" style={{ fontSize: 20 }} />
              :
              <BookmarkIcon style={{ fontSize: 20 }} />
            }
          </IconButton>
          <IconButton
            aria-label="add to bookmarks"
            aria-controls={open ? 'basic-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            //onClick={handleMouseClick}
          >
            {taggedPost ? (
              <CircleIcon sx={{ color: getColor() }} style={{ fontSize: 20 }} />
            ) : (
              <CircleIcon style={{ fontSize: 20 }} />
            )}
          </IconButton>

          <Select
            labelId="demo-multiple-checkbox-label"
            id="basic-menu"
            multiple
            value={menuItem}
            onChange={handleChange}
            input={<OutlinedInput label="Tag" />}
            renderValue={(selected) => selected.join(', ')}
            MenuProps={MenuProps}
          >
            {userTags.map(tags => (
              <MenuItem key={tags.id} value={tags.id} onClick={() => dispatch(tag({ id: props.id, tag: tags.tag, color: tags.color }))}>
                <Checkbox checked={menuItem.indexOf(tags) > -1} />
                <ListItemText primary={tags.tag} />
              </MenuItem>
            ))}
          </Select>
        </ListItemIcon>

        <ListItemText>
          {post ? postTitle(post) : "Post loading..."}
        </ListItemText>

        <IconButton onClick={handleClick}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </ListItem>

      <Collapse timeout="auto" unmountOnExit in={open}>
        <List disablePadding>
          <ListItem
            style={
              viewMore
                ? { display: "inline-block" }
                : {
                  display: "inline-block",
                  overflow: "hidden",
                  textOverflow: "ellipsis [..]",
                  height: 250,
                }
            }
          >
            <ListItemText
              primary={post ? post["selftext"] : "Post content not available"}
              ellipsizeMode="tail"
              style={{
                marginLeft: 50,
                display: "inline-block",
                whiteSpace: "pre-line",
              }}
            />
          </ListItem>

          <Button
            variant="text"
            style={{ fontSize: 11, margin: "0 auto", display: "flex" }}
            onClick={() => setViewMore(!viewMore)}
          >
            {viewMore ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            <div style={{ textDecoration: "underline" }}>
              {viewMore ? "View Less" : "View More"}
            </div>
          </Button>
        </List>

        <Note />
      </Collapse>
    </div >
  );
}
