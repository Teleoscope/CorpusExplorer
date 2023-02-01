import React from "react";
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

// material ui
import {FormHelperText, Menu, MenuItem} from "@mui/material";
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { AppBar } from "@mui/material";
import { Box } from "@mui/material";
import { Toolbar } from "@mui/material";
import { Button } from "@mui/material";
import { FormControl } from '@mui/material';
import { Select } from '@mui/material';
import { InputLabel } from '@mui/material';
import { Stack } from '@mui/material';
import { TextField } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { Divider } from '@mui/material';
import { alpha } from "@mui/material";
import { IconButton } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';

// components
import TeleoscopeLogo from "./TeleoscopeLogo";

// actions
import { useSelector, useDispatch } from "react-redux";
import { sessionActivator, setUserId } from "../../actions/activeSessionID";
import { loadWindows } from "../../actions/windows";
import { loadBookmarkedDocuments } from "../../actions/bookmark";
import { getGroups } from "../../actions/groups";

// utilities
import { useCookies } from "react-cookie";
import useSWRAbstract from "../../util/swr"
import randomColor from 'randomcolor';

// contexts
import { Stomp } from '../Stomp'
import { random } from "lodash";

export default function TopBar() {
  const [loaded, setLoaded] = React.useState(false); 

  const dispatch = useDispatch();
  const [cookies, setCookie] = useCookies(["userid"]);
  const userid = useSelector((state) => state.activeSessionID.userid);  
  if (cookies.userid && cookies?.userid != -1) {
    dispatch(setUserId(cookies.userid))
  }
  const client = Stomp.getInstance();
  client.userId = userid;
  
  const { user } = useSWRAbstract("user", `/api/users/${userid}`);

  const session_id = useSelector((state) => state.activeSessionID.value);

  if (session_id == -1 && user) {
    dispatch(sessionActivator(user.sessions[0]))
  }
  const { session } = useSWRAbstract("session", `/api/sessions/${session_id}`);

  const { users } = useSWRAbstract("users", `/api/users/`);
  const { sessions } = useSWRAbstract("sessions", `/api/sessions/`);
  

  if (session?.history?.length > 0 && !loaded) {
    setLoaded(true);
    var history_item = session.history[0];
    dispatch(loadBookmarkedDocuments(history_item["bookmarks"]));
    dispatch(loadWindows(history_item["windows"]));
  }

  const [open, toggleOpen] = React.useState(false);
  const randomName = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], length: 1 });
  const [dialogValue, setDialogValue] = React.useState({label: ''});

  // Helper functions
  const handleCookie = (username) => {
    fetch(`http://${process.env.NEXT_PUBLIC_RABBITMQ_HOST}/api/user/${username}`)
    .then((response) => response.json())
    .then((data) => {
      if (data) {
        dispatch(setUserId(data._id))
        setCookie("userid", data._id, {
          path: "/"
        });          
      }
    });
  }

  const handleSessionChange = (value) => {
    console.log("value", value)
    dispatch(sessionActivator(value))
    dispatch(getGroups(value))
  }


  const get_color = () => session ? session.history[0].color : "#4E5CBC"

  const handleClickOpen = () => {
    toggleOpen(true);
  };

  const handleClose = () => {
    setDialogValue({
      label: '',
    });
    toggleOpen(false);
  };

  /////////////////////////////////////////////////////////////////////////
  // Functional components

  const getSessions = (username) => {
    if (sessions && users) {
      for (const i in users) {
        let user = users[i];
        if (user["username"] === username && user["sessions"].length > 0) {
          return user["sessions"].map((s) => {
            let temp = sessions.find(ss => ss._id === s)
            return (<MenuItem value={s}>{temp?.history[0].label}</MenuItem>)
          })
        }
      }
    }
    return (
      <MenuItem value={null}>No sessions for this user...</MenuItem>
    )
  }

  const getUsers = () => {
    if (session && users) {
      let owner = session.userlist.owner
      let contributors = session.userlist.contributors

      // check if all users have already been added to session
      if (contributors.length + 1 === users.length) {
        return <MenuItem value={'No users to be added...'}>No users to be added...</MenuItem>
      }

      // show all users that are not already in userlist
      return users.map((u) => {
        if (!owner.includes(u._id) && !contributors.includes(u._id)) {
          return (<MenuItem value={u}>{u.username}</MenuItem>)
        }
      })
    }
    return (
      <MenuItem value={''}>No session selected...</MenuItem>
    )
  }

  const Account = () => {
    return (
      <TextField
        id="input-with-icon-textfield"
        sx={{ width: 200, backgroundColor: alpha('#FFFFFF', 0.0), }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AccountCircle />
            </InputAdornment>
          ),
        }}
        label="Username"
        variant="standard"
        defaultValue={user?.username}
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            handleCookie(e.target.value)
          }
        }}
      />
    )
  }

  const Session = () => {
    return (
      <FormControl
        sx={{ width: 200, backgroundColor: alpha('#FFFFFF', 0.0) }}
        variant="filled"
      >
        <InputLabel id="demo-simple-select-label">Session</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={session_id}
          label="Session ID"
          size="small"
          onChange={(event) => handleSessionChange(event.target.value)}
        >
          {getSessions(user?.username)}
          <Button
            size="small"
            variant="text"
            onClick={() => client.initialize_session(randomName, randomColor(
              {
                luminosity: 'dark',
                hue: 'random',

              }
            ))}
            style={{
              backgroundColor: "#FFFFFF",
              color: "black",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            New session
          </Button>
        </Select>
      </FormControl>
    )
  }

  const AddUserDialogue = () => {
    return (
      <Dialog disableEscapeKeyDown open={open} onClose={handleClose}>
        <DialogTitle>Collaborate with User</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ display: 'flex', flexWrap: 'wrap' }}>
            <FormControl
              sx={{ width: 200, backgroundColor: 'white', }}
              variant="filled"
            >
              <InputLabel id="demo-simple-select-helper-label">User</InputLabel>
              <Select
                  labelId="demo-simple-select-helper-label"
                  id="demo-simple-select-helper"
                  value={dialogValue.label}
                  label="User"
                  onChange={(event) => setDialogValue({label: event.target.value})}
              >
                {getUsers()}
              </Select>
              <FormHelperText>Select User</FormHelperText>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            type="submit"
            onClick={() => {
              client.add_user_to_session(dialogValue.label._id, session_id)
              handleClose()
            }}
          >Add
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  const AccountMenu = () => {
    
    const [anchorEl, setAnchorEl] = React.useState(null);
    const openMenu = Boolean(anchorEl);

    const handleMenuClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    
    const handleMenuClose = () => {
      setAnchorEl(null);
    };
    return (
      <Stack spacing={1} direction="row-reverse">
        <IconButton
          id="bIconasic-button"
          aria-controls={openMenu ? 'basic-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={openMenu ? 'true' : undefined}
          onClick={handleMenuClick}
        >
          <AccountCircle></AccountCircle>
        </IconButton>
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={openMenu}
          onClose={handleMenuClose}
          MenuListProps={{
            'aria-labelledby': 'basic-button',
          }}
        >
          <MenuItem children={<Account />}></MenuItem>
          <MenuItem children={<Session />}></MenuItem>
          <Divider></Divider>
          <MenuItem onClick={handleClickOpen}>Add a different user to this session</MenuItem>
        </Menu>
        <AddUserDialogue />
      </Stack>

    )
  }



  // Main return for this component
  return (
    <AppBar position="static" style={{ backgroundColor: get_color(), width: "100%" }}>
      <Toolbar >
        <Stack spacing={10} sx={{ width: "100%" }} direction="row" alignItems="center" justifyContent="space-between">
          <TeleoscopeLogo />
          <AccountMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
